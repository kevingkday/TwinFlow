/**
 * AI News Query Planner Service (Powered by GPT-4o)
 * Analyzes free-form user mission, intent, and location to synthesize
 * high-precision Google News queries that strike the perfect balance between
 * specificity (not generic 1-word queries) and recall (not 0-result over-constrained sentences).
 */

export interface QueryPlannerInput {
  location?: string;
  userIntent?: string;
  userMission?: string;
  targetIndustries?: string[];
  targetTriggers?: string[];
  valueProp?: string;
  companyDescription?: string;
  servicesOffered?: string[];
  productsOffered?: string[];
  website?: string;
}

export interface QueryPlanResult {
  primaryQuery: string;
  fallbackQueries: string[];
  geographicFocus: {
    locationClean: string;
    gl: string; // Google country code e.g. 'us', 'ca', 'gb'
    metroOrRegion: string;
  };
  missionSummary: string;
  recommendedPitchAngle: string;
  modelUsed: string;
}

export async function planNewsQueryWithAI(
  input: QueryPlannerInput,
  openAiApiKey?: string
): Promise<QueryPlanResult> {
  const cleanKey = (openAiApiKey || '').trim();
  const location = (input.location || '').trim();
  const mission = (input.userMission || '').trim();
  const intent = (input.userIntent || 'sales_client_acquisition').trim();
  const industries = (input.targetIndustries || []).filter(Boolean);
  const triggers = (input.targetTriggers || []).filter(Boolean);
  const valueProp = (input.valueProp || '').trim();

  // Determine default country code from location
  const locLower = location.toLowerCase();
  let defaultGl = 'us';
  if (
    locLower.includes('canada') ||
    locLower.includes('british columbia') ||
    locLower.includes('alberta') ||
    locLower.includes('ontario') ||
    locLower.includes(', bc') ||
    locLower.includes(', on') ||
    locLower.includes(', ab') ||
    locLower.includes('vancouver') ||
    locLower.includes('toronto') ||
    locLower.includes('montreal') ||
    locLower.includes('calgary') ||
    locLower.includes('edmonton') ||
    locLower.includes('ottawa')
  ) {
    defaultGl = 'ca';
  } else if (
    locLower.includes('uk') ||
    locLower.includes('united kingdom') ||
    locLower.includes('london') ||
    locLower.includes('manchester')
  ) {
    defaultGl = 'gb';
  }

  // If live OpenAI key is available, use GPT-4o for nuanced semantic query planning
  if (cleanKey && cleanKey.startsWith('sk-') && !cleanKey.includes('your_')) {
    try {
      const systemPrompt = `You are an elite Google News intelligence architect and B2B search strategist.
Your task is to analyze a user's location, commercial intent, and free-form mission description, and generate high-precision Google News queries that uncover actionable business catalysts.

CRITICAL RULES FOR GOOGLE NEWS SEARCH QUERIES:
1. THE PRODUCT NEEDS A NAMED PERSON, NOT A TREND PIECE:
   - The buyer will email one human mentioned in the article. Queries must favor headlines that name someone.
   - High-yield article types: leadership appointment ("appointed", "named", "hires", "joins as"), contract award, groundbreaking, facility expansion, headquarters lease, funding that names a founder or CFO.
   - Low-yield types to exclude with minus terms: wire roundups, listicles, "top 10", "what to know", weekly recaps, stock movers, aggregator reprints.
   - Every query must include when:14d so results are from the last two weeks.
   - Use a short geo anchor + one industry keyword + an OR group. OR groups and when:14d may push the query past 6 words. Do not write a full sentence.
   - Example primary: Vancouver cybersecurity ("appointed" OR "named" OR "hires") when:14d -roundup -"top 10"
   - Example project fallback: Calgary construction ("breaks ground" OR "awarded") when:14d -roundup
   - Example people fallback: Dallas "commercial real estate" (CEO OR founder OR president) when:14d

2. INTENT ALIGNMENT:
   - "sales_client_acquisition": Companies appointing executives, opening sites, winning contracts, or raising money in the seller's industry.
   - "subcontractor_partners": Commercial project awards, groundbreakings, and facility expansions that name an owner or project lead.
   - "job_seeking": Companies appointing leadership or opening a regional hub.
   - "investing": Funding, acquisitions, and succession that name a founder, CEO, or CFO.

You must respond with valid JSON adhering to this schema:
{
  "primaryQuery": "Best 3-6 word Google News query",
  "fallbackQueries": [
    "Slightly broader alternative query",
    "Alternative trigger angle query"
  ],
  "geographicFocus": {
    "locationClean": "City, State or Country",
    "gl": "us" | "ca" | "gb" | "au",
    "metroOrRegion": "Primary metro or region name"
  },
  "missionSummary": "One crisp sentence explaining what the user is hunting for",
  "recommendedPitchAngle": "Strategic guidance for drafting cold outreach for this specific mission"
}`;

      const userPrompt = `USER PROFILE & SEARCH MISSION:
- Target Location / Geography: ${location || 'Nationwide US'}
- User Intent: ${intent}
- Company Description / Bio: ${input.companyDescription || 'Commercial business'}
- Services Offered: ${input.servicesOffered && input.servicesOffered.length > 0 ? input.servicesOffered.join(', ') : 'Not specified'}
- Products Offered: ${input.productsOffered && input.productsOffered.length > 0 ? input.productsOffered.join(', ') : 'Not specified'}
- Website: ${input.website || 'Not specified'}
- Free-form Description / What they do or seek:
"${mission || valueProp || (industries.length > 0 ? `Targeting ${industries.join(', ')}` : 'B2B commercial growth')}"
- Selected Industries: ${industries.length > 0 ? industries.join(', ') : 'Not specified'}
- Selected Triggers: ${triggers.length > 0 ? triggers.join(', ') : 'Not specified'}
- Core Value Proposition: ${valueProp || 'Commercial solutions provider'}

Generate the structured JSON query plan using the Goldilocks rule, ensuring the query targets buyer companies experiencing market triggers who need the specific services and products listed above.`;

      // Try flagship gpt-4o first
      let response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        }),
      });

      // Fallback to gpt-4o-mini if gpt-4o has quota or model permission issues
      let modelUsed = 'gpt-4o';
      if (!response.ok) {
        console.warn(`[AI Query Planner] gpt-4o returned ${response.status}, falling back to gpt-4o-mini`);
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
        });
        modelUsed = 'gpt-4o-mini';
      }

      if (response.ok) {
        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as QueryPlanResult;
          if (parsed.primaryQuery) {
            return {
              ...parsed,
              modelUsed,
            };
          }
        }
      }
    } catch (err) {
      console.warn('[AI Query Planner] OpenAI query synthesis failed, using algorithmic generator:', err);
    }
  }

  // Algorithmic Fallback Generator when OpenAI is unavailable
  return generateAlgorithmicQueryPlan({
    location,
    userIntent: intent,
    userMission: mission,
    targetIndustries: industries,
    targetTriggers: triggers,
    valueProp,
    defaultGl,
  });
}

export function generateAlgorithmicQueryPlan(params: {
  location: string;
  userIntent: string;
  userMission: string;
  targetIndustries: string[];
  targetTriggers: string[];
  valueProp: string;
  defaultGl: string;
}): QueryPlanResult {
  const { location, userIntent, userMission, targetIndustries, targetTriggers, defaultGl } = params;

  // Extract short city or region anchor
  let geoAnchor = '';
  if (location && !location.toLowerCase().includes('nationwide') && !location.toLowerCase().includes('remote')) {
    const parts = location.split(',')[0].trim().split(' ');
    geoAnchor = parts.slice(0, 2).join(' ');
  }

  // Extract industry anchor (first two meaningful words, not a slash-delimited list)
  let indAnchor = (targetIndustries[0] || 'commercial').replace(/&/g, ' ').split('/')[0].trim();
  indAnchor = indAnchor.split(/\s+/).slice(0, 2).join(' ');

  const personTriggers = '("appointed" OR "hires" OR "joins")';
  const projectTriggers =
    userIntent === 'subcontractor_partners'
      ? '("breaks ground" OR "awarded" OR "contract")'
      : userIntent === 'investing'
      ? '("raises" OR "acquisition" OR "appoints")'
      : '("breaks ground" OR "awarded" OR "expansion" OR "headquarters")';
  const roleTriggers =
    userIntent === 'job_seeking'
      ? '(CEO OR "vice president" OR director OR appointed OR named)'
      : '(CEO OR founder OR president OR CFO OR appointed OR named)';
  const exclude = '-roundup -"top 10" -listicle -"what to know"';
  const recent = 'when:14d';

  const primary = [geoAnchor, indAnchor, personTriggers, recent, exclude].filter(Boolean).join(' ');
  const fallback1 = [geoAnchor, indAnchor, projectTriggers, recent, '-roundup'].filter(Boolean).join(' ');
  // The third query drops the 14-day operator so a thin niche still returns
  // articles. Recency is scored separately instead of hiding every result.
  const fallback2 = [geoAnchor, `"${indAnchor}"`, roleTriggers].filter(Boolean).join(' ');

  return {
    primaryQuery: primary,
    fallbackQueries: [fallback1, fallback2],
    geographicFocus: {
      locationClean: location || 'Nationwide',
      gl: defaultGl,
      metroOrRegion: geoAnchor || 'Regional',
    },
    missionSummary:
      userMission ||
      `Finding ${indAnchor} opportunities in ${location || 'target markets'} for ${userIntent}`,
    recommendedPitchAngle:
      userIntent === 'job_seeking'
        ? 'Reach out as an experienced executive operator ready to support their regional scaling.'
        : userIntent === 'subcontractor_partners'
        ? 'Reach out as a specialized trade and vendor partner to review project specifications.'
        : 'Align your solution directly to their expansion milestone to relieve scaling bottlenecks.',
    modelUsed: 'algorithmic_fallback',
  };
}
