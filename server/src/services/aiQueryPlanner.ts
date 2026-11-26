import { withSportsExclusion } from './signalQuality';
import { deriveBuyerProfile, type BuyerProfile } from './buyerProfile';

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

/** Major corporate newswire domains for public company and press release discovery. */
export const PR_WIRE_SITES = [
  'prnewswire.com',
  'businesswire.com',
  'globenewswire.com',
  'accesswire.com',
  'newswire.ca',
] as const;

const PR_WIRE_CATALYST_VERBS = '(appoints OR expands OR acquires OR contract OR "breaks ground" OR "new facility")';

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
 * Build a dedicated site-scoped corporate press release wire query.
 * Respects `locationLock` when enforced, targets high-signal corporate catalyst
 * verbs, and appends negative sports noise filters.
 */
export function buildPrWireQuery(locationLock: LocationLock, _buyerProfile?: BuyerProfile): string {
  const siteClause = `(${PR_WIRE_SITES.map((site) => `site:${site}`).join(' OR ')})`;
  const base = locationLock?.enforced && locationLock.clause
    ? `${siteClause} ${locationLock.clause} ${PR_WIRE_CATALYST_VERBS}`
    : `${siteClause} ${PR_WIRE_CATALYST_VERBS}`;
  return withSportsExclusion(base);
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
  const prWireQuery = buildPrWireQuery(lock);
  if (prWireQuery && !seen.has(prWireQuery)) {
    seen.add(prWireQuery);
    queries.push(prWireQuery);
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
1. BUILD EACH SEARCH FROM 2–3 TERMS: WHAT THE BUSINESS SELLS (OR TARGET BUYER), A BUYING TRIGGER, AND THE PLACE:
   - A cyber/AI insurance broker in BC: "Vancouver cybersecurity breach", "BC AI rollout funding", "Vancouver technology expansion".
   - A managed IT provider in Kelowna selling to clinics and law firms: "Kelowna IT clinic expansion", "Kelowna law firm breach", "Okanagan medical clinic new location".
   - A captive consultant: "company captive", "forms captive".
   - A commercial real estate broker: "Dallas office lease", "Dallas headquarters expansion".
   - A contractor: "Calgary construction breaks ground".
   - A SaaS marketing agency (national): "B2B SaaS Series A funding", "software AI rollout hires".
2. SHORT QUERIES, WIDEN EVENTS — NEVER THE GEOGRAPHY OF A LOCAL SELLER:
   - No OR groups. No when: operators. No mandatory quoted exact phrases.
   - Each query is 2–3 terms: what the business sells/buyer sector + one buying trigger (data breach, AI rollout, funding, new location, regulation, expansion, contract) + place.
   - Licensed or local businesses (insurance, IT MSP, contractors, lawyers, real estate) search their city and widen at most to province or state. Software and agency businesses search anywhere (omit place).
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

      // Try fast gpt-4.1-mini first with a 12s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);
      let response: Response;
      let modelUsed = 'gpt-4.1-mini';
      try {
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cleanKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.2,
          }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Fallback to gpt-4o-mini if gpt-4.1-mini has quota or model permission issues
      if (!response.ok) {
        console.warn(`[AI Query Planner] gpt-4.1-mini returned ${response.status}, falling back to gpt-4o-mini`);
        const fbController = new AbortController();
        const fbTimer = setTimeout(() => fbController.abort(), 12000);
        try {
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
            signal: fbController.signal,
          });
        } finally {
          clearTimeout(fbTimer);
        }
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
              companyDescription: input.companyDescription,
              servicesOffered: input.servicesOffered,
              productsOffered: input.productsOffered,
              defaultGl,
              serviceArea: input.serviceArea,
              buyerIndustries: input.buyerIndustries,
              buyerRoles: input.buyerRoles,
              buyerCompanySize: input.buyerCompanySize,
            });
            const cleanAiPrimary = parsed.primaryQuery.replace(/\s+-\w+/g, '').trim();
            const cleanAiFallbacks = Array.isArray(parsed.fallbackQueries)
              ? parsed.fallbackQueries.map((q) => q.replace(/\s+-\w+/g, '').trim()).filter(Boolean)
              : [];
            return {
              ...buyerPlan,
              primaryQuery: cleanAiPrimary || buyerPlan.primaryQuery,
              fallbackQueries: cleanAiFallbacks.length > 0 ? cleanAiFallbacks : buyerPlan.fallbackQueries,
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
    companyDescription: input.companyDescription,
    servicesOffered: input.servicesOffered,
    productsOffered: input.productsOffered,
    defaultGl,
    serviceArea: input.serviceArea,
    buyerIndustries: input.buyerIndustries,
    buyerRoles: input.buyerRoles,
    buyerCompanySize: input.buyerCompanySize,
  });
}

function extractOfferingSearchTerm(params: {
  servicesOffered?: string[];
  productsOffered?: string[];
  userMission?: string;
  valueProp?: string;
  companyDescription?: string;
  buyerIndustries: string[];
}): string {
  const blob = [
    ...(params.servicesOffered || []),
    ...(params.productsOffered || []),
    params.userMission || '',
    params.valueProp || '',
    params.companyDescription || '',
  ]
    .join(' ')
    .toLowerCase();

  if (/cyber\s*(?:&|and)?\s*ai|cyber insurance|ai risk|ai liability/.test(blob)) {
    return /technology companies/.test(blob) ? 'technology' : 'cybersecurity';
  }
  if (/managed it|\bmsp\b|managed services|it support/.test(blob)) {
    const firstBuyer = params.buyerIndustries[0];
    if (firstBuyer && /clinic|law|medical|legal|accounting/.test(firstBuyer)) {
      return `IT ${firstBuyer.split(' ')[0]}`;
    }
    return 'managed IT';
  }
  if (/captive/.test(blob)) return 'captive insurance';
  if (/commercial insurance|property and casualty|p&c|insurance broker/.test(blob)) return 'commercial expansion';
  if (/roofing|hvac|contractor|construction/.test(blob)) return 'commercial construction';
  if (/real estate|tenant|lease/.test(blob)) return 'office lease';

  if (params.servicesOffered && params.servicesOffered.length > 0) {
    const words = params.servicesOffered[0].trim().split(/\s+/).slice(0, 2).join(' ');
    if (words) return words;
  }
  const rawSector = params.buyerIndustries[0] || 'business';
  return rawSector.toLowerCase().includes('operating') || rawSector.toLowerCase().includes('company')
    ? 'business'
    : rawSector.split(' ').slice(0, 2).join(' ');
}

function extractTriggerSearchTerm(targetTriggers: string[], blob: string): string {
  const lowerTriggers = targetTriggers.join(' ').toLowerCase();
  const combined = `${lowerTriggers} ${blob.toLowerCase()}`;
  if (/breach|ransomware|cybersecurity|cyber/.test(combined) && /cyber|ai/.test(blob.toLowerCase())) return 'breach';
  if (/ai rollout|ai adoption|artificial intelligence/.test(combined)) return 'AI';
  if (/funding|series|venture|capital/.test(lowerTriggers)) return 'funding';
  if (/facility|location|opening|expansion/.test(lowerTriggers)) return 'expansion';
  if (/contract|rfp/.test(lowerTriggers)) return 'contract';
  if (/regulat|compliance|licensing/.test(lowerTriggers)) return 'regulation';
  if (/hire|hiring|leadership|partner/.test(lowerTriggers)) return 'appoints';
  if (/merger|acquisition|m&a/.test(lowerTriggers)) return 'acquires';
  if (targetTriggers[0]) return targetTriggers[0].split(/\s+/)[0].toLowerCase();
  return 'expansion';
}

export function generateAlgorithmicQueryPlan(params: {
  location: string;
  userIntent: string;
  userMission: string;
  targetIndustries: string[];
  targetTriggers: string[];
  valueProp: string;
  companyDescription?: string;
  servicesOffered?: string[];
  productsOffered?: string[];
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
    companyDescription: params.companyDescription,
    servicesOffered: params.servicesOffered,
    productsOffered: params.productsOffered,
    buyerIndustries: params.buyerIndustries,
    buyerRoles: params.buyerRoles,
    buyerCompanySize: params.buyerCompanySize,
    serviceArea: params.serviceArea,
  });
  const offeringTerm = extractOfferingSearchTerm({
    servicesOffered: params.servicesOffered,
    productsOffered: params.productsOffered,
    userMission,
    valueProp: params.valueProp,
    companyDescription: params.companyDescription,
    buyerIndustries: buyer.buyerIndustries,
  });
  const sector = offeringTerm;
  const trigger = extractTriggerSearchTerm(
    targetTriggers,
    `${userMission} ${params.valueProp} ${params.companyDescription || ''} ${(params.servicesOffered || []).join(' ')}`
  );
  let site: string | undefined;
  if (/technology|software|cyber|ai/i.test(sector)) site = 'betakit.com';
  else if (/law|occupier|professional|clinic/i.test(sector)) site = 'bisnow.com';
  else if (/developer|building|owner|construction/i.test(sector)) site = 'constructconnect.com';
  else if (/captive/i.test(userMission)) site = 'captiveinsurancetimes.com';
  else site = 'newswire.ca';

  const parsedPlace = parseCityRegion(location);
  if (!region && parsedPlace.region) region = parsedPlace.region;
  const locationLock = buildLocationLock({ city, region }, buyer.serviceArea);
  const place = buyer.serviceArea === 'national' ? '' : city || region;
  // Build each search from 2-3 terms: what the business sells + buying trigger + place.
  const startTerms = [place, offeringTerm, trigger].filter(Boolean).slice(0, 3);
  const primary = withSportsExclusion(startTerms.join(' ').trim());
  const fallbackQueries = [
    [place, offeringTerm].filter(Boolean).join(' ').trim(),
    [region || place, buyer.buyerIndustries[0] || offeringTerm, trigger].filter(Boolean).join(' ').trim(),
  ].filter((q, idx, arr) => Boolean(q) && q !== primary && arr.indexOf(q) === idx);
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
      queries: [primary, ...fallbackQueries],
    },
  ];
  const geoAnchor = place || country || 'any location';

  return {
    primaryQuery: primary,
    fallbackQueries,
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

export interface CandidateQuerySpec {
  queryText: string;
  tier: 'specific' | 'broad';
}

function algorithmicCandidateQueries(input: QueryPlannerInput): CandidateQuerySpec[] {
  const buyer = deriveBuyerProfile(input);
  const placeObj = parseCityRegion(input.location || '');
  const city = placeObj.city;
  const region = placeObj.region;
  const place = buyer.serviceArea === 'national' ? '' : city || region;
  const widerPlace = buyer.serviceArea === 'national' ? '' : region || city;

  const blob = [
    ...(input.servicesOffered || []),
    input.userMission || '',
    input.valueProp || '',
    input.companyDescription || '',
    ...(input.targetIndustries || []),
  ]
    .join(' ')
    .toLowerCase();

  const out: CandidateQuerySpec[] = [];
  const push = (q: string, tier: 'specific' | 'broad') => {
    const clean = q.replace(/\s+/g, ' ').trim();
    if (clean && !out.some((item) => item.queryText.toLowerCase() === clean.toLowerCase())) {
      out.push({ queryText: clean, tier });
    }
  };

  if (/managed it|\bmsp\b|managed services|it support/.test(blob)) {
    const p = place || 'Kelowna';
    const w = widerPlace || 'British Columbia';
    push(`${p} medical clinic IT`, 'specific');
    push(`${p} law firm cybersecurity`, 'specific');
    push(`${p} clinic expansion`, 'specific');
    push(`${p} ransomware breach`, 'specific');
    push(`${p} law firm new office`, 'specific');
    push(`${w} clinic data breach`, 'broad');
    push(`${p} business IT upgrade`, 'broad');
    push(`${w} managed IT compliance`, 'broad');
    return out.slice(0, 8);
  }

  if (/cyber|ai risk|ai liability|cyber insurance/.test(blob)) {
    const p = place || 'Vancouver';
    const w = widerPlace || 'British Columbia';
    push(`${p} cybersecurity breach`, 'specific');
    push(`${p} ransomware attack`, 'specific');
    push(`${w} AI rollout`, 'specific');
    push(`${p} law firm ransomware`, 'specific');
    push(`${w} data breach`, 'specific');
    push(`${w} AI policy regulation`, 'broad');
    push(`${p} CISO CTO hire`, 'specific');
    push(`${w} company cybersecurity`, 'broad');
    return out.slice(0, 8);
  }

  const offering = extractOfferingSearchTerm({
    servicesOffered: input.servicesOffered,
    productsOffered: input.productsOffered,
    userMission: input.userMission,
    valueProp: input.valueProp,
    companyDescription: input.companyDescription,
    buyerIndustries: buyer.buyerIndustries,
  });
  const sectors = buyer.buyerIndustries.slice(0, 3);
  const triggers = ['breach', 'AI rollout', 'funding', 'expansion', 'new location', 'regulation'];
  for (const sec of sectors) {
    for (const trig of triggers.slice(0, 2)) {
      push([place, sec, trig].filter(Boolean).join(' '), 'specific');
    }
  }
  push([place, offering, 'expansion'].filter(Boolean).join(' '), 'broad');
  push([widerPlace || place, offering, 'funding'].filter(Boolean).join(' '), 'broad');
  return out.slice(0, 8);
}

/**
 * Generate 6-10 candidate Google News queries from the campaign profile using
 * current OpenAI model (`gpt-4.1`, falling back to `gpt-4o`), mixing specific
 * trigger queries with a few broader ones.
 */
export async function generateCandidateQueries(
  input: QueryPlannerInput,
  openAiApiKey?: string
): Promise<CandidateQuerySpec[]> {
  const cleanKey = (openAiApiKey || '').trim();
  const fallback = algorithmicCandidateQueries(input);
  if (!cleanKey || !cleanKey.startsWith('sk-') || cleanKey.includes('your_')) {
    return fallback;
  }

  const buyer = deriveBuyerProfile(input);
  const placeObj = parseCityRegion(input.location || '');
  const geoRule =
    buyer.serviceArea === 'national'
      ? 'Software/agency business: search anywhere (no city/province required).'
      : `Local/licensed business: every query MUST include "${placeObj.city || input.location || ''}" or "${placeObj.region || ''}". Never widen beyond province/state.`;

  const systemPrompt = `You generate 6 to 10 short Google News search queries (2-4 words each, no OR operators, no quotes) for a B2B lead scout.
Each query must combine: what the business sells (or its buyer sector) + a concrete buying trigger (data breach, ransomware, new AI rollout, AI policy or regulation, funding round, acquisition, new location, new CTO/CISO hire) + the place (when local).
Mix 5-7 specific queries (e.g. "Vancouver law firm ransomware", "BC company AI rollout") with 2-3 broader ones.
${geoRule}
Respond with JSON only: { "queries": [ { "queryText": "...", "tier": "specific" | "broad" } ] }`;

  const userPrompt = `Business sells: ${(input.servicesOffered || []).join(', ') || input.userMission || input.valueProp || 'B2B services'}
Description: ${input.companyDescription || input.userMission || ''}
Buyer sectors: ${buyer.buyerIndustries.join(', ')}
Target triggers: ${(input.targetTriggers || []).join(', ') || 'breach, AI rollout, funding, expansion, new location'}
Location: ${input.location || 'Unspecified'}`;

  const callModel = async (model: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 14000);
    try {
      return await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cleanKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
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
  };

  try {
    let res = await callModel('gpt-4.1-mini');
    let usedModel = 'gpt-4.1-mini';
    if (!res.ok) {
      console.warn(`[Candidate Queries] gpt-4.1-mini returned ${res.status}, trying gpt-4o-mini`);
      res = await callModel('gpt-4o-mini');
      usedModel = 'gpt-4o-mini';
    }
    if (!res.ok) {
      console.warn(`[Candidate Queries] gpt-4o-mini returned ${res.status}, trying gpt-5-mini`);
      res = await callModel('gpt-5-mini');
      usedModel = 'gpt-5-mini';
    }
    if (res.ok) {
      const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = json.choices?.[0]?.message?.content;
      if (content) {
        const parsed = JSON.parse(content) as { queries?: Array<{ queryText?: string; tier?: string }> };
        const valid = (parsed.queries || [])
          .filter((q) => typeof q.queryText === 'string' && q.queryText.trim().length >= 3)
          .map((q) => ({
            queryText: q.queryText!.replace(/\s+-\w+/g, '').replace(/\s+/g, ' ').trim(),
            tier: (q.tier === 'broad' ? 'broad' : 'specific') as 'specific' | 'broad',
          }))
          .slice(0, 10);
        if (valid.length >= 4) {
          console.log(`[Candidate Queries] generated ${valid.length} queries via ${usedModel}`);
          return valid;
        }
      }
    } else {
      console.warn(`[Candidate Queries] OpenAI models failed (last status ${res.status}); using algorithmic fallback`);
    }
  } catch (err) {
    console.warn('[Candidate Queries] OpenAI generation failed/timed out, using algorithmic fallback:', err);
  }

  console.log(`[Candidate Queries] returning ${fallback.length} algorithmic fallback queries`);
  return fallback;
}
