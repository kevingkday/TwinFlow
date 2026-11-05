import type { QueryPlannerInput } from './aiQueryPlanner';
import { isRelevantToProfile } from './signalQuality';

export interface RelevanceJudgment {
  relevant: boolean;
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

function keywordJudgment(profile: QueryPlannerInput, title: string, text: string, publisher: string): RelevanceJudgment {
  const relevant = isRelevantToProfile(profile, title, text, publisher);
  return {
    relevant,
    relevantReason: relevant
      ? 'Keyword fallback: the headline shares the profile industry and location.'
      : 'Keyword fallback: the headline does not share the profile industry and location.',
    locationMatch: relevant,
    locationReason: 'Keyword fallback cannot separate location from industry.',
    buyerPersonaMatch: relevant,
    buyerPersonaReason: 'Keyword fallback cannot judge the buyer persona on its own.',
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
- relevant is true only when locationMatch, buyerPersonaMatch, AND an explicit chain all hold: one buyer company, a trigger event at that company, and a named person who works at that company. Each link must be backed by a quote in evidenceQuotes. If any link is missing, relevant is false.
- Judge the BUYER, not the seller's own industry. A cyber insurance broker's buyers are technology companies that just raised, expanded, or hired. A generic insurance-trade personnel move is not a match.
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

BUYER CRITERIA (judge the article against these):
Eligible industries: ${(profile.buyerIndustries || []).join(', ') || 'operating companies that would buy from this seller'}
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
    const chain = Boolean(parsed.buyerCompany && parsed.triggerEvent && parsed.namedPerson && quotes.length > 0);
    return {
      relevant: chain && locationMatch && buyerPersonaMatch,
      relevantReason: parsed.relevantReason || '',
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
