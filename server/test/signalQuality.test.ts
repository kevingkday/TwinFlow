import { describe, expect, it } from 'vitest';
import { planNewsQueryWithAI } from '../src/services/aiQueryPlanner';
import { generateHeuristicEnrichment } from '../src/services/llmEnricher';
import { fetchSerpNews, isSampleArticle } from '../src/services/serpNews';
import {
  classifyArticleType,
  extractNamedPeople,
  isLowYieldArticle,
  isNonBuyerRole,
  isRecentPublished,
  isRelevantToProfile,
  isVerifiedEmailStatus,
  nameAppearsInText,
  usableCompanyDomain,
  withSportsExclusion,
} from '../src/services/signalQuality';

const broker = {
  location: 'Vancouver, British Columbia, Canada',
  userIntent: 'sales_client_acquisition',
  userMission: 'Place cyber insurance for British Columbia technology companies',
  targetIndustries: ['cybersecurity', 'insurance'],
  targetTriggers: ['Leadership Appointment'],
};

describe('signal quality', () => {
  it('builds a recent person-naming query instead of a generic expansion query', async () => {
    const plan = await planNewsQueryWithAI(broker);
    expect(plan.modelUsed).toBe('algorithmic_fallback');
    expect(plan.primaryQuery.toLowerCase()).not.toContain('when:');
    expect(plan.primaryQuery).not.toMatch(/\bOR\b/);
    expect(plan.primaryQuery).not.toMatch(/Insurance Business|Canadian Underwriter/);
    expect((plan.primaryQuery.match(/-NHL/g) || []).length).toBe(1);
    expect(plan.primaryQuery.toLowerCase()).toContain('technology');
    expect(plan.primaryQuery).toContain('Vancouver');
    expect(plan.geographicFocus.gl).toBe('ca');
    expect(plan.searchTiers.map((tier) => tier.label)).toEqual(['city', 'region', 'country']);
    expect(plan.searchTiers.some((tier) => tier.queries.some((query) => query.includes('site:betakit.com')))).toBe(true);
    expect(withSportsExclusion(`${plan.primaryQuery}`).match(/-NHL/g)?.length).toBe(1);
  });

  it('rejects listicles and keeps a named appointment', () => {
    expect(isLowYieldArticle('Top 10 Canadian insurers to watch this week', 'Yahoo Finance')).toBe(true);
    expect(isLowYieldArticle('Lululemon appoints Heidi O\'Neill as CEO', 'Business in Vancouver')).toBe(false);
    expect(classifyArticleType('Weekly roundup: what to know in insurance')).toBe('listicle_roundup');
    expect(classifyArticleType('Lululemon appoints Heidi O\'Neill as CEO')).toBe('leadership_hire');
  });

  it('extracts only a full name printed in the article', () => {
    const named = extractNamedPeople("Lululemon appoints Heidi O'Neill as CEO based in Vancouver");
    expect(named.map((person) => person.name)).toContain("Heidi O'Neill");

    expect(extractNamedPeople('Vancouver Cybersecurity Leader Antonio Brandao Named Advisor to Operation')).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Antonio Brandao' })])
    );
    expect(extractNamedPeople("U of T's Isaac Straley named to Ontario's cybersecurity expert panel")).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Isaac Straley' })])
    );
    expect(extractNamedPeople('Parq Casino Vancouver names new CEO, expands slots')).toEqual([]);
    expect(extractNamedPeople('Former Nike executive to take over as the new CEO')).toEqual([]);
  });

  it('does not invent a decision maker when the heuristic enricher runs', () => {
    const invented = generateHeuristicEnrichment(
      'Calgary breaks ground on a recreation complex',
      'The city started construction.',
      'CityNews'
    );
    expect(invented.decisionMaker.name).toBe('');
    expect(invented.detectedContacts).toEqual([]);

    const real = generateHeuristicEnrichment(
      "Acme Cloud hires Priya Shah as CFO",
      'The software company named Priya Shah chief financial officer.',
      'BetaKit'
    );
    expect(real.decisionMaker.name).toBe('Priya Shah');
  });

  it('scores geography and industry together, and only recent dates', () => {
    expect(
      isRelevantToProfile(
        broker,
        'Too many B.C. property owners still lack earthquake cover, HDI exec warns'
      )
    ).toBe(false);
    expect(
      isRelevantToProfile(
        broker,
        'Vancouver cybersecurity firm appoints Dana Cho as CISO'
      )
    ).toBe(true);

    const now = Date.parse('2026-11-05T12:00:00.000Z');
    expect(isRecentPublished('2026-10-30T13:17:36.000Z', now)).toBe(true);
    expect(isRecentPublished('2026-07-30T07:00:00.000Z', now)).toBe(false);
  });

  it('does not substitute sample headlines unless demo mode is explicit', async () => {
    const liveEmpty = await fetchSerpNews('Vancouver cyber', undefined, 3, 'ca');
    expect(liveEmpty).toEqual([]);
    const samples = await fetchSerpNews('Vancouver cyber', undefined, 2, 'ca', undefined, { allowSampleFallback: true });
    expect(samples).toHaveLength(2);
    expect(samples.every((article) => isSampleArticle(article))).toBe(true);
  });

  it('treats only a verified Apollo status as reachable and rejects guessed domains', () => {
    expect(isVerifiedEmailStatus('verified')).toBe(true);
    expect(isVerifiedEmailStatus('guessed')).toBe(false);
    expect(isNonBuyerRole('Insurance reporter')).toBe(true);
    expect(isNonBuyerRole('Chief risk officer')).toBe(false);
    expect(usableCompanyDomain('https://www.OceanFalls.com/about')).toBe('oceanfalls.com');
    expect(usableCompanyDomain('example.com')).toBe('');
    expect(nameAppearsInText('José Muñoz', 'The board appointed José Muñoz chief executive.')).toBe(true);
  });
});
