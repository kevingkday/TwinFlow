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

/**
 * Mandatory geography for a local/regional seller. When `enforced` is true,
 * every SerpAPI query carries `clause`, and widening a query only changes the
 * event keywords, never the place.
 */
export interface LocationLock {
  enforced: boolean;
  city: string;
  region: string;
  /** `"Vancouver"`, `"Ontario"`, or `("Vancouver" OR "British Columbia")`. Empty when not enforced. */
  clause: string;
}

/** Starting terms for a 2–3 word Google News ladder. Fetch adds or drops one term after seeing counts. */
export interface QueryLadder {
  serviceArea: 'local' | 'national';
  sector: string;
  trigger: string;
  city: string;
  region: string;
  site?: string;
  /** Derived from city/region when absent. */
  locationLock?: LocationLock;
}

/** Buyer trigger verbs used to widen a query. Widen these, never the geography. */
export const WIDE_NET_EVENT_KEYWORDS = ['appoints', 'raises', 'expansion', 'acquires', 'breaks ground', 'contract'];

const REGION_ABBREVIATIONS: Record<string, string> = {
  bc: 'British Columbia',
  'b.c.': 'British Columbia',
  ab: 'Alberta',
  sk: 'Saskatchewan',
  mb: 'Manitoba',
  on: 'Ontario',
  qc: 'Quebec',
  ns: 'Nova Scotia',
  nb: 'New Brunswick',
  nl: 'Newfoundland and Labrador',
  pe: 'Prince Edward Island',
  tx: 'Texas',
  fl: 'Florida',
  ny: 'New York',
  wa: 'Washington',
  or: 'Oregon',
  az: 'Arizona',
  co: 'Colorado',
  il: 'Illinois',
  ga: 'Georgia',
  nc: 'North Carolina',
  ma: 'Massachusetts',
};

const KNOWN_REGIONS =
  /^(british columbia|alberta|saskatchewan|manitoba|ontario|quebec|nova scotia|new brunswick|newfoundland and labrador|prince edward island|texas|california|florida|new york|washington|oregon|arizona|colorado|illinois|georgia|north carolina|massachusetts)$/i;

const COUNTRY_NAMES = /^(canada|usa|u\.s\.a?\.?|us|united states(?: of america)?|uk|united kingdom|great britain|england|australia)$/i;

/** Extra spellings that prove a story is inside a region (used by triage fallbacks). */
const REGION_ALIASES: Record<string, string[]> = {
  'british columbia': ['british columbia', 'b.c.'],
  'newfoundland and labrador': ['newfoundland', 'labrador'],
  'prince edward island': ['prince edward island', 'p.e.i.'],
};

function expandRegion(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const abbreviation = REGION_ABBREVIATIONS[trimmed.toLowerCase()];
  if (abbreviation) return abbreviation;
  return trimmed;
}

/** Parse "City, Region, Country" (or partial forms) into a city and region. */
export function parseCityRegion(location: string): { city: string; region: string } {
  const parts = (location || '')
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part && !COUNTRY_NAMES.test(part) && !/nationwide/i.test(part));
  if (parts.length === 0) return { city: '', region: '' };
  if (parts.length === 1) {
    const only = expandRegion(parts[0]);
    return KNOWN_REGIONS.test(only) ? { city: '', region: only } : { city: parts[0], region: '' };
  }
  const first = expandRegion(parts[0]);
  if (KNOWN_REGIONS.test(first)) return { city: '', region: first };
  return { city: parts[0], region: expandRegion(parts[1]) };
}

function quoteTerm(term: string): string {
  return `"${term.replace(/"/g, '').trim()}"`;
}

/**
 * Build the mandatory location clause for a local/regional seller. National
 * sellers (SaaS, agencies) get an unenforced lock so geography is not injected.
 */
export function buildLocationLock(
  location: string | { city?: string; region?: string },
  serviceArea: 'local' | 'national' = 'local'
): LocationLock {
  const place = typeof location === 'string' ? parseCityRegion(location) : { city: location.city || '', region: location.region || '' };
  const city = place.city.trim();
  const region = place.region.trim();
  if (serviceArea === 'national' || (!city && !region)) {
    return { enforced: false, city, region, clause: '' };
  }
  const terms = [city, region].filter(Boolean);
  const clause = terms.length > 1 ? `(${terms.map(quoteTerm).join(' OR ')})` : quoteTerm(terms[0]);
  return { enforced: true, city, region, clause };
}

export function resolveLocationLock(ladder: QueryLadder): LocationLock {
  return ladder.locationLock || buildLocationLock({ city: ladder.city, region: ladder.region }, ladder.serviceArea);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Guarantee the location clause is present in a SerpAPI query. Bare or quoted
 * mentions of the city/region are folded into the single clause so the place
 * is never duplicated and never dropped.
 */
export function applyLocationLock(query: string, lock?: LocationLock | null): string {
  const base = (query || '').trim();
  if (!lock?.enforced || !lock.clause) return base;
  if (base.includes(lock.clause)) return base;
  let stripped = base;
  for (const term of [lock.city, lock.region].filter(Boolean)) {
    stripped = stripped.replace(new RegExp(`"?\\b${escapeRegExp(term)}\\b"?`, 'gi'), ' ');
  }
  stripped = stripped
    .replace(/\(\s*(?:OR\s*)*\)/g, ' ')
    .replace(/\(\s*OR\s+/g, '(')
    .replace(/\s+OR\s*\)/g, ')')
    .replace(/""/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${lock.clause} ${stripped}`.trim();
}

/** True when the text names the locked city or region (or a common alias). */
export function mentionsLockedPlace(text: string, lock: LocationLock): { city: boolean; region: boolean } {
  const haystack = ` ${(text || '').toLowerCase()} `;
  const has = (term: string) => new RegExp(`(^|[^a-z])${escapeRegExp(term.toLowerCase())}($|[^a-z])`).test(haystack);
  const city = Boolean(lock.city) && has(lock.city);
  const regionKey = lock.region.toLowerCase();
  const aliases = REGION_ALIASES[regionKey] || (regionKey ? [regionKey] : []);
  const region = aliases.some((alias) => has(alias));
  return { city, region };
}

function eventGroup(extraTrigger?: string): string {
  const words = [extraTrigger, ...WIDE_NET_EVENT_KEYWORDS]
    .map((word) => (word || '').trim().toLowerCase())
    .filter(Boolean)
    .filter((word, index, list) => list.indexOf(word) === index);
  return `(${words.map((word) => (/\s/.test(word) ? quoteTerm(word) : word)).join(' OR ')})`;
}

/**
 * Wide-net SerpAPI queries for one ladder, most specific first. Each query
 * keeps the location clause (when enforced) and widens only the event
 * keywords. Sports exclusions are appended once per query.
 */
export function buildWideNetQueries(ladder: QueryLadder): string[] {
  const lock = resolveLocationLock(ladder);
  const sector = ladder.sector && ladder.sector !== 'company' ? ladder.sector : '';
  const events = eventGroup(ladder.trigger);
  const raw = [
    sector ? `${sector} ${events}` : '',
    events,
    ladder.site ? `site:${ladder.site} ${lock.enforced ? sector : `${sector} ${events}`}` : '',
  ];
  const seen = new Set<string>();
  const queries: string[] = [];
  for (const q of raw) {
    if (!q.trim()) continue;
    const locked = withSportsExclusion(applyLocationLock(q, lock));
    if (seen.has(locked)) continue;
    seen.add(locked);
    queries.push(locked);
  }
  return queries;
}

/** Google country code for SerpAPI `gl`, inferred from free-form location text. */
export function inferGoogleCountry(location: string): string {
  const locLower = (location || '').toLowerCase();
  if (
    /canada|british columbia|alberta|ontario|quebec|saskatchewan|manitoba|nova scotia|vancouver|toronto|montreal|calgary|edmonton|ottawa|mississauga/.test(locLower) ||
    /,\s*(bc|on|ab|qc|sk|mb)\b/.test(locLower)
  ) {
    return 'ca';
  }
  if (/\buk\b|united kingdom|london|manchester/.test(locLower)) return 'gb';
  return 'us';
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
  /** Mandatory geography for every SerpAPI query (unenforced for national sellers). */
  locationLock: LocationLock;
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
  const defaultGl = inferGoogleCountry(location);

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
2. SHORT QUERIES, WIDEN EVENTS — NEVER THE GEOGRAPHY OF A LOCAL SELLER:
   - No OR groups. No when: operators. No mandatory quoted exact phrases.
   - Each query is place + buyer sector + one trigger word (funding, hires, expansion, lease, breaks ground, captive).
   - For a local/regional seller, every query (primary and fallbacks) must keep the city or province/state. Widen the event keywords (appoints, raises, expansion, acquires, breaks ground, contract), not the place. Only a national seller may omit the place.
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
    serviceArea: input.serviceArea,
    buyerIndustries: input.buyerIndustries,
    buyerRoles: input.buyerRoles,
    buyerCompanySize: input.buyerCompanySize,
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
  const rawSector = buyer.buyerIndustries[0] || 'business';
  const sector = rawSector.toLowerCase().includes('operating') || rawSector.toLowerCase().includes('company')
    ? 'business'
    : rawSector.split(' ').slice(0, 2).join(' ');
  const trigger = targetTriggers[0] ? targetTriggers[0].split(/\s+/)[0] : '';
  let site: string | undefined;
  if (/technology|software/.test(sector)) site = 'betakit.com';
  else if (/law|occupier|professional/.test(sector)) site = 'bisnow.com';
  else if (/developer|building|owner/.test(sector)) site = 'constructconnect.com';
  else if (/captive/i.test(userMission)) site = 'captiveinsurancetimes.com';
  else site = 'newswire.ca';

  const parsedPlace = parseCityRegion(location);
  if (!region && parsedPlace.region) region = parsedPlace.region;
  const locationLock = buildLocationLock({ city, region }, buyer.serviceArea);
  const place = buyer.serviceArea === 'national' ? '' : city || region;
  // If sector is general 'business' or empty, don't restrict to a single trigger word; keep it wide for Google News.
  const startTerms = sector && sector !== 'business'
    ? [place, sector, trigger].filter(Boolean).slice(0, 3)
    : [place, 'business'].filter(Boolean);
  const primary = withSportsExclusion(startTerms.join(' '));
  const queryLadder: QueryLadder = {
    serviceArea: buyer.serviceArea,
    sector,
    trigger,
    city,
    region,
    site,
    locationLock,
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
    locationLock,
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
