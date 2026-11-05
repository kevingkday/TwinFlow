import { SPORTS_QUERY_EXCLUSION } from './signalQuality';

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
1. SEVERAL SHORT QUERIES, NOT ONE STACKED OR:
   - Do not put OR groups in a query. Stacked ORs return nothing for narrow niches.
   - Do not put when:14d or any when: operator in the query text. Recency is applied by the search API and a date check in code.
   - Each query is a city plus ONE quoted trigger phrase, then sports exclusions: -NHL -CFL -NFL -NBA -MLB -soccer -hockey -roster
   - Use industry-specific phrases, not generic "expansion":
     "joins as CFO", "appointed chief risk officer", "captive insurance company formed", "signs lease", "raises Series", "breaks ground"
   - One of the fallback queries should name a trade outlet for the vertical: Insurance Business, Canadian Underwriter, Bisnow, BetaKit, or ConstructConnect.
   - Example primary: Vancouver "appointed chief risk officer" -NHL -CFL -NFL -NBA -MLB -soccer -hockey -roster
   - Example fallback: Dallas "signs lease" -NHL -CFL -NFL -NBA -MLB -soccer -hockey -roster
   - Example outlet fallback: Bisnow Dallas office -NHL -CFL -NFL -NBA -MLB -soccer -hockey -roster
   - Return 3 additional fallbackQueries, each a different simple phrase.

2. INTENT ALIGNMENT:
   - "sales_client_acquisition": Companies appointing executives, opening sites, winning contracts, or raising money in the seller's industry.
   - "subcontractor_partners": Commercial project awards, groundbreakings, and facility expansions that name an owner or project lead.
   - "job_seeking": Companies appointing leadership or opening a regional hub.
   - "investing": Funding, acquisitions, and succession that name a founder, CEO, or CFO.

You must respond with valid JSON adhering to this schema:
{
  "primaryQuery": "Best 3-6 word Google News query",
  "fallbackQueries": [
    "Second simple phrase query",
    "Third simple phrase query",
    "Trade-outlet query"
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
          if (parsed.primaryQuery && !/\bOR\b/.test(parsed.primaryQuery)) {
            const clean = (value: string) =>
              `${value.replace(/\bwhen:\d+d\b/gi, ' ').replace(/\s+/g, ' ').trim()} ${SPORTS_QUERY_EXCLUSION}`
                .replace(/\s+/g, ' ')
                .trim();
            return {
              ...parsed,
              primaryQuery: clean(parsed.primaryQuery),
              fallbackQueries: (parsed.fallbackQueries || [])
                .filter((item) => item && !/\bOR\b/.test(item))
                .map(clean),
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

  let geoAnchor = '';
  if (location && !location.toLowerCase().includes('nationwide') && !location.toLowerCase().includes('remote')) {
    geoAnchor = location.split(',')[0].trim().split(' ').slice(0, 2).join(' ');
  }

  let indAnchor = (targetIndustries[0] || 'commercial').replace(/&/g, ' ').split('/')[0].trim();
  indAnchor = indAnchor.split(/\s+/).slice(0, 2).join(' ');
  const blob = `${indAnchor} ${targetIndustries.join(' ')} ${targetTriggers.join(' ')} ${userMission}`.toLowerCase();

  const q = (phrase: string) => [geoAnchor, phrase, SPORTS_QUERY_EXCLUSION].filter(Boolean).join(' ');
  const phrases: string[] = [];
  if (/captive/.test(blob)) phrases.push('"captive insurance company formed"');
  if (/cyber|msp|managed|ciso/.test(blob)) phrases.push('"appointed" CISO');
  if (/insurance|risk|cyber|captive/.test(blob)) {
    phrases.push('"joins as CFO"', '"appointed chief risk officer"', '"Insurance Business"', '"Canadian Underwriter"');
  }
  if (/lease|office|industrial|estate|bisnow|broker/.test(blob)) {
    phrases.push('"signs lease"', 'Bisnow', '"joins as" broker');
  }
  if (/software|saas|marketing|betakit/.test(blob)) {
    phrases.push('"raises Series"', 'BetaKit', '"joins as" CMO');
  }
  if (/construct|contractor|builder/.test(blob) || userIntent === 'subcontractor_partners') {
    phrases.push('"breaks ground"', 'ConstructConnect', '"awarded" contract');
  }
  if (phrases.length < 3) {
    phrases.push(`"${indAnchor}" appointed`, '"raises Series"', '"signs lease"');
  }
  const unique = [...new Set(phrases.map((phrase) => q(phrase)))];
  const primary = unique[0];
  const fallback1 = unique[1] || q('"joins as CFO"');
  const fallback2 = unique[2] || q('"raises Series"');
  const fallback3 = unique[3] || q('"breaks ground"');

  return {
    primaryQuery: primary,
    fallbackQueries: [fallback1, fallback2, fallback3],
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
