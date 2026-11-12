import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyLocationLock,
  buildLocationLock,
  buildWideNetQueries,
  generateAlgorithmicQueryPlan,
  parseCityRegion,
} from '../src/services/aiQueryPlanner';
import { keywordTriageCandidates, triageCandidates, type TriageCandidate } from '../src/services/llmEnricher';
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

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('num')).toBe('40');
    expect(url.searchParams.get('q')).toContain('("Vancouver" OR "British Columbia")');
    expect(url.searchParams.get('q')).toContain('-NHL');
    expect(result.candidates).toHaveLength(20);
    expect(result.candidates[3]).toMatchObject({ index: 3, title: 'Acme 3 raises funding in Vancouver', publisher: 'BIV' });
    expect(result.candidates[0]).toHaveProperty('publishedAt');
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
    // Jev probabilities per candidate: [trigger, fit, noise, local]
    const probs: Record<number, [number, number, number, number]> = {
      1: [0.95, 0.9, 0.05, 0.08], // Seattle: strong trigger/fit but outside service area
      2: [0.93, 0.92, 0.04, 0.97], // Vancouver funding
      4: [0.9, 0.7, 0.05, 0.9], // Burnaby, B.C. CFO hire
    };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      const answers: Record<string, { type: 'noul'; noul: number }> = {};
      for (const name of Object.keys(body.questions)) {
        const [, idx, kind] = name.match(/^a(\d+)_(\w+)$/)!;
        const p = probs[Number(idx)] || [0.1, 0.1, 0.9, 0.1];
        const value = { trigger: p[0], fit: p[1], noise: p[2], local: p[3] }[kind as 'trigger'];
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
    expect(body.questions).not.toHaveProperty('a5_trigger');

    expect(result.modelUsed).toBe('jev:jev-1.14.0');
    expect(result.selectedIndices).toEqual([2, 4]);
    expect(result.reasoning[2]).toMatch(/^Jev: trigger 0\.93/);
  });

  it('falls back to keyword triage when Jev is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    const result = await triageCandidates(candidates, profile, 5, { apiKey: 'ts_live_test_key_123' });
    expect(result.modelUsed).toBe('keyword_fallback');
    expect(result.selectedIndices).toEqual([2, 4]);
  });
});
