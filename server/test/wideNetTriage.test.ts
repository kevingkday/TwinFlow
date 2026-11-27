import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyLocationLock,
  buildLocationLock,
  buildPrWireQuery,
  buildWideNetQueries,
  generateAlgorithmicQueryPlan,
  parseCityRegion,
  PR_WIRE_SITES,
} from '../src/services/aiQueryPlanner';
import {
  extractCompanyFromHeadline,
  keywordTriageCandidates,
  triageCandidates,
  type TriageCandidate,
} from '../src/services/llmEnricher';
import { fetchWideNetCandidates } from '../src/services/serpNews';

const vancouverPlan = () =>
  generateAlgorithmicQueryPlan({
    location: 'Vancouver, British Columbia, Canada',
    userIntent: 'sales_client_acquisition',
    userMission: 'Place cyber insurance for British Columbia technology companies',
    targetIndustries: ['cybersecurity', 'insurance'],
    targetTriggers: ['Funding'],
    valueProp: 'Cyber insurance brokerage',
    defaultGl: 'ca',
    serviceArea: 'local',
  });

describe('location lock', () => {
  it('parses city and region, expanding province abbreviations', () => {
    expect(parseCityRegion('Vancouver, British Columbia, Canada')).toEqual({ city: 'Vancouver', region: 'British Columbia' });
    expect(parseCityRegion('Vancouver, BC')).toEqual({ city: 'Vancouver', region: 'British Columbia' });
    expect(parseCityRegion('Ontario, Canada')).toEqual({ city: '', region: 'Ontario' });
    expect(parseCityRegion('Dallas')).toEqual({ city: 'Dallas', region: '' });
  });

  it('builds a quoted clause for local sellers and none for national sellers', () => {
    expect(buildLocationLock('Vancouver, British Columbia, Canada').clause).toBe('("Vancouver" OR "British Columbia")');
    expect(buildLocationLock('Dallas').clause).toBe('"Dallas"');
    const national = buildLocationLock('Toronto, Ontario, Canada', 'national');
    expect(national.enforced).toBe(false);
    expect(applyLocationLock('software raises', national)).toBe('software raises');
  });

  it('injects the clause once and folds existing place mentions into it', () => {
    const lock = buildLocationLock('Vancouver, British Columbia, Canada');
    expect(applyLocationLock('technology raises', lock)).toBe('("Vancouver" OR "British Columbia") technology raises');
    expect(applyLocationLock('Vancouver technology raises', lock)).toBe('("Vancouver" OR "British Columbia") technology raises');
    const once = applyLocationLock(applyLocationLock('Vancouver technology', lock), lock);
    expect(once.match(/Vancouver/g)?.length).toBe(1);
  });

  it('keeps the location in every wide-net query and widens only events', () => {
    const plan = vancouverPlan();
    expect(plan.locationLock.enforced).toBe(true);
    const queries = buildWideNetQueries(plan.queryLadder);
    expect(queries.length).toBeGreaterThanOrEqual(2);
    for (const q of queries) {
      expect(q).toContain('("Vancouver" OR "British Columbia")');
      expect((q.match(/-NHL/g) || []).length).toBe(1);
      expect(q).toContain('-roster');
    }
    expect(queries.some((q) => /appoints OR raises|raises OR/.test(q) && q.includes('"breaks ground"'))).toBe(true);
    expect(queries.some((q) => q.includes('site:prnewswire.com'))).toBe(true);
  });

  it('builds a geo-locked PR wire query with all wire site operators and noise exclusions', () => {
    const localLock = buildLocationLock('Vancouver, British Columbia, Canada');
    const localQuery = buildPrWireQuery(localLock);
    for (const site of PR_WIRE_SITES) {
      expect(localQuery).toContain(`site:${site}`);
    }
    expect(localQuery).toContain('("Vancouver" OR "British Columbia")');
    expect(localQuery).toContain('(appoints OR expands OR acquires OR contract OR "breaks ground" OR "new facility")');
    expect(localQuery).toContain('-NHL');
    expect(localQuery).toContain('-roster');

    const nationalLock = buildLocationLock('Vancouver, British Columbia, Canada', 'national');
    const nationalQuery = buildPrWireQuery(nationalLock);
    expect(nationalQuery).toContain('site:prnewswire.com');
    expect(nationalQuery).not.toContain('Vancouver');
    expect(nationalQuery).toContain('-NHL');
  });
});

describe('wide-net SerpAPI retrieval', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests num=40 with the location lock and returns indexed candidates', async () => {
    const now = new Date().toISOString();
    const hits = Array.from({ length: 20 }, (_, i) => ({
      title: `Acme ${i} raises funding in Vancouver`,
      link: `https://news.example.org/acme-${i}`,
      source: { name: 'BIV' },
      snippet: `Vancouver startup Acme ${i} raised a seed round.`,
      date: now,
    }));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ news_results: hits }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const plan = vancouverPlan();
    const result = await fetchWideNetCandidates({
      apiKey: 'live_serp_key_123456',
      gl: 'ca',
      ladder: plan.queryLadder,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('num')).toBe('40');
    expect(url.searchParams.get('q')).toContain('("Vancouver" OR "British Columbia")');
    expect(url.searchParams.get('q')).toContain('-NHL');
    const wireUrl = new URL(String((fetchMock.mock.calls[1] as unknown[])[0]));
    expect(wireUrl.searchParams.get('q')).toContain('site:prnewswire.com');
    expect(result.queries).toHaveLength(2);
    expect(result.candidates).toHaveLength(20);
    expect(result.candidates[3]).toMatchObject({ index: 3, title: 'Acme 3 raises funding in Vancouver', publisher: 'BIV', sourceTier: 'news' });
    expect(result.candidates[0]).toHaveProperty('publishedAt');
  });

  it('blends and deduplicates news and PR wire candidates with sourceTier tags', async () => {
    const now = new Date().toISOString();
    const newsHits = [
      {
        title: 'Acme Corp Expands Vancouver Engineering Hub',
        link: 'https://news.example.org/acme-expands',
        source: { name: 'BIV' },
        snippet: 'Vancouver tech firm expands.',
        date: now,
      },
    ];
    const wireHits = [
      {
        title: 'Acme Corp Expands Vancouver Engineering Hub',
        link: 'https://www.prnewswire.com/news-releases/acme-expands.html',
        source: { name: 'PR Newswire' },
        snippet: 'Duplicate headline from PR Newswire.',
        date: now,
      },
      {
        title: 'Pacific Metals (TSX: PMET) Appoints Elena Vance as CFO in Vancouver',
        link: 'https://www.globenewswire.com/news-release/pacific-metals-cfo',
        source: { name: 'GlobeNewswire' },
        snippet: 'Vancouver-based Pacific Metals appoints Elena Vance as Chief Financial Officer.',
        date: now,
      },
    ];
    let callIdx = 0;
    const fetchMock = vi.fn(async () => {
      const payload = callIdx === 0 ? newsHits : wireHits;
      callIdx += 1;
      return new Response(JSON.stringify({ news_results: payload }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const plan = vancouverPlan();
    const result = await fetchWideNetCandidates({
      apiKey: 'live_serp_key_123456',
      gl: 'ca',
      ladder: plan.queryLadder,
      minPool: 1,
    });

    expect(result.candidates).toHaveLength(2);
    expect(result.candidates[0]).toMatchObject({ index: 0, sourceTier: 'news' });
    expect(result.candidates[1]).toMatchObject({
      index: 1,
      sourceTier: 'pr_wire',
      publisher: 'GlobeNewswire',
    });
  });
});

describe('batch headline triage', () => {
  afterEach(() => vi.unstubAllGlobals());

  const candidates: TriageCandidate[] = [
    { index: 0, title: 'Top 10 Vancouver tech companies to watch', snippet: 'A roundup of startups.', publisher: 'Blog' },
    { index: 1, title: 'Seattle software firm Nimbus raises $20M Series A', snippet: 'Nimbus, based in Seattle, raised funding.', publisher: 'GeekWire' },
    { index: 2, title: 'Vancouver cybersecurity startup Kestrel raises $12M', snippet: 'Kestrel, a Vancouver technology company, raised a Series A.', publisher: 'BetaKit' },
    { index: 3, title: 'Opinion: B.C. needs a tech strategy', snippet: 'Commentary on provincial policy.', publisher: 'Vancouver Sun' },
    { index: 4, title: 'Burnaby, B.C. software maker appoints Dana Cho as CFO', snippet: 'The British Columbia technology company named a new CFO.', publisher: 'BIV' },
    { index: 5, title: 'Canucks add depth to NHL roster', snippet: 'Vancouver hockey news.', publisher: 'Sportsnet' },
  ];
  const profile = {
    offering: 'Cyber insurance for technology companies',
    targetIndustries: ['technology', 'cybersecurity'],
    serviceArea: 'local' as const,
    location: 'Vancouver, British Columbia, Canada',
  };

  it('keyword fallback enforces geography and rejects listicles, opinion, and sports', () => {
    const result = keywordTriageCandidates(candidates, profile, 5);
    expect(result.modelUsed).toBe('keyword_fallback');
    expect(result.selectedIndices).toEqual([2, 4]);
    expect(result.selectedIndices).not.toContain(1);
    expect(result.reasoning[2]).toMatch(/Vancouver/);
  });

  it('uses the fallback without a TypeSafe key and caps winners', async () => {
    const result = await triageCandidates(candidates, profile, 1);
    expect(result.selectedIndices).toEqual([2]);
  });

  it('lets Jev decide: hard geo gate, thresholds, ranking, and the deterministic guard', async () => {
    // Jev probabilities per candidate: [customer, noise, local]
    const probs: Record<number, [number, number, number]> = {
      1: [0.92, 0.05, 0.08], // Seattle: strong customer fit but outside service area
      2: [0.93, 0.04, 0.97], // Vancouver funding
      4: [0.85, 0.05, 0.9], // Burnaby, B.C. CFO hire
    };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const answers: Record<string, { type: 'noul'; noul: number }> = {};
      for (const name of Object.keys(body.questions)) {
        const [, idx, kind] = name.match(/^a(\d+)_(\w+)$/)!;
        const p = probs[Number(idx)] || [0.1, 0.9, 0.1];
        const value = { customer: p[0], noise: p[1], local: p[2] }[kind as 'customer'];
        answers[name] = { type: 'noul', noul: value };
      }
      return new Response(JSON.stringify({ model: 'jev-1.14.0', answers, usage: { input_tokens: 1, output_tokens: 1 } }), {
        status: 200,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await triageCandidates(candidates, profile, 5, { apiKey: 'ts_live_test_key_123' });

    // Listicle (0), opinion (3), and sports (5) are filtered before Jev; 3 remain -> 1 chunk.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer ts_live_test_key_123');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('jev-latest');
    expect(Object.keys(body.state.articles).sort()).toEqual(['1', '2', '4']);
    expect(body.questions.a2_local.instructions).toContain('Vancouver / British Columbia');
    expect(body.questions).not.toHaveProperty('a5_customer');

    expect(result.modelUsed).toBe('jev:jev-1.14.0');
    expect(result.selectedIndices).toEqual([2, 4]);
    expect(result.reasoning[2]).toMatch(/^Jev: customer 0\.93/);
  });

  it('falls back to keyword triage when Jev is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    const result = await triageCandidates(candidates, profile, 5, { apiKey: 'ts_live_test_key_123' });
    expect(result.modelUsed).toBe('keyword_fallback');
    expect(result.selectedIndices).toEqual([2, 4]);
  });

  it('keeps genuine corporate press releases and rejects stock-ticker spam / market wraps', () => {
    const prCandidates: TriageCandidate[] = [
      {
        index: 0,
        title: 'Why Pacific Tech Stock Moved Today in Vancouver',
        snippet: 'Shares rose 12% after market wrap commentary.',
        publisher: 'Yahoo Finance',
      },
      {
        index: 1,
        title: 'Pacific Tech Corp. Q3 Earnings Call Transcript',
        snippet: 'Full earnings call transcript for Vancouver investors.',
        publisher: 'Seeking Alpha',
      },
      {
        index: 2,
        title: 'Pacific Tech Inc. (TSX: PTEC) Appoints Elena Vance as CFO',
        snippet: 'Vancouver technology company Pacific Tech Inc. announced a new CFO.',
        publisher: 'GlobeNewswire',
      },
      {
        index: 3,
        title: 'Cascadia Logistics (NASDAQ: CLOG) Breaks Ground on New Facility in British Columbia',
        snippet: 'Cascadia Logistics breaks ground on a new distribution facility in Burnaby, British Columbia.',
        publisher: 'Business Wire',
      },
    ];

    const result = keywordTriageCandidates(prCandidates, profile, 5);
    expect(result.selectedIndices).toEqual([2, 3]);
    expect(extractCompanyFromHeadline(prCandidates[2].title)).toBe('Pacific Tech Inc.');
    expect(extractCompanyFromHeadline(prCandidates[3].title)).toBe('Cascadia Logistics');
  });
});
