import type { QueryPlannerInput } from './aiQueryPlanner';
import { isRelevantToProfile } from './signalQuality';

export interface RelevanceJudgment {
  relevant: boolean;
  relevantReason: string;
  locationMatch: boolean;
  locationReason: string;
  buyerPersonaMatch: boolean;
  buyerPersonaReason: string;
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

Rules:
- relevant is true only when locationMatch and buyerPersonaMatch are both true, and the story is a real company event (hire, funding, lease, contract, expansion, captive formation), not a listicle or charity drive.
- A commercial real estate brokerage hiring brokers, or a tenant signing a lease, in the user's city IS a buyer match for a commercial real estate broker.
- A software company raising a Series round in the user's market IS a buyer match for a B2B SaaS marketing agency.
- An insurer, brokerage, or tech firm appointing a CFO, CISO, or chief risk officer IS a buyer match for a cyber or captive insurance broker when the geography matches.
- A contractor cares about groundbreakings and awarded commercial projects in their region.
- GoFundMe, personal crowdfunding, and consumer charity drives are not buyer matches.
- A story set in a different metro is locationMatch false. Florida is not Dallas. Vancouver is not Toronto.
- Do not treat a keyword accident ("cyber" inside an unrelated word, or the user's city mentioned in passing) as a match.`;

  const userPrompt = `SELLER PROFILE
Location: ${profile.location || 'unspecified'}
Intent: ${profile.userIntent || 'sales_client_acquisition'}
Company: ${profile.companyDescription || ''}
Mission: ${profile.userMission || ''}
Industries: ${(profile.targetIndustries || []).join(', ')}
Triggers: ${(profile.targetTriggers || []).join(', ')}
Services: ${(profile.servicesOffered || []).join(', ')}
Products: ${(profile.productsOffered || []).join(', ')}
Value proposition: ${profile.valueProp || ''}

ARTICLE
Publisher: ${article.publisher || 'unknown'}
Headline: ${article.title}
Body:
${article.text.slice(0, 6000)}`;

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
    const locationMatch = Boolean(parsed.locationMatch);
    const buyerPersonaMatch = Boolean(parsed.buyerPersonaMatch);
    return {
      relevant: locationMatch && buyerPersonaMatch && parsed.relevant !== false,
      relevantReason: parsed.relevantReason || '',
      locationMatch,
      locationReason: parsed.locationReason || '',
      buyerPersonaMatch,
      buyerPersonaReason: parsed.buyerPersonaReason || '',
      modelUsed: 'gpt-4o-mini',
    };
  } catch (err) {
    console.warn('[Relevance] judgment failed, using keyword fallback:', err);
    return keywordJudgment(profile, article.title, article.text, article.publisher || '');
  }
}
