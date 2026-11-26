import type { QueryPlannerInput } from './aiQueryPlanner';
import { isRelevantToProfile } from './signalQuality';

export const FIT_SCORE_THRESHOLD = 60;

export interface RelevanceJudgment {
  relevant: boolean;
  fitScore: number;
  whyMatched: string;
  triggerType: string;
  triggerSentence: string;
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

function findTriggerSentence(text: string, terms: string[]): string {
  const sentences = (text || '')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 15);
  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (terms.some((t) => lower.includes(t))) return s.slice(0, 260);
  }
  return sentences[0]?.slice(0, 260) || '';
}

function computeKeywordFitScore(profile: QueryPlannerInput, title: string, text: string): {
  fitScore: number;
  triggerType: string;
  triggerSentence: string;
  whyMatched: string;
  locationOk: boolean;
} {
  const haystack = `${title} ${text}`.toLowerCase();
  const sellerBlob = [
    ...(profile.servicesOffered || []),
    ...(profile.productsOffered || []),
    profile.userMission || '',
    profile.valueProp || '',
    profile.companyDescription || '',
  ]
    .join(' ')
    .toLowerCase();

  const isCyberOrAiSeller = /cyber|ai risk|ai liability|ransomware|data breach/.test(sellerBlob);
  const isMspSeller = /managed it|\bmsp\b|managed services|it support/.test(sellerBlob);

  const cyberTriggers = ['breach', 'ransomware', 'cyber', 'hack', 'malware', 'phishing', 'ai rollout', 'artificial intelligence', 'ai policy', 'ai governance', 'ciso', 'cto', 'data privacy', 'security audit', 'compliance'];
  const mspTriggers = ['it ', 'cyber', 'ransomware', 'breach', 'cloud', 'software', 'network', 'digital', 'clinic', 'law firm', 'medical', 'legal', 'new office', 'expansion', 'compliance'];
  const generalTriggers = ['funding', 'raises', 'series', 'expansion', 'expands', 'new location', 'opens', 'contract', 'rfp', 'regulation', 'compliance', 'acquires', 'appoints', 'hires'];

  const hasTerm = (term: string) => new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);

  const matchedCyber = cyberTriggers.find((t) => hasTerm(t));
  const matchedMsp = mspTriggers.find((t) => hasTerm(t.trim()));
  const matchedGeneral = generalTriggers.find((t) => hasTerm(t));

  const place = (profile.location || '').toLowerCase().split(',')[0].trim();
  const locationOk = Boolean(
    profile.allowNationalSearch ||
      !place ||
      haystack.includes(place) ||
      /\bb\.?c\.?\b|british columbia/.test(haystack)
  );

  // Strict domain calibration: if seller is cyber/AI or MSP, an article with NO relevant trigger scores under 40.
  if (isCyberOrAiSeller && !matchedCyber) {
    return {
      fitScore: locationOk ? 28 : 12,
      triggerType: 'none',
      triggerSentence: '',
      whyMatched: `No cyber or AI risk trigger found in "${title.slice(0, 70)}".`,
      locationOk,
    };
  }
  if (isMspSeller && !matchedMsp) {
    return {
      fitScore: locationOk ? 30 : 15,
      triggerType: 'none',
      triggerSentence: '',
      whyMatched: `No IT, cyber, clinic, or law-firm trigger found in "${title.slice(0, 70)}".`,
      locationOk,
    };
  }

  const matchedTrigger = (isCyberOrAiSeller ? matchedCyber : isMspSeller ? matchedMsp : matchedGeneral) || '';
  if (!matchedTrigger) {
    return {
      fitScore: locationOk ? 32 : 15,
      triggerType: 'none',
      triggerSentence: '',
      whyMatched: `No commercial buying trigger related to your services in "${title.slice(0, 70)}".`,
      locationOk,
    };
  }

  const stop = new Set(['and', 'the', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'our', 'services', 'solutions', 'company', 'business', 'businesses', 'firm', 'firms', 'small', 'mid', 'sized']);
  const sectorTokens = [...new Set((profile.buyerIndustries || profile.targetIndustries || []).join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !stop.has(w)))];
  const matchedSectorTokens = sectorTokens.filter((tok) => haystack.includes(tok));

  let score = 0;
  if (locationOk) score += 35;
  score += 35; // matched service-relevant trigger
  score += Math.min(20, matchedSectorTokens.length * 10);
  if (isCyberOrAiSeller && /breach|ransomware|cyber/.test(haystack)) score += 8;
  if (isMspSeller && /clinic|law firm|medical|legal/.test(haystack)) score += 8;

  const triggerSentence = findTriggerSentence(`${title}. ${text}`, [matchedTrigger]);
  const primaryService = (profile.servicesOffered && profile.servicesOffered[0]) || profile.valueProp || 'your services';
  const whyMatched = `Article reports a ${matchedTrigger} event ("${title.slice(0, 75)}"), creating an immediate need for ${primaryService}.`;

  return {
    fitScore: Math.min(98, score),
    triggerType: matchedTrigger,
    triggerSentence,
    whyMatched,
    locationOk,
  };
}

function keywordJudgment(profile: QueryPlannerInput, title: string, text: string, publisher: string): RelevanceJudgment {
  const relevantByRules = isRelevantToProfile(profile, title, text, publisher);
  const { fitScore, triggerType, triggerSentence, whyMatched, locationOk } = computeKeywordFitScore(profile, title, text);
  const relevant = relevantByRules && locationOk && fitScore >= FIT_SCORE_THRESHOLD;
  return {
    relevant,
    fitScore,
    whyMatched,
    triggerType,
    triggerSentence,
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
  "triggerType": "ransomware | data_breach | ai_rollout | ai_regulation | funding | expansion | new_location | leadership_hire | none",
  "triggerSentence": "Exact verbatim sentence from the article showing the trigger, or empty string if none.",
  "whyMatched": "One specific sentence naming the company, the event, and how the seller's specific service applies.",
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
- Score fitScore from 0 to 100 based on: (a) whether the article contains a concrete buying trigger DIRECTLY related to the seller's specific services, (b) target sector match, and (c) location match.
- A story with NO trigger related to the seller's services MUST score under 40 and relevant=false. For example, for a cyber/AI insurance broker, an apartment-tower construction story, a tea-merchant acquisition with no cyber/AI angle, or a transit contract dispute has NO cyber or AI trigger and MUST score under 40.
- relevant is true ONLY when fitScore >= 60, locationMatch holds, buyerPersonaMatch holds, and an operating company is identified with a triggerSentence.
- A named person in the article is NOT required (Apollo finds company executives when no person is named).
- Judge the BUYER, not the seller's own industry. A commercial insurance broker's trade press is not a buyer.
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
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
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) {
      console.warn(`[Relevance] gpt-4o-mini returned ${response.status}`);
      return {
        relevant: false,
        fitScore: 0,
        whyMatched: 'Unscored (judge unavailable).',
        triggerType: 'none',
        triggerSentence: '',
        relevantReason: `Judge HTTP ${response.status}`,
        locationMatch: false,
        locationReason: '',
        buyerPersonaMatch: false,
        buyerPersonaReason: '',
        modelUsed: 'error_rejected',
      };
    }
    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return {
        relevant: false,
        fitScore: 0,
        whyMatched: 'Unscored (empty judge response).',
        triggerType: 'none',
        triggerSentence: '',
        relevantReason: 'Empty judge response',
        locationMatch: false,
        locationReason: '',
        buyerPersonaMatch: false,
        buyerPersonaReason: '',
        modelUsed: 'error_rejected',
      };
    }
    const parsed = JSON.parse(content) as Partial<RelevanceJudgment>;
    const quotes = Array.isArray(parsed.evidenceQuotes) ? parsed.evidenceQuotes.filter((quote) => quote && quote.trim()) : [];
    const locationMatch = Boolean(parsed.locationMatch);
    const buyerPersonaMatch = Boolean(parsed.buyerPersonaMatch);
    const rawScore = typeof parsed.fitScore === 'number' ? Math.round(parsed.fitScore) : 0;
    const fitScore = Math.max(0, Math.min(100, rawScore));
    const triggerSentence = (parsed.triggerSentence || quotes[0] || '').trim();
    const chain = Boolean(parsed.buyerCompany && (parsed.triggerEvent || triggerSentence) && (quotes.length > 0 || triggerSentence));
    const whyMatched = (parsed.whyMatched || parsed.buyerPersonaReason || parsed.relevantReason || '').trim();
    return {
      relevant: chain && locationMatch && buyerPersonaMatch && fitScore >= FIT_SCORE_THRESHOLD,
      fitScore,
      whyMatched,
      triggerType: (parsed.triggerType || parsed.triggerEvent || 'none').trim(),
      triggerSentence,
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
    console.warn('[Relevance] judgment failed, rejecting unscored:', err);
    return {
      relevant: false,
      fitScore: 0,
      whyMatched: 'Unscored (judge timed out or errored).',
      triggerType: 'none',
      triggerSentence: '',
      relevantReason: 'Judge error',
      locationMatch: false,
      locationReason: '',
      buyerPersonaMatch: false,
      buyerPersonaReason: '',
      modelUsed: 'error_rejected',
    };
  }
}
