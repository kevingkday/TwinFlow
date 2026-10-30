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
    locLower.includes(', bc') ||
    locLower.includes(', on') ||
    locLower.includes(', ab') ||
    locLower.includes('vancouver') ||
    locLower.includes('toronto') ||
    locLower.includes('montreal') ||
    locLower.includes('calgary')
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
1. THE GOLDILOCKS PRINCIPLE (3 TO 6 WORDS MAXIMUM):
   - A single broad word (e.g. "Healthcare" or "Roofing") is a FAILURE because it only returns national political op-eds.
   - Long natural language sentences (e.g. "Commercial roofing contractor looking for new construction projects in North Texas with 50+ employees") are a FAILURE because Google News headline indexing will match zero results.
   - The optimal search query contains 3 to 6 words combining:
     [Geographic Anchor (if local)] + [Specific Industry Keyword] + [Catalyst Action / Trigger Terms]
     Example: Dallas commercial real estate "breaks ground" OR "new facility"
     Example: Austin healthcare clinic "expansion" OR "opens"
     Example: Vancouver logistics "new warehouse" OR "distribution hub"
     Example: Ohio manufacturing "capital investment" OR "modernization"

2. INTENT ALIGNMENT:
   - "sales_client_acquisition": Target companies expanding, upgrading facilities, hiring leadership, or getting funded.
   - "subcontractor_partners": Target commercial project awards, groundbreakings, developments, and expansions.
   - "job_seeking": Target companies rapidly hiring, opening regional hubs, or appointing new C-suite leadership.
   - "investing": Target funding rounds, acquisitions, succession planning, and growth equity.

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
- Free-form Description / What they do or seek:
"${mission || valueProp || (industries.length > 0 ? `Targeting ${industries.join(', ')}` : 'B2B commercial growth')}"
- Selected Industries: ${industries.length > 0 ? industries.join(', ') : 'Not specified'}
- Selected Triggers: ${triggers.length > 0 ? triggers.join(', ') : 'Not specified'}
- Core Value Proposition: ${valueProp || 'Commercial solutions provider'}

Generate the structured JSON query plan using the Goldilocks rule.`;

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

function generateAlgorithmicQueryPlan(params: {
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

  // Extract industry anchor
  let indAnchor = targetIndustries[0] || 'Commercial';
  if (indAnchor.includes('&')) indAnchor = indAnchor.split('&')[0].trim();
  if (indAnchor.includes('/')) indAnchor = indAnchor.split('/')[0].trim();

  // Determine trigger verbs based on intent
  let triggerPart = '"New Location" OR "Expansion"';
  if (userIntent === 'subcontractor_partners') {
    triggerPart = '"Contract Awarded" OR "Breaks Ground"';
  } else if (userIntent === 'job_seeking') {
    triggerPart = '"Appointed" OR "Hiring" OR "New Facility"';
  } else if (userIntent === 'investing') {
    triggerPart = '"Acquisition" OR "Funding" OR "Capital"';
  }

  const primary = geoAnchor
    ? `${geoAnchor} ${indAnchor} ${triggerPart}`
    : `"${indAnchor}" ${triggerPart}`;

  const fallback1 = geoAnchor
    ? `${geoAnchor} business "expansion" OR "new facility"`
    : `"${indAnchor}" "breaks ground" OR "contract awarded"`;

  const fallback2 = `"${indAnchor}" "expansion" OR "capital investment"`;

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
