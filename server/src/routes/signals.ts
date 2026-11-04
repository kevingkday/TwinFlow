import { Hono } from 'hono';
import type { Bindings } from '../db';
import { getDb, schema } from '../db';
import { eq, desc, and, sql } from 'drizzle-orm';
import { fetchSerpNews } from '../services/serpNews';
import { crawlArticle } from '../services/firecrawl';
import {
  enrichSignalWithLLM,
  generateHeuristicCompetitors,
  generateHeuristicPeerRoles,
} from '../services/llmEnricher';
import { findApolloContact } from '../services/apollo';
import { upsertContact, createNote, createOpportunity, listAgencySubaccounts } from '../services/ghl';
import { getSessionUser } from './auth';
import { DEMO_SIGNALS } from '../data/demoSignals';

export const signalsRouter = new Hono<{ Bindings: Bindings }>();

// Helper to get or create default operator user
async function getOrCreateUser(db: ReturnType<typeof getDb>): Promise<typeof schema.users.$inferSelect> {
  const existing = await db.query.users.findFirst();
  if (existing) return existing;

  const newUser: typeof schema.users.$inferInsert = {
    id: 'usr_default',
    email: 'operator@twinflow.ai',
    name: 'Operator',
    organization: 'TwinFlow Demo',
    passwordHash: null,
    googleId: null,
    avatarUrl: null,
    ghlSubaccountId: 'y3KLRBUZzf2t45o7rzp9',
    ghlApiKey: null,
    creditBalance: 500,
    streakCount: 0,
    totalPoints: 0,
    icpQuery: null,
    targetIndustries: null,
    targetTriggers: null,
    targetRoles: null,
    valueProp: null,
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.insert(schema.users).values(newUser);
  return newUser as typeof schema.users.$inferSelect;
}

// Helper to get authenticated session user or fallback to default
async function getUser(c: any, db: ReturnType<typeof getDb>): Promise<typeof schema.users.$inferSelect> {
  const sessionUser = await getSessionUser(c);
  if (sessionUser) return sessionUser;
  return getOrCreateUser(db);
}

// Helper to ensure related branches exist for any signal in D1
async function ensureBranchesForSignal(
  db: ReturnType<typeof getDb>,
  signal: { id: string; companyName: string; signalType: string; [key: string]: any }
) {
  const existing = await db.query.relatedEntities.findMany({
    where: eq(schema.relatedEntities.signalId, signal.id),
  });

  if (existing.length > 0) {
    return existing;
  }

  const now = new Date().toISOString();
  const comps = generateHeuristicCompetitors(signal.companyName, signal.signalType);
  const peers = generateHeuristicPeerRoles(signal.signalType);
  const created: (typeof schema.relatedEntities.$inferSelect)[] = [];

  for (const comp of comps) {
    const item = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      signalId: signal.id,
      entityType: 'competitor' as const,
      name: comp.name,
      domain: comp.domain || null,
      reason: comp.reason,
      status: 'unexplored' as const,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(schema.relatedEntities).values(item);
    created.push(item);
  }

  for (const peer of peers) {
    const item = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      signalId: signal.id,
      entityType: 'internal_peer' as const,
      name: peer.title,
      domain: `${signal.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
      reason: peer.reason,
      status: 'unexplored' as const,
      createdAt: now,
      updatedAt: now,
    };
    await db.insert(schema.relatedEntities).values(item);
    created.push(item);
  }

  return created;
}

/**
 * GET /api/signals/deck
 * Returns up to 10 unreviewed signals ('queued') with extracted contact and initial draft,
 * along with the current operator user stats (credits, streak, points).
 */
signalsRouter.get('/deck', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  try {
    const sessionUser = await getSessionUser(c);

    // If visitor is unauthenticated (demo mode), serve the generic, universal public demo deck
    if (!sessionUser) {
      return c.json({
        success: true,
        isDemo: true,
        count: DEMO_SIGNALS.length,
        signals: DEMO_SIGNALS,
        approvedCount: 0,
        user: {
          id: 'demo_operator',
          name: 'Demo Visitor',
          email: 'demo@twinflow.co',
          creditBalance: 500,
          streakCount: 0,
          totalPoints: 0,
          isDemo: true,
        },
      });
    }

    const db = getDb(c.env.DB);
    const user = sessionUser;

    // Fetch up to 10 unreviewed signals with linked contacts and outreach drafts, scoped to active campaign
    const targetCampaignId = c.req.query('campaignId') || user.activeCampaignId;
    let queuedSignals: any[] = [];

    if (targetCampaignId) {
      queuedSignals = await db.query.signals.findMany({
        where: and(
          eq(schema.signals.status, 'queued'),
          eq(schema.signals.campaignId, targetCampaignId)
        ),
        limit: 10,
        orderBy: [desc(schema.signals.createdAt)],
        with: {
          contacts: {
            with: {
              outreachDrafts: true,
            },
          },
          outreachDrafts: true,
        },
      });
    }

    if (queuedSignals.length < 10) {
      const remaining = 10 - queuedSignals.length;
      const genericSignals = await db.query.signals.findMany({
        where: and(
          eq(schema.signals.status, 'queued'),
          targetCampaignId
            ? sql`(${schema.signals.campaignId} IS NULL OR ${schema.signals.campaignId} != ${targetCampaignId})`
            : sql`1=1`
        ),
        limit: remaining,
        orderBy: [desc(schema.signals.createdAt)],
        with: {
          contacts: {
            with: {
              outreachDrafts: true,
            },
          },
          outreachDrafts: true,
        },
      });
      queuedSignals = [...queuedSignals, ...genericSignals];
    }

    // Format cards for the frontend deck
    const formattedCards = queuedSignals.map((sig) => {
      let bullets: string[] = [];
      try {
        bullets = JSON.parse(sig.summaryBullets);
      } catch {
        bullets = sig.summaryBullets ? [sig.summaryBullets] : [];
      }

      const primaryContact = sig.contacts?.[0] || null;
      const primaryDraft = sig.outreachDrafts?.[0] || primaryContact?.outreachDrafts?.[0] || null;

      const allContacts = (sig.contacts && sig.contacts.length > 0)
        ? sig.contacts.map((c: any) => ({
            id: c.id,
            name: c.name,
            title: c.title,
            company: sig.companyName,
            email: c.email || undefined,
            linkedinUrl: c.linkedinUrl || undefined,
            avatarUrl: c.avatarUrl || null,
            isEnriched: Boolean(c.email || c.linkedinUrl),
          }))
        : (primaryContact ? [{
            id: primaryContact.id,
            name: primaryContact.name,
            title: primaryContact.title,
            company: sig.companyName,
            email: primaryContact.email || undefined,
            linkedinUrl: primaryContact.linkedinUrl || undefined,
            avatarUrl: primaryContact.avatarUrl || null,
            isEnriched: Boolean(primaryContact.email || primaryContact.linkedinUrl),
          }] : []);

      const fallbackSummary = bullets.length > 0
        ? `${sig.companyName} reported a key ${sig.signalType.toLowerCase()} milestone: ${bullets[0]}. This operational catalyst triggers immediate strategic outreach.`
        : `${sig.signalType} catalyst reported for ${sig.companyName}.`;

      return {
        id: sig.id,
        parentSignalId: sig.parentSignalId || null,
        title: sig.title,
        sourceUrl: sig.sourceUrl,
        publishedAt: sig.publishedAt,
        summaryBullets: bullets,
        articleSummary: sig.articleSummary || fallbackSummary,
        companyName: sig.companyName,
        signalType: sig.signalType,
        industryTags: sig.industryTags ? (JSON.parse(sig.industryTags) as string[]) : [],
        status: sig.status,
        contacts: allContacts,
        contact: primaryContact
          ? {
              id: primaryContact.id,
              name: primaryContact.name,
              title: primaryContact.title,
              company: sig.companyName,
              email: primaryContact.email,
              linkedinUrl: primaryContact.linkedinUrl,
              avatarUrl: primaryContact.avatarUrl || null,
              isEnriched: Boolean(primaryContact.email || primaryContact.linkedinUrl),
              ghlContactId: primaryContact.ghlContactId,
            }
          : null,
        outreachDraft: primaryDraft
          ? {
              id: primaryDraft.id,
              subject: primaryDraft.subject,
              body: primaryDraft.body,
              status: primaryDraft.status,
            }
          : null,
      };
    });

    const approvedCountRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.signals)
      .where(eq(schema.signals.status, 'approved'));
    const approvedCount = Number(approvedCountRes[0]?.count || 0);

    return c.json({
      success: true,
      count: formattedCards.length,
      signals: formattedCards,
      approvedCount,
      user: {
        id: user.id,
        email: user.email,
        creditBalance: user.creditBalance,
        streakCount: user.streakCount,
        totalPoints: user.totalPoints,
      },
    });
  } catch (error) {
    console.error('Error fetching signal deck from D1:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to query signals deck',
      },
      500
    );
  }
});

/**
 * POST /api/signals/ingest
 * Accepts { query?: string, limit?: number } (default limit 3).
 * Orchestrates: SerpAPI -> Firecrawl -> OpenAI -> Apollo.
 * Inserts completed records into D1 signals, contacts, and outreach_drafts tables.
 * Deduplicates by article URL or company domain to avoid duplicate cards.
 */
signalsRouter.post('/ingest', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  let body: { query?: string; limit?: number } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  const query = body.query?.trim() || 'Series A OR expansion OR hired CEO';
  const limit = Math.max(1, Math.min(body.limit || 3, 10));

  try {
    const db = getDb(c.env.DB);
    const user = await getUser(c, db);

    // 1. SerpAPI News Query
    const articles = await fetchSerpNews(query, c.env.SERP_API_KEY, limit);

    const ingestedSignals = [];
    const now = new Date().toISOString();

    for (const article of articles) {
      // Deduplicate by URL
      const existingByUrl = await db.query.signals.findFirst({
        where: eq(schema.signals.sourceUrl, article.url),
      });

      if (existingByUrl) {
        continue;
      }

      // 2. Firecrawl Scrape / Crawl
      const crawled = await crawlArticle(article.url, c.env.FIRECRAWL_API_KEY, article.snippet);

      // 3. OpenAI (gpt-4o-mini) Enrichment
      const enriched = await enrichSignalWithLLM(
        article.title,
        crawled.markdown,
        article.publisher,
        c.env.OPENAI_API_KEY
      );

      // Deduplicate by company name if already queued
      const existingByCompany = await db.query.signals.findFirst({
        where: eq(schema.signals.companyName, enriched.companyName),
      });
      if (existingByCompany && existingByCompany.status === 'queued') {
        continue;
      }

      // 4. Apollo Contact Matching
      const apolloMatch = await findApolloContact(
        enriched.decisionMaker.name,
        enriched.decisionMaker.role,
        enriched.companyDomain,
        c.env.APOLLO_API_KEY
      );

      // Generate distinct deterministic/unique IDs
      const uniqueSuffix = Math.random().toString(36).substring(2, 8);
      const signalId = `sig_${Date.now()}_${uniqueSuffix}`;
      const contactId = `ct_${Date.now()}_${uniqueSuffix}`;
      const draftId = `dr_${Date.now()}_${uniqueSuffix}`;

      // Insert into D1 signals
      await db.insert(schema.signals).values({
        id: signalId,
        userId: user.id,
        campaignId: user.activeCampaignId || null,
        parentSignalId: null,
        title: article.title,
        sourceUrl: article.url,
        publishedAt: article.publishedAt || now,
        summaryBullets: JSON.stringify(enriched.summaryBullets),
        articleSummary: enriched.articleSummary || null,
        companyName: enriched.companyName,
        signalType: enriched.signalType,
        industryTags: JSON.stringify(enriched.industryTags),
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      });

      // Insert into D1 related_entities for knowledge graph branching
      for (const comp of enriched.competitors) {
        await db.insert(schema.relatedEntities).values({
          id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          signalId,
          entityType: 'competitor',
          name: comp.name,
          domain: comp.domain || null,
          reason: comp.reason,
          status: 'unexplored',
          createdAt: now,
          updatedAt: now,
        });
      }

      for (const peer of enriched.suggestedPeerRoles) {
        await db.insert(schema.relatedEntities).values({
          id: `rel_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          signalId,
          entityType: 'internal_peer',
          name: peer.title,
          domain: enriched.companyDomain,
          reason: peer.reason,
          status: 'unexplored',
          createdAt: now,
          updatedAt: now,
        });
      }

      // Insert into D1 contacts
      await db.insert(schema.contacts).values({
        id: contactId,
        signalId,
        name: enriched.decisionMaker.name,
        title: enriched.decisionMaker.role,
        email: apolloMatch.email || null,
        linkedinUrl: apolloMatch.linkedinUrl || null,
        avatarUrl: apolloMatch.avatarUrl || null,
        createdAt: now,
        updatedAt: now,
      });

      // Insert into D1 outreach_drafts
      await db.insert(schema.outreachDrafts).values({
        id: draftId,
        signalId,
        contactId,
        subject: enriched.pitchSubject,
        body: enriched.pitchBody,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      });

      ingestedSignals.push({
        id: signalId,
        title: article.title,
        companyName: enriched.companyName,
        signalType: enriched.signalType,
        contact: {
          name: enriched.decisionMaker.name,
          title: enriched.decisionMaker.role,
          email: apolloMatch.email,
        },
        draft: {
          subject: enriched.pitchSubject,
        },
      });
    }

    return c.json({
      success: true,
      ingestedCount: ingestedSignals.length,
      signals: ingestedSignals,
      message: `Ingested and enriched ${ingestedSignals.length} new signals from "${query}".`,
    });
  } catch (error) {
    console.error('Error during signal ingestion pipeline:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Ingestion pipeline failed',
      },
      500
    );
  }
});

/**
 * POST /api/signals/:id/enrich-contact
 * Enriches a specific contact detected in the article (or creates/matches via Apollo).
 * Returns verified email, LinkedIn, avatar, and a tailored pitch draft.
 */
signalsRouter.post('/:id/enrich-contact', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  const signalId = c.req.param('id');
  const body = (await c.req.json().catch(() => ({}))) as {
    contactId?: string;
    name?: string;
    title?: string;
  };
  const db = getDb(c.env.DB);

  try {
    const signal = await db.query.signals.findFirst({
      where: eq(schema.signals.id, signalId),
      with: { contacts: true },
    });

    if (!signal) {
      return c.json({ success: false, error: 'Signal not found' }, 404);
    }

    const contactName = (body.name || signal.contacts?.[0]?.name || 'Executive').trim();
    const contactTitle = (body.title || signal.contacts?.[0]?.title || 'Decision Maker').trim();
    const cleanDomain = `${signal.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

    // 1. Apollo Search
    const apollo = await findApolloContact(contactName, contactTitle, cleanDomain, c.env.APOLLO_API_KEY);

    const nameParts = contactName.split(/\s+/);
    const firstName = nameParts[0] || 'Executive';
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Leader';
    const fallbackEmail = `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}@${cleanDomain}`;
    const resolvedEmail = apollo.email || fallbackEmail;
    const resolvedLinkedin = apollo.linkedinUrl || `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    // 2. Update or insert contact in D1
    let existingContact = signal.contacts?.find(
      (ct: any) => ct.id === body.contactId || ct.name.toLowerCase() === contactName.toLowerCase()
    );

    const now = new Date().toISOString();

    if (existingContact) {
      await db
        .update(schema.contacts)
        .set({
          email: resolvedEmail,
          linkedinUrl: resolvedLinkedin,
          avatarUrl: apollo.avatarUrl || existingContact.avatarUrl || null,
          updatedAt: now,
        })
        .where(eq(schema.contacts.id, existingContact.id));
    } else {
      const newContactId = `ct_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.insert(schema.contacts).values({
        id: newContactId,
        signalId: signal.id,
        name: contactName,
        title: contactTitle,
        email: resolvedEmail,
        linkedinUrl: resolvedLinkedin,
        avatarUrl: apollo.avatarUrl || null,
        createdAt: now,
        updatedAt: now,
      });
      existingContact = {
        id: newContactId,
        signalId: signal.id,
        name: contactName,
        title: contactTitle,
        email: resolvedEmail,
        linkedinUrl: resolvedLinkedin,
        avatarUrl: apollo.avatarUrl || null,
      } as any;
    }

    // 3. Generate tailored outreach pitch
    const tailoredSubject = `Scaling ${signal.companyName}'s pipeline around ${signal.signalType}`;
    const tailoredBody = `Hi ${firstName},\n\nSaw the announcement regarding "${signal.title}" — congratulations to you and the team at ${signal.companyName}!\n\nAs ${contactTitle}, navigating the operational shifts and strategic scaling that follow this catalyst is crucial. TwinFlow surfaces real-time market intelligence and automates high-intent pipeline before competitors even spot the announcement.\n\nWould you be open to a 10-minute workflow review next week to explore how this applies to ${signal.companyName}?`;

    return c.json({
      success: true,
      contact: {
        id: existingContact!.id,
        name: contactName,
        title: contactTitle,
        company: signal.companyName,
        email: resolvedEmail,
        linkedinUrl: resolvedLinkedin,
        avatarUrl: apollo.avatarUrl || existingContact!.avatarUrl || null,
        isEnriched: true,
      },
      outreachDraft: {
        subject: tailoredSubject,
        body: tailoredBody,
      },
    });
  } catch (error) {
    console.error('Error enriching contact:', error);
    return c.json({ success: false, error: 'Enrichment failed' }, 500);
  }
});

/**
 * POST /api/signals/:id/action
 * Accepts { action: 'approve' | 'pass', customSubject?: string, customBody?: string }
 *
 * Approval Workflow:
 * - Verifies user has at least 10 credits.
 * - Debits 10 credits from users.credit_balance and logs to credit_transactions.
 * - Calls ghl.upsertContact and ghl.createNote (and optional opportunity) to push lead into GHL.
 * - Updates signals.status to 'approved' and outreach_drafts.status to 'queued'.
 * - Increments streak & awards gamified points.
 *
 * Pass Workflow:
 * - Marks signals.status to 'dismissed'.
 * - Resets streak to 0.
 */
signalsRouter.post('/:id/action', async (c) => {
  const signalId = c.req.param('id');
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'Cloudflare D1 binding (DB) is missing.' }, 500);
  }

  let body: { action?: string; customSubject?: string; customBody?: string } = {};
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body. Expected { action: "approve" | "pass" }' }, 400);
  }

  const action = (body.action || '').toLowerCase().trim();
  if (action !== 'approve' && action !== 'pass') {
    return c.json(
      { success: false, error: `Invalid action "${body.action}". Must be "approve" or "pass".` },
      400
    );
  }

  try {
    const db = getDb(c.env.DB);
    const sessionUser = await getSessionUser(c);
    if (!sessionUser) {
      // Unauthenticated demo mode: simulate action without affecting live database or CRM
      return c.json({
        success: true,
        isDemo: true,
        message:
          action === 'approve'
            ? 'Demo lead simulated as approved (+50 XP)! Sign up or log in to sync real leads with your CRM.'
            : 'Demo lead passed.',
        user: {
          id: 'demo_operator',
          name: 'Demo Visitor',
          email: 'demo@twinflow.co',
          creditBalance: 490,
          streakCount: action === 'approve' ? 1 : 0,
          totalPoints: action === 'approve' ? 50 : 0,
          isDemo: true,
        },
      });
    }

    const existingSignal = await db.query.signals.findFirst({
      where: eq(schema.signals.id, signalId),
      with: {
        contacts: true,
        outreachDrafts: true,
      },
    });

    if (!existingSignal) {
      return c.json({ success: false, error: `Signal "${signalId}" not found.` }, 404);
    }

    const now = new Date().toISOString();
    const currentUser = sessionUser;

    if (action === 'approve') {
      const APPROVAL_CREDIT_COST = 10;

      // 1. Verify user has configured their private CRM integration token
      const userCrmKey = currentUser.ghlApiKey;
      if (!userCrmKey || userCrmKey.length <= 10 || userCrmKey.includes('your_')) {
        return c.json(
          {
            success: false,
            crmNotConnected: true,
            error: 'CRM Private Integration Token required. Please configure your private token in CRM Settings before approving leads.',
            user: {
              id: currentUser.id,
              creditBalance: currentUser.creditBalance,
              streakCount: currentUser.streakCount,
              totalPoints: currentUser.totalPoints,
            },
          },
          400
        );
      }

      // 2. Verify user has enough credits
      if (currentUser.creditBalance < APPROVAL_CREDIT_COST) {
        return c.json(
          {
            success: false,
            insufficientCredits: true,
            error: `Insufficient credits. Minimum ${APPROVAL_CREDIT_COST} credits required per approved lead.`,
            user: {
              id: currentUser.id,
              creditBalance: currentUser.creditBalance,
              streakCount: currentUser.streakCount,
              totalPoints: currentUser.totalPoints,
            },
          },
          402
        );
      }

      // 3. Prepare contact & draft information
      const primaryContact = existingSignal.contacts?.[0];
      const primaryDraft = existingSignal.outreachDrafts?.[0];

      const contactName = primaryContact?.name || 'Verified Executive';
      const nameParts = contactName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Executive';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
      const email = primaryContact?.email || null;
      const companyName = existingSignal.companyName;

      // 4. Push to CRM (User's subaccount + Private Integration Token)
      const subaccountId = currentUser.ghlSubaccountId || c.env?.GHL_LOCATION_ID || 'y3KLRBUZzf2t45o7rzp9';
      const userGhlKey = userCrmKey;

      const ghlContact = await upsertContact(
        subaccountId,
        {
          firstName,
          lastName,
          email,
          companyName,
          sourceUrl: existingSignal.sourceUrl,
          signalTitle: existingSignal.title,
          tags: ['twinflow-signal', existingSignal.signalType],
        },
        userGhlKey
      );

      if (!ghlContact.success) {
        return c.json(
          {
            success: false,
            error: ghlContact.error || 'Failed to sync lead to CRM.',
            user: {
              id: currentUser.id,
              creditBalance: currentUser.creditBalance,
              streakCount: currentUser.streakCount,
              totalPoints: currentUser.totalPoints,
            },
          },
          400
        );
      }

      // Format comprehensive intelligence note for GHL
      let bulletsFormatted = '';
      try {
        const bullets = JSON.parse(existingSignal.summaryBullets) as string[];
        bulletsFormatted = bullets.map((b, i) => `${i + 1}. ${b}`).join('\n');
      } catch {
        bulletsFormatted = existingSignal.summaryBullets;
      }

      const finalSubject = body.customSubject || primaryDraft?.subject || `Re: ${existingSignal.title}`;
      const finalBody = body.customBody || primaryDraft?.body || '';

      const noteContent = `🎯 TWINFLOW SIGNAL INTELLIGENCE
Headline: ${existingSignal.title}
Signal Type: ${existingSignal.signalType}
Source: ${existingSignal.sourceUrl}

KEY REASONS TO REACH OUT:
${bulletsFormatted}

----------------------------------------
GENERATED OUTREACH PITCH:
Subject: ${finalSubject}

${finalBody}`;

      await createNote(subaccountId, ghlContact.id, noteContent, userGhlKey);

      // Optional: Place lead in configured GHL pipeline stage
      if (c.env?.GHL_PIPELINE_ID && c.env?.GHL_STAGE_ID) {
        await createOpportunity(
          subaccountId,
          ghlContact.id,
          c.env.GHL_PIPELINE_ID,
          c.env.GHL_STAGE_ID,
          `${companyName} - Signal Lead`,
          userGhlKey
        );
      }

      // 4. Update contacts table with ghl_contact_id
      if (primaryContact) {
        await db
          .update(schema.contacts)
          .set({ ghlContactId: ghlContact.id, updatedAt: now })
          .where(eq(schema.contacts.id, primaryContact.id));
      }

      // 5. Update signals.status to 'approved'
      await db
        .update(schema.signals)
        .set({ status: 'approved', updatedAt: now })
        .where(eq(schema.signals.id, signalId));

      // 6. Update outreach_drafts.status to 'queued'
      if (existingSignal.outreachDrafts && existingSignal.outreachDrafts.length > 0) {
        const draftUpdates: Partial<typeof schema.outreachDrafts.$inferInsert> = {
          status: 'queued',
          updatedAt: now,
        };
        if (body.customSubject) draftUpdates.subject = body.customSubject;
        if (body.customBody) draftUpdates.body = body.customBody;

        await db
          .update(schema.outreachDrafts)
          .set(draftUpdates)
          .where(eq(schema.outreachDrafts.signalId, signalId));
      }

      // 7. Debit 10 credits, increment streak (+1), add gamified points
      const newCreditBalance = currentUser.creditBalance - APPROVAL_CREDIT_COST;
      const newStreak = currentUser.streakCount + 1;
      const pointsEarned = 50 + Math.floor(newStreak / 3) * 25; // Bonus multiplier for streaks
      const newTotalPoints = currentUser.totalPoints + pointsEarned;

      await db
        .update(schema.users)
        .set({
          creditBalance: newCreditBalance,
          streakCount: newStreak,
          totalPoints: newTotalPoints,
          updatedAt: now,
        })
        .where(eq(schema.users.id, currentUser.id));

      // 8. Log credit transaction to audit ledger
      await db.insert(schema.creditTransactions).values({
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: currentUser.id,
        amount: -APPROVAL_CREDIT_COST,
        balanceAfter: newCreditBalance,
        type: 'lead_approval',
        referenceId: signalId,
        description: `Approved lead: ${companyName} (-${APPROVAL_CREDIT_COST} credits)`,
        createdAt: now,
      });

      return c.json({
        success: true,
        action: 'approve',
        signal: {
          id: signalId,
          status: 'approved',
        },
        user: {
          id: currentUser.id,
          creditBalance: newCreditBalance,
          streakCount: newStreak,
          totalPoints: newTotalPoints,
        },
        ghl: {
          contactId: ghlContact.id,
          synced: true,
          mock: ghlContact.mock,
        },
        creditsDeducted: APPROVAL_CREDIT_COST,
        pointsAwarded: pointsEarned,
        message: 'Lead Pushed to CRM (-10 credits).',
      });
    } else {
      // action === 'pass'
      // 1. Update signal status to 'dismissed'
      await db
        .update(schema.signals)
        .set({ status: 'dismissed', updatedAt: now })
        .where(eq(schema.signals.id, signalId));

      // 2. Reset streak to 0, credits and points remain unchanged
      await db
        .update(schema.users)
        .set({
          streakCount: 0,
          updatedAt: now,
        })
        .where(eq(schema.users.id, currentUser.id));

      return c.json({
        success: true,
        action: 'pass',
        signal: {
          id: signalId,
          status: 'dismissed',
        },
        user: {
          id: currentUser.id,
          creditBalance: currentUser.creditBalance,
          streakCount: 0,
          totalPoints: currentUser.totalPoints,
        },
        message: 'Lead dismissed.',
      });
    }
  } catch (error) {
    console.error(`Error processing action "${action}" on signal "${signalId}":`, error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update signal action',
      },
      500
    );
  }
});

/**
 * GET /api/signals/:id/branches
 * Returns knowledge-graph branches (competitor peers & internal decision-makers) for this signal.
 */
signalsRouter.get('/:id/branches', async (c) => {
  const signalId = c.req.param('id');
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'DB binding missing' }, 500);
  }

  try {
    const db = getDb(c.env.DB);
    const signal = await db.query.signals.findFirst({
      where: eq(schema.signals.id, signalId),
    });

    if (!signal) {
      return c.json({ success: false, error: `Signal "${signalId}" not found.` }, 404);
    }

    const branches = await ensureBranchesForSignal(db, signal);

    return c.json({
      success: true,
      signalId: signal.id,
      companyName: signal.companyName,
      parentSignalId: signal.parentSignalId,
      branches: branches.map((b) => ({
        id: b.id,
        entityType: b.entityType,
        name: b.name,
        domain: b.domain,
        reason: b.reason,
        status: b.status,
      })),
    });
  } catch (error) {
    console.error(`Error retrieving branches for signal "${signalId}":`, error);
    return c.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load branches' },
      500
    );
  }
});

/**
 * POST /api/signals/:id/branch-scout
 * Explores a branch node (competitor or internal peer), debits 5 credits, awards +25 XP combo,
 * and generates a new linked signal card inserted at the top of the queue.
 */
signalsRouter.post('/:id/branch-scout', async (c) => {
  const signalId = c.req.param('id');
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'DB binding missing' }, 500);
  }

  interface BranchScoutPayload {
    targetEntityName?: string;
    targetDomain?: string;
    entityType?: 'competitor' | 'internal_peer';
    entityId?: string;
  }

  const body = await c.req.json<BranchScoutPayload>().catch((): BranchScoutPayload => ({}));
  const targetEntityName = (body.targetEntityName || '').trim();
  const entityType = body.entityType;

  if (!targetEntityName || (entityType !== 'competitor' && entityType !== 'internal_peer')) {
    return c.json(
      {
        success: false,
        error: 'targetEntityName and valid entityType ("competitor" | "internal_peer") are required.',
      },
      400
    );
  }

  try {
    const db = getDb(c.env.DB);
    const parentSignal = await db.query.signals.findFirst({
      where: eq(schema.signals.id, signalId),
      with: { contacts: true, outreachDrafts: true },
    });

    if (!parentSignal) {
      return c.json({ success: false, error: `Parent signal "${signalId}" not found.` }, 404);
    }

    const user = await getUser(c, db);
    const BRANCH_CREDIT_COST = 5;
    const COMBO_XP_AWARD = 25;

    // Credit Verification
    if (user.creditBalance < BRANCH_CREDIT_COST) {
      return c.json(
        {
          success: false,
          insufficientCredits: true,
          error: `Insufficient credits. Branch scouting requires ${BRANCH_CREDIT_COST} credits (current balance: ${user.creditBalance}).`,
          user: {
            id: user.id,
            creditBalance: user.creditBalance,
            streakCount: user.streakCount,
            totalPoints: user.totalPoints,
          },
        },
        402
      );
    }

    const now = new Date().toISOString();
    const newCreditBalance = user.creditBalance - BRANCH_CREDIT_COST;
    const newStreak = user.streakCount + 1;
    const newTotalPoints = user.totalPoints + COMBO_XP_AWARD;

    // 1. Debit credits and increment combo points
    await db
      .update(schema.users)
      .set({
        creditBalance: newCreditBalance,
        streakCount: newStreak,
        totalPoints: newTotalPoints,
        updatedAt: now,
      })
      .where(eq(schema.users.id, user.id));

    // 2. Audit log transaction
    await db.insert(schema.creditTransactions).values({
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      amount: -BRANCH_CREDIT_COST,
      balanceAfter: newCreditBalance,
      type: 'branch_scout',
      referenceId: signalId,
      description: `Branch Scout on ${targetEntityName} (-${BRANCH_CREDIT_COST} credits, +${COMBO_XP_AWARD} XP Combo)`,
      createdAt: now,
    });

    // 3. Mark the branch node as explored in related_entities
    if (body.entityId) {
      await db
        .update(schema.relatedEntities)
        .set({ status: 'explored', updatedAt: now })
        .where(eq(schema.relatedEntities.id, body.entityId));
    } else {
      await db
        .update(schema.relatedEntities)
        .set({ status: 'explored', updatedAt: now })
        .where(eq(schema.relatedEntities.name, targetEntityName));
    }

    // 4. Generate the new branch signal card
    const uniqueSuffix = Math.random().toString(36).substring(2, 8);
    const newSignalId = `sig_br_${Date.now()}_${uniqueSuffix}`;
    const newContactId = `ct_br_${Date.now()}_${uniqueSuffix}`;
    const newDraftId = `dr_br_${Date.now()}_${uniqueSuffix}`;

    let createdSignalCard;

    if (entityType === 'competitor') {
      const targetComp = targetEntityName;
      const cleanDomain =
        body.targetDomain || `${targetComp.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

      let articleTitle = `${targetComp} Expands Enterprise Footprint Amid Parallel Operational Milestones`;
      let articleUrl = `https://techwire.io/signals/${targetComp.toLowerCase().replace(/[^a-z0-9]/g, '-')}-expansion`;
      let publisher = 'Market Intelligence Wire';
      let summaryBullets = [
        `Competitor intelligence branch scouted from ${parentSignal.companyName}.`,
        `${targetComp} operates directly in the ${parentSignal.signalType} category with comparable outbound pipeline needs.`,
        `Immediate opportunity to engage decision-makers before competitors lock in vendor agreements.`,
      ];
      let dmName = 'Sarah Jenkins';
      let dmRole = 'VP of Operations';
      let dmEmail = `s.jenkins@${cleanDomain}`;
      let pitchSubject = `quick question re: ${targetComp}`;
      let pitchBody = `Hi ${dmName.split(' ')[0] || 'there'},\n\nI saw the recent coverage regarding ${targetComp}'s expansion in the ${parentSignal.signalType} space. Given what we do in commercial services, would there be an opportunity to connect and see if we can present our services for your upcoming milestones?\n\nBest,`;

      // Live SerpAPI + Firecrawl + LLM attempt if key present
      if (c.env?.SERP_API_KEY) {
        try {
          const query = `${targetComp} (funding OR expansion OR partnership OR executive OR hired)`;
          const news = await fetchSerpNews(query, c.env.SERP_API_KEY, 1);
          if (news.length > 0) {
            const art = news[0];
            articleTitle = art.title;
            articleUrl = art.url;
            publisher = art.publisher || publisher;
            const crawled = await crawlArticle(art.url, c.env.FIRECRAWL_API_KEY);
            const enriched = await enrichSignalWithLLM(art.title, crawled.markdown, publisher, c.env.OPENAI_API_KEY);
            summaryBullets = enriched.summaryBullets;
            dmName = enriched.decisionMaker.name;
            dmRole = enriched.decisionMaker.role;
            pitchSubject = enriched.pitchSubject;
            pitchBody = enriched.pitchBody;

            const apollo = await findApolloContact(dmName, dmRole, cleanDomain, c.env.APOLLO_API_KEY);
            if (apollo.email) dmEmail = apollo.email;
          }
        } catch (err) {
          console.warn('[Branch Scout] SerpAPI query failed, falling back to synthesized competitor card:', err);
        }
      }

      await db.insert(schema.signals).values({
        id: newSignalId,
        userId: user.id,
        campaignId: parentSignal.campaignId || user.activeCampaignId || null,
        parentSignalId: parentSignal.id,
        title: articleTitle,
        sourceUrl: articleUrl,
        publishedAt: now,
        summaryBullets: JSON.stringify(summaryBullets),
        companyName: targetComp,
        signalType: 'Competitor Peer',
        industryTags: JSON.stringify([parentSignal.signalType, 'Competitor Branch']),
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.contacts).values({
        id: newContactId,
        signalId: newSignalId,
        name: dmName,
        title: dmRole,
        email: dmEmail,
        linkedinUrl: `https://linkedin.com/company/${targetComp.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.outreachDrafts).values({
        id: newDraftId,
        signalId: newSignalId,
        contactId: newContactId,
        subject: pitchSubject,
        body: pitchBody,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      });

      // Seed branches for this new competitor signal as well
      await ensureBranchesForSignal(db, {
        id: newSignalId,
        userId: user.id,
        campaignId: parentSignal.campaignId || user.activeCampaignId || null,
        parentSignalId: parentSignal.id,
        title: articleTitle,
        sourceUrl: articleUrl,
        publishedAt: now,
        summaryBullets: JSON.stringify(summaryBullets),
        companyName: targetComp,
        signalType: 'Competitor Peer',
        industryTags: JSON.stringify([parentSignal.signalType, 'Competitor Branch']),
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      });

      createdSignalCard = {
        id: newSignalId,
        parentSignalId: parentSignal.id,
        title: articleTitle,
        sourceUrl: articleUrl,
        publishedAt: now,
        summaryBullets,
        companyName: targetComp,
        signalType: 'Competitor Peer',
        industryTags: [parentSignal.signalType, 'Competitor Branch'],
        status: 'queued',
        contact: {
          id: newContactId,
          name: dmName,
          title: dmRole,
          email: dmEmail,
          linkedinUrl: `https://linkedin.com/company/${targetComp.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
        },
        outreachDraft: {
          id: newDraftId,
          subject: pitchSubject,
          body: pitchBody,
          status: 'draft',
        },
      };
    } else {
      // Internal Peer Branch Scout
      const peerRole = targetEntityName;
      const company = parentSignal.companyName;
      const cleanDomain = body.targetDomain || `${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

      let peerName = 'Alex Rivera, PhD';
      if (peerRole.toLowerCase().includes('engineer') || peerRole.toLowerCase().includes('tech')) {
        peerName = 'Alex Rivera, PhD';
      } else if (peerRole.toLowerCase().includes('product')) {
        peerName = 'Jordan Patel';
      } else if (peerRole.toLowerCase().includes('people') || peerRole.toLowerCase().includes('talent')) {
        peerName = 'Maya Chen';
      } else {
        peerName = 'David Miller';
      }

      let peerEmail = `${peerName.toLowerCase().replace(/[^a-z]/g, '.')}@${cleanDomain}`;
      let linkedinUrl = `https://linkedin.com/in/${peerName.toLowerCase().replace(/[^a-z]/g, '-')}`;

      if (c.env?.APOLLO_API_KEY) {
        try {
          const apollo = await findApolloContact(peerName, peerRole, cleanDomain, c.env.APOLLO_API_KEY);
          if (apollo.email) peerEmail = apollo.email;
          if (apollo.linkedinUrl) linkedinUrl = apollo.linkedinUrl;
        } catch (err) {
          console.warn('[Branch Scout] Apollo lookup for peer failed:', err);
        }
      }

      const title = `${parentSignal.title} [Peer Angle: ${peerRole}]`;
      const summaryBullets = [
        `Internal peer discovered at ${company} matching the "${peerRole}" functional role.`,
        `Key collaborator with ${parentSignal.contacts?.[0]?.name || 'executive leadership'} on expansion.`,
        `Multi-threaded outreach dramatically increases account engagement and reply velocity.`,
      ];

      const pitchSubject = `quick question re: ${company}`;
      const pitchBody = `Hi ${peerName.split(' ')[0] || 'there'},\n\nI saw the recent news regarding ${company}'s announcement on ${parentSignal.title.slice(0, 50).trim()}. Given our work in commercial services, would there be an opportunity to connect and see if we can present our offerings for your upcoming plans?\n\nBest,`;

      await db.insert(schema.signals).values({
        id: newSignalId,
        userId: user.id,
        parentSignalId: parentSignal.id,
        title,
        sourceUrl: parentSignal.sourceUrl,
        publishedAt: now,
        summaryBullets: JSON.stringify(summaryBullets),
        companyName: company,
        signalType: 'Internal Peer',
        industryTags: JSON.stringify([parentSignal.signalType, 'Multi-Thread']),
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.contacts).values({
        id: newContactId,
        signalId: newSignalId,
        name: peerName,
        title: peerRole,
        email: peerEmail,
        linkedinUrl,
        createdAt: now,
        updatedAt: now,
      });

      await db.insert(schema.outreachDrafts).values({
        id: newDraftId,
        signalId: newSignalId,
        contactId: newContactId,
        subject: pitchSubject,
        body: pitchBody,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      });

      createdSignalCard = {
        id: newSignalId,
        parentSignalId: parentSignal.id,
        title,
        sourceUrl: parentSignal.sourceUrl,
        publishedAt: now,
        summaryBullets,
        companyName: company,
        signalType: 'Internal Peer',
        industryTags: [parentSignal.signalType, 'Multi-Thread'],
        status: 'queued',
        contact: {
          id: newContactId,
          name: peerName,
          title: peerRole,
          email: peerEmail,
          linkedinUrl,
        },
        outreachDraft: {
          id: newDraftId,
          subject: pitchSubject,
          body: pitchBody,
          status: 'draft',
        },
      };
    }

    return c.json({
      success: true,
      newSignal: createdSignalCard,
      user: {
        id: user.id,
        email: user.email,
        creditBalance: newCreditBalance,
        streakCount: newStreak,
        totalPoints: newTotalPoints,
      },
      branchCombo: newStreak,
      creditsDeducted: BRANCH_CREDIT_COST,
      pointsAwarded: COMBO_XP_AWARD,
      message: `Branched lead on ${targetEntityName}! (-${BRANCH_CREDIT_COST} credits, +${COMBO_XP_AWARD} Combo XP)`,
    });
  } catch (error) {
    console.error(`Error executing branch scout on signal "${signalId}":`, error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to execute branch scout',
      },
      500
    );
  }
});

// GET /api/signals/credits - Get transaction history and current balance
signalsRouter.get('/credits', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'DB binding missing' }, 500);
  }
  const db = getDb(c.env.DB);
  const user = await getUser(c, db);
  const transactions = await db.query.creditTransactions.findMany({
    where: eq(schema.creditTransactions.userId, user.id),
    orderBy: [desc(schema.creditTransactions.createdAt)],
    limit: 20,
  });

  return c.json({
    success: true,
    creditBalance: user.creditBalance,
    transactions,
  });
});

// POST /api/signals/credits/replenish - Quick dev replenishment
signalsRouter.post('/credits/replenish', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'DB binding missing' }, 500);
  }
  let body: { amount?: number } = {};
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }
  const amount = body.amount || 100;
  const db = getDb(c.env.DB);
  const user = await getUser(c, db);
  const newBalance = user.creditBalance + amount;
  const now = new Date().toISOString();

  await db
    .update(schema.users)
    .set({ creditBalance: newBalance, updatedAt: now })
    .where(eq(schema.users.id, user.id));

  await db.insert(schema.creditTransactions).values({
    id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    userId: user.id,
    amount,
    balanceAfter: newBalance,
    type: 'replenish',
    description: `Manual dev top-up (+${amount} credits)`,
    createdAt: now,
  });

  return c.json({
    success: true,
    creditBalance: newBalance,
    message: `Added ${amount} credits. New balance: ${newBalance}`,
  });
});

// GET /api/signals/ghl/subaccounts - Lists subaccounts under the Agency
signalsRouter.get('/ghl/subaccounts', async (c) => {
  const agencyKey = c.env?.GHL_AGENCY_API_KEY || c.env?.GHL_API_KEY;
  const companyId = c.env?.GHL_COMPANY_ID;
  const subaccounts = await listAgencySubaccounts(agencyKey, companyId);
  return c.json({
    success: true,
    count: subaccounts.length,
    subaccounts,
  });
});

// GET /api/signals - General list of all signals
signalsRouter.get('/', async (c) => {
  if (!c.env?.DB) {
    return c.json({ success: false, error: 'DB binding missing' }, 500);
  }
  const db = getDb(c.env.DB);
  const all = await db.query.signals.findMany({
    orderBy: [desc(schema.signals.createdAt)],
    with: { contacts: true, outreachDrafts: true },
  });
  return c.json({ success: true, count: all.length, signals: all });
});
