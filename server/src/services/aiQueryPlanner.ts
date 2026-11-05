import { withSportsExclusion } from './signalQuality';
import { deriveBuyerProfile } from './buyerProfile';

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
  targetRoles?: string[];
  buyerIndustries?: string[];
  buyerRoles?: string[];
  buyerCompanySize?: 'smb' | 'midmarket' | 'enterprise' | 'any';
  serviceArea?: 'local' | 'national';
  allowNationalSearch?: boolean;
}

/** Starting terms for a 2–3 word Google News ladder. Fetch adds or drops one term after seeing counts. */
export interface QueryLadder {
  serviceArea: 'local' | 'national';
  sector: string;
  trigger: string;
  city: string;
  region: string;
  site?: string;
}

export interface SearchTier {
  label: 'city' | 'region' | 'country';
  queries: string[];
}

export interface QueryPlanResult {
  primaryQuery: string;
  fallbackQueries: string[];
  searchTiers: SearchTier[];
  queryLadder: QueryLadder;
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
1. SEARCH THE BUYER'S EVENTS, NOT THE SELLER'S TRADE:
   - A cyber/AI insurance broker sells to technology companies. Search "Vancouver technology funding" or "Vancouver technology hires", never "Insurance Business Vancouver" or "Canadian Underwriter".
   - A managed IT provider sells to local operating companies. Search "Ontario company expansion" or "Ontario company hires", never the insurance trade press.
   - A captive consultant searches companies that might form a captive ("company captive", "forms captive"), not generic insurance appointments.
   - A commercial real estate broker searches tenants and occupiers ("Dallas office lease", "Dallas headquarters").
   - A contractor searches project owners ("Calgary construction breaks ground").
   - A SaaS marketing agency searches software companies ("Toronto software raises", "Toronto software hires").
2. SHORT QUERIES, THEN WIDEN GEOGRAPHY:
   - No OR groups. No when: operators. No mandatory quoted exact phrases.
   - Each query is place + buyer sector + one trigger word (funding, hires, expansion, lease, breaks ground, captive).
   - primaryQuery uses the city. fallbackQueries use the same phrases with the province/state, then the country, so thin cities can widen.
   - One fallback may be a real site: restriction for a trade outlet that covers the BUYER sector: site:betakit.com, site:bisnow.com, site:constructconnect.com, or site:captiveinsurancetimes.com. Do not use the outlet name as a keyword.
   - Do not add sports minus-terms yourself. They are appended once later.

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
          if (parsed.primaryQuery) {
            const buyerPlan = generateAlgorithmicQueryPlan({
              location,
              userIntent: intent,
              userMission: mission,
              targetIndustries: industries,
              targetTriggers: triggers,
              valueProp,
              defaultGl,
              serviceArea: input.serviceArea,
              buyerIndustries: input.buyerIndustries,
              buyerRoles: input.buyerRoles,
              buyerCompanySize: input.buyerCompanySize,
            });
            return {
              ...buyerPlan,
              missionSummary: parsed.missionSummary || buyerPlan.missionSummary,
              recommendedPitchAngle: parsed.recommendedPitchAngle || buyerPlan.recommendedPitchAngle,
              modelUsed: `${modelUsed}+buyer_tiers`,
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
  serviceArea?: 'local' | 'national';
  buyerIndustries?: string[];
  buyerRoles?: string[];
  buyerCompanySize?: 'smb' | 'midmarket' | 'enterprise' | 'any';
}): QueryPlanResult {
  const { location, userIntent, userMission, targetIndustries, targetTriggers, defaultGl } = params;

  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  const regionNames = /^(ontario|alberta|british columbia|quebec|texas|california|florida|new york)$/i;
  let city = '';
  let region = '';
  let country = '';
  if (parts.length >= 3) {
    city = parts[0];
    region = parts[1];
    country = parts.slice(2).join(' ');
  } else if (parts.length === 2) {
    if (regionNames.test(parts[0])) {
      region = parts[0];
      country = parts[1];
    } else {
      city = parts[0];
      country = parts[1];
    }
  } else {
    city = parts[0] || '';
  }

  const buyer = deriveBuyerProfile({
    location,
    userIntent,
    userMission,
    targetIndustries,
    targetTriggers,
    valueProp: params.valueProp,
    buyerIndustries: params.buyerIndustries,
    buyerRoles: params.buyerRoles,
    buyerCompanySize: params.buyerCompanySize,
    serviceArea: params.serviceArea,
  });
  const sector = (buyer.buyerIndustries[0] || 'company').split(' ').slice(0, 2).join(' ');
  const trigger = (targetTriggers[0] || 'expansion').split(/\s+/)[0] || 'expansion';
  let site: string | undefined;
  if (/technology|software/.test(sector)) site = 'betakit.com';
  else if (/law|occupier|professional/.test(sector)) site = 'bisnow.com';
  else if (/developer|building|owner/.test(sector)) site = 'constructconnect.com';
  else if (/captive/i.test(userMission)) site = 'captiveinsurancetimes.com';
  else site = 'newswire.ca';

  const place = buyer.serviceArea === 'national' ? '' : city || region;
  const startTerms = [place, sector, trigger].filter(Boolean).slice(0, 3);
  const primary = withSportsExclusion(startTerms.join(' '));
  const queryLadder: QueryLadder = {
    serviceArea: buyer.serviceArea,
    sector,
    trigger,
    city,
    region,
    site,
  };
  const searchTiers: SearchTier[] = [
    {
      label: buyer.serviceArea === 'national' ? 'country' : city ? 'city' : 'region',
      queries: [primary],
    },
  ];
  const geoAnchor = place || country || 'any location';

  return {
    primaryQuery: primary,
    fallbackQueries: [],
    searchTiers,
    queryLadder,
    geographicFocus: {
      locationClean: location || 'Nationwide',
      gl: defaultGl,
      metroOrRegion: geoAnchor || 'Regional',
    },
    missionSummary:
      userMission ||
      `Finding ${sector} opportunities in ${location || 'target markets'} for ${userIntent}`,
    recommendedPitchAngle:
      userIntent === 'job_seeking'
        ? 'Reach out as an experienced executive operator ready to support their regional scaling.'
        : userIntent === 'subcontractor_partners'
        ? 'Reach out as a specialized trade and vendor partner to review project specifications.'
        : 'Align your solution directly to their expansion milestone to relieve scaling bottlenecks.',
    modelUsed: 'algorithmic_fallback',
  };
}
