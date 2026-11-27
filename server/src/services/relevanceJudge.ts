import type { QueryPlannerInput } from './aiQueryPlanner';
import { buildFallbackCustomerModel, type CustomerModel } from './customerModel';
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
  businessType?: string;
  businessSize?: string;
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

function computeKeywordFitScore(
  profile: QueryPlannerInput,
  title: string,
  text: string,
  customerModel?: CustomerModel
): {
  fitScore: number;
  triggerType: string;
  triggerSentence: string;
  whyMatched: string;
  locationOk: boolean;
} {
  const model = customerModel || buildFallbackCustomerModel(profile);
  const haystack = `${title} ${text}`.toLowerCase();
  const stop = new Set(['and', 'the', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'our', 'services', 'solutions', 'company', 'business', 'businesses', 'firm', 'firms', 'small', 'mid', 'sized']);

  const hasTerm = (term: string) =>
    new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack);

  const signalCandidates = [
    ...model.buyingSignals,
    ...(profile.targetTriggers || []),
  ].filter((t) => t.trim().length >= 3);

  const matchedSignal =
    signalCandidates.find((t) => hasTerm(t.trim())) ||
    signalCandidates.find((t) =>
      t
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .some((w) => w.length >= 4 && !stop.has(w) && hasTerm(w))
    ) ||
    '';

  const place = (profile.location || '').toLowerCase().split(',')[0].trim();
  const region = ((profile.location || '').split(',')[1] || '').toLowerCase().trim();
  const locationOk = Boolean(
    profile.allowNationalSearch ||
      model.serviceArea === 'national' ||
      !place ||
      haystack.includes(place) ||
      (region && haystack.includes(region))
  );

  if (!matchedSignal) {
    return {
      fitScore: locationOk ? 32 : 15,
      triggerType: 'none',
      triggerSentence: '',
      whyMatched: `No buying signal from the customer model found in "${title.slice(0, 70)}".`,
      locationOk,
    };
  }

  const sectorTokens = [
    ...new Set(
      [
        ...model.idealCustomerTypes,
        ...(profile.buyerIndustries || []),
        ...(profile.targetIndustries || []),
      ]
        .join(' ')
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length >= 3 && !stop.has(w))
    ),
  ];
  const matchedSectorTokens = sectorTokens.filter((tok) => haystack.includes(tok));

  let score = 0;
  if (locationOk) score += 35;
  score += 35;
  score += Math.min(25, matchedSectorTokens.length * 10);

  const triggerSentence = findTriggerSentence(`${title}. ${text}`, [matchedSignal.toLowerCase()]);
  const primaryService = (profile.servicesOffered && profile.servicesOffered[0]) || profile.valueProp || profile.userMission || 'your services';
  const whyMatched = `Article reports a ${matchedSignal} signal ("${title.slice(0, 75)}"), aligning with ${primaryService}.`;

  return {
    fitScore: Math.min(98, score),
    triggerType: matchedSignal,
    triggerSentence,
    whyMatched,
    locationOk,
  };
}

function keywordJudgment(
  profile: QueryPlannerInput,
  title: string,
  text: string,
  publisher: string,
  customerModel?: CustomerModel
): RelevanceJudgment {
  const relevantByRules = isRelevantToProfile(profile, title, text, publisher);
  const { fitScore, triggerType, triggerSentence, whyMatched, locationOk } = computeKeywordFitScore(profile, title, text, customerModel);
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
 * gpt-4o-mini judgment of a crawled article against the CustomerModel.
 * Keyword overlap is only the fallback when OpenAI is unavailable.
 */
export async function judgeArticleRelevance(
  profile: QueryPlannerInput,
  article: { title: string; publisher?: string; text: string },
  openAiApiKey?: string,
  customerModel?: CustomerModel
): Promise<RelevanceJudgment> {
  const model = customerModel || buildFallbackCustomerModel(profile);
  const cleanKey = (openAiApiKey || '').trim();
  if (!cleanKey || !cleanKey.startsWith('sk-') || cleanKey.includes('your_')) {
    return keywordJudgment(profile, article.title, article.text, article.publisher || '', model);
  }

  const offering = (profile.servicesOffered || []).join(', ') || profile.userMission || profile.valueProp || 'B2B services';
  const locationLabel = profile.location || 'target area';

  const systemPrompt = `You judge whether the business in an article is a plausible customer for ${offering} in ${locationLabel}, per the provided Customer Model.
Answer one core question: "Is the business in this article a plausible customer for ${offering} in ${locationLabel}, per this customer model? Name the business, its type and size, and the reason to reach out."

Respond with JSON only:
{
  "relevant": true,
  "fitScore": 84,
  "buyerCompany": "The single operating business that could buy from the seller, or empty string",
  "businessType": "Type/industry of that business, or empty string",
  "businessSize": "Estimated size (e.g. local SMB, mid-market, enterprise), or empty string",
  "triggerType": "Short label for the buying signal / reason to reach out, or none",
  "triggerSentence": "Exact verbatim sentence from the article showing the reason to reach out, or empty string",
  "whyMatched": "One specific sentence naming the business, its type/size, and why it needs ${offering} right now.",
  "relevantReason": "One sentence",
  "locationMatch": true,
  "locationReason": "One sentence naming the places",
  "buyerPersonaMatch": true,
  "buyerPersonaReason": "One sentence on whether this business fits the customer model",
  "triggerEvent": "Short description of the reason to reach out, or empty string",
  "namedPerson": "A person employed at that same business, or empty string",
  "evidenceQuotes": ["Short verbatim quotes from the article proving the business, the reason to reach out, and any named person"]
}

Rules:
- Reject vendors/competitors offering the same thing as the seller, media/news outlets, and organizations outside the Customer Model (score under 40, relevant=false).
- Score fitScore from 0 to 100 based on: (a) fit with the Customer Model's idealCustomerTypes and customerSize, (b) presence of a concrete reason to reach out (buyingSignals or equivalent timely need), and (c) location match.
- relevant is true ONLY when fitScore >= 60, locationMatch holds, buyerPersonaMatch holds, and an operating customer business is identified with a triggerSentence.
- A named person in the article is NOT required.
- A roundup naming several different businesses is not a match; GoFundMe/personal charity drives are not matches.
- For local offerings, the article must connect the business to the target city or province/state.`;

  const userPrompt = `SELLER OFFERING: ${offering}
LOCATION: ${locationLabel} (national widening allowed: ${model.serviceArea === 'national' || profile.allowNationalSearch ? 'yes' : 'no'})

CUSTOMER MODEL:
- Ideal customer types: ${model.idealCustomerTypes.join(', ')}
- Customer size: ${model.customerSize}
- Reason to buy / buying signals: ${model.buyingSignals.join(', ')}

ARTICLE:
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
      const errText = await response.text().catch(() => '');
      console.warn(`[Relevance] gpt-4o-mini returned ${response.status}: ${errText.slice(0, 120)}`);
      return {
        relevant: false,
        fitScore: 0,
        whyMatched: `Unscored (judge HTTP ${response.status}).`,
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
      businessType: parsed.businessType || '',
      businessSize: parsed.businessSize || '',
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
