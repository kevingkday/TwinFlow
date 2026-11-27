import { eq, and } from 'drizzle-orm';
import type { Database } from '../db';
import { schema } from '../db';
import { parseCityRegion, type CandidateQuerySpec } from './aiQueryPlanner';

export const MAX_QUERIES_PER_SCOUT = 15;
export const MAX_ARTICLES_JUDGED_PER_SCOUT = 200;
export const RETIRE_AFTER_RUNS_WITH_ZERO_RELEVANT = 3;

export type CampaignQueryRow = typeof schema.campaignQueries.$inferSelect;

export function scoreCampaignQuery(q: CampaignQueryRow): number {
  if (q.runs === 0) return q.pinned ? 1000 : 10;
  const weighted = q.relevantCount + q.savedCount * 2 - q.rejectedCount * 0.5;
  const rate = weighted / q.runs;
  return (q.pinned ? 100 : 0) + rate;
}

export function rankCampaignQueries(queries: CampaignQueryRow[]): CampaignQueryRow[] {
  return [...queries]
    .filter((q) => q.status === 'active')
    .sort((a, b) => scoreCampaignQuery(b) - scoreCampaignQuery(a));
}

export function selectQueriesForScout(
  queries: CampaignQueryRow[],
  maxQueries = MAX_QUERIES_PER_SCOUT
): CampaignQueryRow[] {
  const active = queries.filter((q) => q.status === 'active');
  if (active.length <= maxQueries) return rankCampaignQueries(active);

  const selected: CampaignQueryRow[] = [];
  const usedIds = new Set<string>();
  const add = (q: CampaignQueryRow) => {
    if (selected.length >= maxQueries || usedIds.has(q.id)) return;
    usedIds.add(q.id);
    selected.push(q);
  };

  // 1. Pinned queries always run
  for (const q of active.filter((item) => item.pinned)) {
    add(q);
  }

  // 2. Top 2 by hit rate among queries that have already run
  const testedByHitRate = active
    .filter((q) => !usedIds.has(q.id) && q.runs > 0)
    .sort((a, b) => scoreCampaignQuery(b) - scoreCampaignQuery(a));
  for (const q of testedByHitRate.slice(0, 2)) {
    add(q);
  }

  // 3. 2 least-run / untested queries (rotation so untested queries always get explored)
  const leastRun = active
    .filter((q) => !usedIds.has(q.id))
    .sort((a, b) => a.runs - b.runs || scoreCampaignQuery(b) - scoreCampaignQuery(a));
  for (const q of leastRun.slice(0, 2)) {
    add(q);
  }

  // 4. Fill any remaining slots (e.g. when < 2 tested queries exist yet) with least-run/ranked
  for (const q of leastRun) {
    add(q);
  }

  return selected;
}

export async function seedCampaignQueries(
  db: Database,
  campaignId: string,
  userId: string,
  specs: CandidateQuerySpec[]
): Promise<CampaignQueryRow[]> {
  const now = new Date().toISOString();
  const inserted: CampaignQueryRow[] = [];
  const seen = new Set<string>();

  for (const spec of specs) {
    const clean = spec.queryText.replace(/\s+/g, ' ').trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);

    const row: typeof schema.campaignQueries.$inferInsert = {
      id: `cq_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
      campaignId,
      userId,
      queryText: clean,
      tier: spec.tier,
      pinned: false,
      status: 'active',
      runs: 0,
      articlesReturned: 0,
      relevantCount: 0,
      savedCount: 0,
      rejectedCount: 0,
      lastRunAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(schema.campaignQueries).values(row);
    inserted.push(row as CampaignQueryRow);
  }
  return inserted;
}

export async function recordQueryRun(
  db: Database,
  queryId: string,
  articlesReturned: number,
  relevantCount: number
): Promise<void> {
  const existing = await db.query.campaignQueries.findFirst({
    where: eq(schema.campaignQueries.id, queryId),
  });
  if (!existing) return;

  const now = new Date().toISOString();
  await db
    .update(schema.campaignQueries)
    .set({
      runs: existing.runs + 1,
      articlesReturned: existing.articlesReturned + articlesReturned,
      relevantCount: existing.relevantCount + relevantCount,
      lastRunAt: now,
      updatedAt: now,
    })
    .where(eq(schema.campaignQueries.id, queryId));
}

export async function recordQuerySignalOutcome(
  db: Database,
  queryId: string | null | undefined,
  outcome: 'saved' | 'rejected'
): Promise<void> {
  if (!queryId) return;
  const existing = await db.query.campaignQueries.findFirst({
    where: eq(schema.campaignQueries.id, queryId),
  });
  if (!existing) return;

  await db
    .update(schema.campaignQueries)
    .set({
      savedCount: outcome === 'saved' ? existing.savedCount + 1 : existing.savedCount,
      rejectedCount: outcome === 'rejected' ? existing.rejectedCount + 1 : existing.rejectedCount,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.campaignQueries.id, queryId));
}

const VARIANT_TRIGGERS = ['breach', 'ransomware', 'AI', 'funding', 'expansion', 'regulation', 'CISO', 'new office'];

/**
 * Build a replacement variant by changing one term or widening city -> province/state
 * by at most one step for local businesses.
 */
export function buildQueryVariant(
  retiredQuery: string,
  location: string,
  serviceArea: 'local' | 'national',
  existingTexts: Set<string>
): string | null {
  const tokens = retiredQuery.split(/\s+/).filter(Boolean);
  const { city, region } = parseCityRegion(location);

  // 1. Widen city -> province/state (at most one step for local)
  if (serviceArea === 'local' && city && region && retiredQuery.toLowerCase().includes(city.toLowerCase())) {
    const widened = retiredQuery.replace(new RegExp(`\\b${city}\\b`, 'i'), region).replace(/\s+/g, ' ').trim();
    if (widened && !existingTexts.has(widened.toLowerCase())) return widened;
  }

  // 2. Swap or add one trigger term
  for (const trig of VARIANT_TRIGGERS) {
    if (retiredQuery.toLowerCase().includes(trig.toLowerCase())) continue;
    const base = tokens.length >= 3 ? tokens.slice(0, tokens.length - 1) : tokens;
    const candidate = [...base, trig].join(' ').replace(/\s+/g, ' ').trim();
    if (candidate && !existingTexts.has(candidate.toLowerCase())) return candidate;
  }

  // 3. Drop last term if >= 3 tokens
  if (tokens.length >= 3) {
    const dropped = tokens.slice(0, -1).join(' ').trim();
    if (dropped && !existingTexts.has(dropped.toLowerCase())) return dropped;
  }

  return null;
}

/**
 * Retire unpinned queries with 0 relevant leads after 3+ runs and replace each
 * with a new variant.
 */
export async function retireAndReplaceQueries(
  db: Database,
  campaign: { id: string; userId: string; targetLocation?: string | null; serviceArea?: string | null }
): Promise<{ retiredCount: number; addedCount: number }> {
  const allRows = await db.query.campaignQueries.findMany({
    where: eq(schema.campaignQueries.campaignId, campaign.id),
  });
  const existingTexts = new Set(allRows.map((r) => r.queryText.toLowerCase()));
  const toRetire = allRows.filter(
    (r) =>
      r.status === 'active' &&
      !r.pinned &&
      r.runs >= RETIRE_AFTER_RUNS_WITH_ZERO_RELEVANT &&
      r.relevantCount === 0
  );

  let retiredCount = 0;
  let addedCount = 0;
  const now = new Date().toISOString();
  const serviceArea: 'local' | 'national' = campaign.serviceArea === 'national' ? 'national' : 'local';

  for (const row of toRetire) {
    await db
      .update(schema.campaignQueries)
      .set({ status: 'retired', updatedAt: now })
      .where(and(eq(schema.campaignQueries.id, row.id), eq(schema.campaignQueries.campaignId, campaign.id)));
    retiredCount++;

    const variant = buildQueryVariant(row.queryText, campaign.targetLocation || '', serviceArea, existingTexts);
    if (variant) {
      existingTexts.add(variant.toLowerCase());
      await db.insert(schema.campaignQueries).values({
        id: `cq_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`,
        campaignId: campaign.id,
        userId: campaign.userId,
        queryText: variant,
        tier: 'variant',
        pinned: false,
        status: 'active',
        runs: 0,
        articlesReturned: 0,
        relevantCount: 0,
        savedCount: 0,
        rejectedCount: 0,
        lastRunAt: null,
        createdAt: now,
        updatedAt: now,
      });
      addedCount++;
    }
  }

  return { retiredCount, addedCount };
}
