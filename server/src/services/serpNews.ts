/**
 * SerpAPI Google News Service Adapter
 * Queries Google News via SerpAPI and extracts article title, publisher, URL, snippet, and publish date.
 */

import { parsePublishedAtOrNull } from './publishedAt';
import {
  applyLocationLock,
  buildWideNetQueries,
  resolveLocationLock,
  WIDE_NET_EVENT_KEYWORDS,
  type LocationLock,
  type QueryLadder,
  type SearchTier,
} from './aiQueryPlanner';
import { isLowYieldArticle, isRecentPublished, isSportsArticle, withSportsExclusion } from './signalQuality';

export interface SerpArticle {
  title: string;
  publisher: string;
  url: string;
  snippet: string;
  publishedAt: string;
  query?: string;
}

/** One wide-net search hit, indexed for batch headline/snippet triage. */
export interface SerpCandidate extends SerpArticle {
  index: number;
}

/** Candidates requested per SerpAPI call. One credit, maximum recall. */
export const WIDE_NET_POOL_SIZE = 40;

const FALLBACK_NEWS_POOL: SerpArticle[] = [
  {
    title: 'Apex Commercial Partners Breaks Ground on $65M Logistics Distribution Facility in Dallas',
    publisher: 'Commercial Property Executive',
    url: 'https://cpexecutive.com/apex-breaks-ground-dallas-logistics',
    snippet: 'Apex Commercial Partners has commenced construction on a 420,000-square-foot speculative distribution facility in South Dallas, seeking regional general contracting, HVAC trade specialists, and commercial leasing partners.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    title: 'Pinnacle Orthopedic Health Opens 3 Surgical Centers Across the Pacific Northwest',
    publisher: 'Healthcare Dive',
    url: 'https://healthcaredive.com/pinnacle-orthopedic-pacific-nw-expansion',
    snippet: 'Pinnacle Orthopedic Health has expanded its regional surgical presence with three new multi-specialty centers in Seattle and Portland, appointing Dr. Karen Mitchell as Regional Practice Director.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
  },
  {
    title: 'Titan Precision Tooling Announces $18M Modernization Investment in Ohio Manufacturing Plant',
    publisher: 'IndustryWeek',
    url: 'https://industryweek.com/titan-precision-18m-plant-investment',
    snippet: 'Titan Precision Tooling revealed an $18 million capital expenditure plan to modernize automation machinery and expand component fabrication lines across its Midwestern operations.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    title: 'Grant & Sterling LLP Expands Private Wealth & Tax Practice with 4 New Managing Partners',
    publisher: 'The American Lawyer',
    url: 'https://americanlawyer.com/grant-sterling-wealth-practice-hires',
    snippet: 'National law and tax advisory firm Grant & Sterling LLP announced the lateral hire of four managing partners to head its commercial real estate and succession advisory group.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    title: 'Turner & Townsend Awarded Lead Project Management for $120M Terminal Expansion',
    publisher: 'Construction Dive',
    url: 'https://constructiondive.com/turner-townsend-terminal-expansion',
    snippet: 'Global construction consultancy Turner & Townsend has been awarded the lead program management role for a $120 million municipal terminal modernization project, managing subcontractor bidding.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    title: 'CognitiveScale Raises $36M Series B to Automate Multi-Agent Workflow Governance',
    publisher: 'TechCrunch',
    url: 'https://techcrunch.com/2026/cognitivescale-raises-36m-series-b',
    snippet: 'CognitiveScale today announced a $36 million Series B funding round led by Index Ventures to expand its enterprise agentic workflow platform and commercial sales leadership.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
  {
    title: 'FleetMatrix Lands $22M Integration Contract with 5 Major Regional Freight Carriers',
    publisher: 'FreightWaves',
    url: 'https://freightwaves.com/fleetmatrix-22m-freight-deal',
    snippet: 'FleetMatrix announced an enterprise deployment expanding into 18 regional distribution hubs across the Midwest, prompting an active search for third-party logistics and carrier partners.',
    publishedAt: new Date(Date.now() - 1000 * 60 * 360).toISOString(),
  },
];

export interface FetchSerpNewsOptions {
  /** Built-in sample headlines. Production callers must leave this false. */
  allowSampleFallback?: boolean;
  /** City, then province/state. National only when the ladder service area is national. */
  searchTiers?: SearchTier[];
  /** 2-3 terms. Fetch adds or removes one event term after each result count. At most 4 queries. */
  queryLadder?: QueryLadder;
  /**
   * Mandatory geography. Defaults to the ladder's lock. When enforced, the
   * clause is injected into every query and is never dropped while widening.
   */
  locationLock?: LocationLock;
}

const MAX_LADDER_QUERIES = 4;

const SAMPLE_ARTICLE_URLS = new Set(FALLBACK_NEWS_POOL.map((article) => article.url));

export function isSampleArticle(article: { url?: string | null }): boolean {
  return Boolean(article.url && SAMPLE_ARTICLE_URLS.has(article.url));
}

export function sampleArticles(limit = 3): SerpArticle[] {
  return FALLBACK_NEWS_POOL.slice(0, limit);
}

type NewsHit = {
  title?: string;
  link?: string;
  source?: { name?: string } | string;
  snippet?: string;
  date?: string;
};

function hasLiveSerpKey(apiKey?: string): string | null {
  const cleanKey = (apiKey || '').trim();
  return cleanKey && !cleanKey.includes('your_') && cleanKey.length > 10 ? cleanKey : null;
}

async function requestNews(
  query: string,
  apiKey: string,
  gl: string,
  tbs?: string,
  num = WIDE_NET_POOL_SIZE
): Promise<NewsHit[]> {
  const params = new URLSearchParams({
    engine: 'google_news',
    q: query,
    api_key: apiKey,
    gl,
    hl: 'en',
    num: String(num),
  });
  if (tbs) params.set('tbs', tbs);
  const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
  if (!response.ok) throw new Error(`SerpAPI error status: ${response.status}`);
  const json = (await response.json()) as { news_results?: NewsHit[] };
  return json.news_results || [];
}

/**
 * Run one SerpAPI query (two-week window, then unwindowed if empty), drop
 * sports/low-yield/stale hits, and append unique articles to `collected`.
 * Returns the raw hit count so ladders can decide whether to widen.
 */
async function runNewsQuery(
  q: string,
  label: string,
  apiKey: string,
  gl: string,
  collected: SerpArticle[],
  seen: Set<string>,
  cap: number
): Promise<number> {
  let hits = await requestNews(q, apiKey, gl, 'qdr:w2');
  let usedTbs = true;
  if (hits.length === 0) {
    console.warn(`[SerpAPI] tbs=qdr:w2 returned 0 raw results for "${q}". Retrying without tbs.`);
    hits = await requestNews(q, apiKey, gl);
    usedTbs = false;
  }
  let dateRejected = 0;
  let dateUnparsed = 0;
  let filtered = 0;
  let kept = 0;
  for (const item of hits) {
    if (collected.length >= cap) break;
    const publisherName =
      typeof item.source === 'object' && item.source !== null
        ? item.source.name || 'News Source'
        : (item.source as string) || 'News Source';
    const title = item.title || '';
    const url = item.link || '';
    if (!url || !title || isLowYieldArticle(title, publisherName, url) || isSportsArticle(title, publisherName)) {
      filtered += 1;
      continue;
    }
    const publishedAt = parsePublishedAtOrNull(item.date);
    if (!publishedAt) {
      dateUnparsed += 1;
      if (!usedTbs) {
        dateRejected += 1;
        console.warn(`[SerpAPI] unparsed date "${item.date || ''}" for "${title}"`);
        continue;
      }
    } else if (!isRecentPublished(publishedAt)) {
      dateRejected += 1;
      continue;
    }
    const titleKey = title.toLowerCase();
    if (seen.has(titleKey) || seen.has(url)) continue;
    seen.add(titleKey);
    seen.add(url);
    kept += 1;
    collected.push({
      title,
      publisher: publisherName,
      url,
      snippet: item.snippet || title,
      publishedAt: publishedAt || new Date().toISOString(),
      query: q,
    });
  }
  console.log(
    `[SerpAPI] ${label} "${q}" raw=${hits.length} dateRejected=${dateRejected} dateUnparsed=${dateUnparsed} filtered=${filtered} kept=${kept}`
  );
  return hits.length;
}

function lockedQuery(query: string, lock?: LocationLock | null): string {
  return withSportsExclusion(applyLocationLock(query, lock));
}

export async function fetchSerpNews(
  query: string,
  apiKey?: string,
  limit = 3,
  gl = 'us',
  fallbackQueries?: string[],
  options?: FetchSerpNewsOptions
): Promise<SerpArticle[]> {
  const cleanKey = hasLiveSerpKey(apiKey);
  const tiers: SearchTier[] = options?.searchTiers?.length
    ? options.searchTiers
    : [{ label: 'city', queries: [query, ...(fallbackQueries || [])].filter(Boolean) }];

  if (cleanKey) {
    const collected: SerpArticle[] = [];
    const seen = new Set<string>();
    const lock = options?.locationLock || (options?.queryLadder ? resolveLocationLock(options.queryLadder) : null);

    if (options?.queryLadder) {
      const ladder = options.queryLadder;
      // With an enforced lock the place is injected by applyLocationLock, so it is
      // never part of the droppable terms. Widening only touches event keywords.
      const placeTerm = lock?.enforced || ladder.serviceArea === 'national' ? '' : ladder.city || ladder.region;
      const eventsWide = `(${WIDE_NET_EVENT_KEYWORDS.map((word) => (/\s/.test(word) ? `"${word}"` : word)).join(' OR ')})`;
      let terms = [placeTerm, ladder.sector, ladder.trigger].filter(Boolean);
      let widened = false;
      let usedSite = false;
      const seenQueries = new Set<string>();
      for (let attempt = 0; attempt < MAX_LADDER_QUERIES && collected.length < limit; attempt += 1) {
        const q = lockedQuery(terms.join(' '), lock);
        if (seenQueries.has(q)) break;
        seenQueries.add(q);
        let raw = 0;
        try {
          raw = await runNewsQuery(q, ladder.serviceArea, cleanKey, gl, collected, seen, limit);
        } catch (err) {
          console.warn(`SerpAPI query failed for "${q}":`, err);
          break;
        }
        if (collected.length >= limit) break;
        if (raw === 0 && terms.includes(ladder.trigger) && terms.length >= 2) {
          terms = terms.filter((term) => term !== ladder.trigger);
          continue;
        }
        if (raw === 0 && !widened) {
          widened = true;
          terms = [placeTerm, ladder.sector, eventsWide].filter(Boolean);
          continue;
        }
        if (raw > 12 && !terms.includes(ladder.trigger) && !widened) {
          terms = [...terms, ladder.trigger];
          continue;
        }
        if (!usedSite && ladder.site && collected.length < limit) {
          usedSite = true;
          terms = (ladder.serviceArea === 'local'
            ? [`site:${ladder.site}`, placeTerm, ladder.sector]
            : [`site:${ladder.site}`, ladder.sector, ladder.trigger]
          ).filter(Boolean);
          continue;
        }
        break;
      }
    } else {
      for (const tier of tiers) {
        for (const q of tier.queries) {
          const finalQuery = lock ? lockedQuery(q, lock) : q;
          try {
            await runNewsQuery(finalQuery, tier.label, cleanKey, gl, collected, seen, limit);
          } catch (err) {
            console.warn(`SerpAPI query failed for "${finalQuery}":`, err);
          }
          if (collected.length >= limit) return collected;
        }
        if (collected.length >= limit) break;
      }
    }

    if (collected.length > 0) return collected.slice(0, limit);
    console.warn(`[SerpAPI] No recent articles for "${query}". Not substituting sample headlines.`);
    return [];
  }

  if (options?.allowSampleFallback) {
    return sampleArticles(limit);
  }

  console.warn(`[SerpAPI] No live key for "${query}". Returning no articles.`);
  return [];
}

export interface WideNetSearchParams {
  apiKey?: string;
  gl?: string;
  /** Planner ladder. Supplies sector/trigger terms and the default location lock. */
  ladder?: QueryLadder;
  /** Overrides the ladder lock. When enforced, every query carries its clause. */
  locationLock?: LocationLock;
  /** Free-form keywords (e.g. an ad-hoc ingest query). The location lock still applies. */
  keywords?: string;
  /** Maximum candidates returned (and `num` requested per call). Default 40. */
  poolSize?: number;
  /** Stop issuing more SerpAPI calls once this many candidates are collected. Default 15. */
  minPool?: number;
  /** Hard cap on SerpAPI queries (credits). Default 3. */
  maxQueries?: number;
  /** Built-in sample headlines when no live key exists. Production callers leave this false. */
  allowSampleFallback?: boolean;
}

export interface WideNetSearchResult {
  candidates: SerpCandidate[];
  queries: string[];
  rawCount: number;
  source: 'serpapi' | 'sample' | 'none';
}

/**
 * Wide-net retrieval: one large SerpAPI pull (num=40) per query, location
 * lock injected into every query, widening only the event keywords. Returns
 * an indexed pool for batch headline/snippet triage. Usually costs 1 credit.
 */
export async function fetchWideNetCandidates(params: WideNetSearchParams): Promise<WideNetSearchResult> {
  const poolSize = Math.max(1, Math.min(params.poolSize ?? WIDE_NET_POOL_SIZE, 100));
  const minPool = Math.min(params.minPool ?? 15, poolSize);
  const maxQueries = Math.max(1, params.maxQueries ?? 3);
  const lock = params.locationLock || (params.ladder ? resolveLocationLock(params.ladder) : null);

  const planned: string[] = [];
  if (params.keywords?.trim()) planned.push(lockedQuery(params.keywords, lock));
  if (params.ladder) planned.push(...buildWideNetQueries({ ...params.ladder, locationLock: lock || undefined }));
  if (planned.length === 0) {
    planned.push(lockedQuery(`(${WIDE_NET_EVENT_KEYWORDS.map((w) => (/\s/.test(w) ? `"${w}"` : w)).join(' OR ')})`, lock));
  }
  const queries = planned.filter((q, i, list) => list.indexOf(q) === i).slice(0, maxQueries);

  const cleanKey = hasLiveSerpKey(params.apiKey);
  if (!cleanKey) {
    if (params.allowSampleFallback) {
      const candidates = sampleArticles(poolSize).map((article, index) => ({ ...article, index }));
      return { candidates, queries, rawCount: candidates.length, source: 'sample' };
    }
    console.warn('[SerpAPI] No live key for wide-net search. Returning no candidates.');
    return { candidates: [], queries, rawCount: 0, source: 'none' };
  }

  const collected: SerpArticle[] = [];
  const seen = new Set<string>();
  const executed: string[] = [];
  let rawCount = 0;
  for (const q of queries) {
    executed.push(q);
    try {
      rawCount += await runNewsQuery(q, lock?.enforced ? 'wide-net:locked' : 'wide-net', cleanKey, params.gl || 'us', collected, seen, poolSize);
    } catch (err) {
      console.warn(`SerpAPI wide-net query failed for "${q}":`, err);
    }
    if (collected.length >= minPool) break;
  }

  const candidates = collected.slice(0, poolSize).map((article, index) => ({ ...article, index }));
  return { candidates, queries: executed, rawCount, source: 'serpapi' };
}
