import type { QueryPlannerInput } from './aiQueryPlanner';
import { isRelevantToProfile } from './signalQuality';

export const FIT_SCORE_THRESHOLD = 60;

export interface RelevanceJudgment {
  relevant: boolean;
  fitScore: number;
  whyMatched: string;
  relevantReason: string;
  locationMatch: boolean;
  locationReason: string;
  buyerPersonaMatch: boolean;
  buyerPersonaReason: string;
  buyerCompany?: string;
  triggerEvent?: string;
  namedPerson?: string;
  evidenceQuotes?: string[];
  modelUsed: string;
}

function computeKeywordFitScore(profile: QueryPlannerInput, title: string, text: string): {
  fitScore: number;
  matchedService: string;
  matchedTrigger: string;
  locationOk: boolean;
} {
  const haystack = `${title} ${text}`.toLowerCase();
  const services = [
    ...(profile.servicesOffered || []),
    ...(profile.productsOffered || []),
    profile.userMission || '',
    profile.valueProp || '',
  ]
    .join(' ')
    .toLowerCase();

  const stop = new Set(['and', 'the', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'our', 'services', 'solutions', 'company', 'business', 'businesses', 'firm', 'firms', 'small', 'mid', 'sized']);
  const serviceTokens = [...new Set(services.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stop.has(w)))];
  const matchedServiceTokens = serviceTokens.filter((tok) => haystack.includes(tok));

  const sectorTokens = [...new Set((profile.buyerIndustries || profile.targetIndustries || []).join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stop.has(w)))];
  const matchedSectorTokens = sectorTokens.filter((tok) => haystack.includes(tok));

  const triggerTerms = ['breach', 'ransomware', 'cyber', 'ai', 'funding', 'raises', 'series', 'expansion', 'expands', 'new location', 'opens', 'contract', 'rfp', 'regulation', 'compliance', 'acquires', 'appoints', 'hires'];
  const matchedTrigger = triggerTerms.find((t) => haystack.includes(t)) || '';

  const place = (profile.location || '').toLowerCase().split(',')[0].trim();
  const locationOk = profile.allowNationalSearch || !place || haystack.includes(place) || /\bb\.?c\.?\b|british columbia/.test(haystack);

  let score = 0;
  if (locationOk) score += 30;
  if (matchedTrigger) score += 25;
  score += Math.min(25, matchedServiceTokens.length * 10);
  score += Math.min(20, matchedSectorTokens.length * 10);

  return {
    fitScore: Math.min(99, score),
    matchedService: matchedServiceTokens[0] || (profile.servicesOffered?.[0] || profile.valueProp || 'your services'),
    matchedTrigger,
    locationOk,
  };
}

function keywordJudgment(profile: QueryPlannerInput, title: string, text: string, publisher: string): RelevanceJudgment {
  const relevantByRules = isRelevantToProfile(profile, title, text, publisher);
  const { fitScore, matchedService, matchedTrigger, locationOk } = computeKeywordFitScore(profile, title, text);
  const relevant = relevantByRules && locationOk && fitScore >= FIT_SCORE_THRESHOLD;
  const whyMatched = relevant
    ? `"${title.slice(0, 70)}" shows a ${matchedTrigger || 'commercial'} trigger aligned with ${matchedService}.`
    : 'Article does not sufficiently match your target services, sectors, or location.';
  return {
    relevant,
    fitScore,
    whyMatched,
    relevantReason: whyMatched,
    locationMatch: locationOk,
    locationReason: locationOk ? 'Matches target geographic criteria.' : 'Location criteria not satisfied.',
    buyerPersonaMatch: relevant,
    buyerPersonaReason: whyMatched,
    modelUsed: 'keyword_fallback',
  };
}

/**
 * gpt-4o-mini judgment of a crawled article against the full user profile.
 * Keyword overlap is only the fallback when OpenAI is unavailable.
 */
export async function judgeArticleRelevance(
  profile: QueryPlannerInput,
  article: { title: string; publisher?: string; text: string },
  openAiApiKey?: string
): Promise<RelevanceJudgment> {
  const cleanKey = (openAiApiKey || '').trim();
  if (!cleanKey || !cleanKey.startsWith('sk-') || cleanKey.includes('your_')) {
    return keywordJudgment(profile, article.title, article.text, article.publisher || '');
  }

  const systemPrompt = `You judge whether a news article is a useful 1:1 outreach signal for one specific seller.
Read the full profile and the article. Respond with JSON only:
{
  "relevant": true,
  "fitScore": 84,
  "whyMatched": "One specific sentence naming the company/event in the article and why it needs what the seller offers.",
  "relevantReason": "One sentence",
  "locationMatch": true,
  "locationReason": "One sentence naming the places",
  "buyerPersonaMatch": true,
  "buyerPersonaReason": "One sentence on whether this company would buy what the user sells"
}

Also include:
{
  "buyerCompany": "The single operating company that could buy from the user, or empty",
  "triggerEvent": "The event at that company, or empty",
  "namedPerson": "A person employed at that same company, or empty",
  "evidenceQuotes": ["Short quotes from the article proving the company, the event, and the person"]
}

Rules:
- Score fitScore from 0 to 100 based on: (a) how directly the company/event needs the seller's specific services, (b) target sector match, (c) concrete buying trigger (funding, breach, AI rollout, new location, regulation, expansion, contract), and (d) location match. Give 0-45 to irrelevant stories (government appointments, unrelated restaurant openings, stock blurbs, sports). Only score 60+ when there is a real B2B buying fit.
- relevant is true ONLY when fitScore >= 60, locationMatch holds, buyerPersonaMatch holds, and an operating company is identified with a trigger event.
- A named person in the article is NOT required (our Apollo contact waterfall finds company executives when no person is named in the text). namedPerson can be empty and relevant can still be true.
- Judge the BUYER, not the seller's own industry. A commercial insurance broker's buyers are businesses in the target area (tech, logistics, retail, manufacturing, hospitality, professional services, etc.) that just raised funding, expanded, hired, opened a facility, or won contracts. A generic insurance-trade personnel move is not a match.
- Captive insurance consulting is stricter: the buyer must be an operating company that could own a captive. Insurance brokers, advisers, and intermediaries such as Hub International, Marsh, or Aon are never the buyer.
- Dallas law firms opening an office are tenant prospects for a commercial real estate broker. An Ontario manufacturer is a prospect for a managed IT provider.
- A commercial real estate brokerage hiring brokers, or a tenant signing a lease, in the user's city IS a buyer match for a commercial real estate broker.
- A software company raising a Series round in the user's market IS a buyer match for a B2B SaaS marketing agency.
- A contractor cares about one owner's groundbreaking or awarded project in their region.
- A roundup that names people at several different companies is not a match.
- GoFundMe, personal crowdfunding, and consumer charity drives are not buyer matches.
- A story set in a different metro is locationMatch false. Florida is not Dallas. Vancouver is not Toronto.
- Do not treat a keyword accident as a match.`;

  const userPrompt = `SELLER (context only; do not match this industry):
Location setting: ${profile.location || 'unspecified'}
National widening allowed: ${profile.allowNationalSearch ? 'yes' : 'no'}
What they sell: ${profile.userMission || profile.valueProp || ''}
Services offered: ${(profile.servicesOffered || []).join(', ') || 'not specified'}

BUYER CRITERIA (judge the article against these):
Eligible industries: ${(profile.buyerIndustries || profile.targetIndustries || []).join(', ') || 'operating companies that would buy from this seller'}
Target triggers: ${(profile.targetTriggers || []).join(', ') || 'funding, expansion, new location, breach, AI rollout, regulation'}
Roles worth contacting: ${(profile.buyerRoles || []).join(', ') || 'operator or finance leader'}
Company size: ${profile.buyerCompanySize || 'any'}
Geography rule: the article must name the city or the province/state. The word Canadian does not prove Vancouver or British Columbia. A national story matches only when national widening is allowed.

ARTICLE
Publisher: ${article.publisher || 'unknown'}
Headline: ${article.title}
Body:
${article.text.slice(0, 18000)}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cleanKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!response.ok) {
      console.warn(`[Relevance] gpt-4o-mini returned ${response.status}`);
      return keywordJudgment(profile, article.title, article.text, article.publisher || '');
    }
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return keywordJudgment(profile, article.title, article.text, article.publisher || '');
    const parsed = JSON.parse(content) as Partial<RelevanceJudgment>;
    const quotes = Array.isArray(parsed.evidenceQuotes) ? parsed.evidenceQuotes.filter((quote) => quote && quote.trim()) : [];
    const locationMatch = Boolean(parsed.locationMatch);
    const buyerPersonaMatch = Boolean(parsed.buyerPersonaMatch);
    const rawScore = typeof parsed.fitScore === 'number' ? Math.round(parsed.fitScore) : (locationMatch && buyerPersonaMatch ? 75 : 30);
    const fitScore = Math.max(0, Math.min(100, rawScore));
    const chain = Boolean(parsed.buyerCompany && parsed.triggerEvent && quotes.length > 0);
    const whyMatched = (parsed.whyMatched || parsed.buyerPersonaReason || parsed.relevantReason || '').trim();
    return {
      relevant: chain && locationMatch && buyerPersonaMatch && fitScore >= FIT_SCORE_THRESHOLD,
      fitScore,
      whyMatched,
      relevantReason: parsed.relevantReason || whyMatched,
      locationMatch,
      locationReason: parsed.locationReason || '',
      buyerPersonaMatch,
      buyerPersonaReason: parsed.buyerPersonaReason || '',
      buyerCompany: parsed.buyerCompany || '',
      triggerEvent: parsed.triggerEvent || '',
      namedPerson: parsed.namedPerson || '',
      evidenceQuotes: quotes,
      modelUsed: 'gpt-4o-mini',
    };
  } catch (err) {
    console.warn('[Relevance] judgment failed, using keyword fallback:', err);
    return keywordJudgment(profile, article.title, article.text, article.publisher || '');
  }
}
