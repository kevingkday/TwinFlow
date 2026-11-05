import type { QueryPlannerInput } from './aiQueryPlanner';

export type ArticleType =
  | 'leadership_hire'
  | 'funding'
  | 'expansion'
  | 'contract_award'
  | 'ground_breaking'
  | 'lease_real_estate'
  | 'acquisition'
  | 'award_ranking'
  | 'exec_interview'
  | 'listicle_roundup'
  | 'other';

export interface NamedPerson {
  name: string;
  role: string;
}

const LOW_YIELD_TITLE =
  /\b(top\s+\d+|round-?up|week in review|what to know|things to know|newsletter|listicle|best of|stocks to watch|movers|need to know|\d+\s+(companies|stocks|reasons|things|ways|tips))\b/i;

const LOW_YIELD_SOURCE =
  /(pr newswire|business wire|globenewswire|accesswire|cision|yahoo finance|finance\.yahoo|seeking alpha|benzinga)/i;

const ROLE_RE =
  /\b(CEO|CFO|COO|CIO|CISO|CTO|CRO|CHRO|CMO|President|Founder|Co-founder|Owner|Partner|Chair(?:man|woman|person)?|General Manager|Managing Director|Vice President|VP|Director|Chief [A-Z][a-z]+ Officer)\b/;

const NAME_TOKEN = "[A-Z][A-Za-z'’.-]+";
const FULL_NAME = `${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){1,2}`;

const STOP_NAME = new Set(
  [
    'new', 'the', 'former', 'city', 'board', 'company', 'group', 'inc', 'ltd', 'llc', 'corp',
    'google', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september',
    'october', 'november', 'december', 'canada', 'canadian', 'alberta', 'ontario', 'texas',
    'british', 'columbia', 'vancouver', 'calgary', 'toronto', 'ottawa', 'dallas', 'north',
    'south', 'east', 'west', 'insurance', 'commercial', 'national', 'global', 'series',
  ]
);

export const SPORTS_QUERY_EXCLUSION = '-NHL -CFL -NFL -NBA -MLB -soccer -hockey -roster';

const SPORTS_TOKENS = ['NHL', 'CFL', 'NFL', 'NBA', 'MLB', 'soccer', 'hockey', 'roster'];

/** Append sports exclusions once, even if the query already contains them. */
export function withSportsExclusion(query: string): string {
  let stripped = query;
  for (const token of SPORTS_TOKENS) {
    stripped = stripped.replace(new RegExp(`\\s*-${token}\\b`, 'gi'), '');
  }
  return `${stripped.replace(/\s+/g, ' ').trim()} ${SPORTS_QUERY_EXCLUSION}`.replace(/\s+/g, ' ').trim();
}

export function isSportsArticle(title: string, publisher = ''): boolean {
  return /\b(nhl|cfl|nfl|nba|mlb|mls|soccer|hockey|roster|touchdown|playoff|premier league)\b/i.test(
    `${title} ${publisher}`
  );
}

export function isNonBuyerRole(role: string): boolean {
  return /\b(journalist|reporter|columnist|editor|correspondent|analyst|commentator|politician|mayor|councillor|minister|senator|governor|mp|mla|public official|coach|athlete|goaltender)\b/i.test(
    role || ''
  );
}

export function usableCompanyDomain(domain?: string | null): string {
  if (!domain) return '';
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) return '';
  if (host === 'example.com' || host.endsWith('.example')) return '';
  return host;
}

export function isVerifiedEmailStatus(status?: string | null): boolean {
  return (status || '').trim().toLowerCase() === 'verified';
}

export function isLowYieldArticle(title: string, publisher = '', url = ''): boolean {
  const haystack = `${title} ${publisher} ${url}`;
  return LOW_YIELD_TITLE.test(title) || LOW_YIELD_SOURCE.test(haystack) || /\b(federal budget|parliament|white paper|editorial|national policy|bill c-)\b/i.test(title);
}

export function classifyArticleType(title: string, body = ''): ArticleType {
  const text = `${title} ${body}`.toLowerCase();
  if (isLowYieldArticle(title) || /\b(list of|round-?up|weekly recap)\b/i.test(text)) return 'listicle_roundup';
  if (/\b(appoints|appointed|names|named|hires|hired|joins as|taps|promoted to|new ceo|new cfo|new ciso)\b/.test(text)) {
    return 'leadership_hire';
  }
  if (/\b(raises|raised|series [a-d]|seed round|funding|venture capital)\b/.test(text)) return 'funding';
  if (/\b(contract awarded|awarded a|wins contract|selected to|tender)\b/.test(text)) return 'contract_award';
  if (/\b(breaks ground|groundbreaking|ground-breaking)\b/.test(text)) return 'ground_breaking';
  if (/\b(lease|leases|headquarters|relocates|office tower|industrial space)\b/.test(text)) return 'lease_real_estate';
  if (/\b(acquires|acquisition|merges with|buyout)\b/.test(text)) return 'acquisition';
  if (/\b(ranked|ranking|award winner|named to the|best places)\b/.test(text)) return 'award_ranking';
  if (/\b(interview|q&a|fireside|in conversation)\b/.test(text)) return 'exec_interview';
  if (/\b(expansion|expands|opens|new facility|new plant|new office|new warehouse)\b/.test(text)) return 'expansion';
  return 'other';
}

function normalizeApostrophes(value: string): string {
  return value.replace(/[’]/g, "'");
}

const TITLE_PREFIX = new Set(
  ['leader', 'executive', 'officer', 'chief', 'advisor', 'adviser', 'director', 'president', 'founder', 'head', 'vp', 'dr']
);

function acceptName(raw: string): string | null {
  const cleaned = normalizeApostrophes(raw).replace(/[^A-Za-z' .-]/g, ' ').replace(/\s+/g, ' ').trim();
  let parts = cleaned.split(' ').filter(Boolean);
  while (
    parts.length > 2 &&
    (TITLE_PREFIX.has(parts[0].toLowerCase().replace(/[^a-z]/g, '')) || /^[A-Za-z]'s$/.test(parts[0]))
  ) {
    parts = parts.slice(1);
  }
  if (parts.length < 2 || parts.length > 3) return null;
  if (parts.some((part) => STOP_NAME.has(part.toLowerCase().replace(/[^a-z]/g, '')))) return null;
  if (parts.some((part) => part.length < 2)) return null;
  if (parts.every((part) => part === part.toUpperCase())) return null;
  return parts.join(' ');
}

function roleNear(text: string, index: number): string {
  const window = text.slice(Math.max(0, index - 40), Math.min(text.length, index + 80));
  const match = window.match(ROLE_RE);
  return match?.[1] || 'Executive';
}

/**
 * Pull full names that the article itself states. Titles and roles alone
 * ("names new CEO") are not a person. Nothing is invented.
 */
export function extractNamedPeople(text: string): NamedPerson[] {
  const source = normalizeApostrophes(text || '');
  const found = new Map<string, NamedPerson>();

  const patterns: RegExp[] = [
    new RegExp(`\\b(?:appoints|appointed|names|named|hires|hired|taps|promotes|welcomes)\\s+(${FULL_NAME})\\b`, 'g'),
    new RegExp(`\\b(${FULL_NAME})\\s+(?:was\\s+)?(?:[Nn]amed|[Aa]ppointed|[Hh]ired|[Pp]romoted)\\b`, 'g'),
    new RegExp(`\\b(${FULL_NAME})\\s+(?:as|to be|named|appointed)\\s+(?:the\\s+|its\\s+|new\\s+)?${ROLE_RE.source}`, 'g'),
    new RegExp(`\\b(${FULL_NAME}),\\s+(?:the\\s+|new\\s+)?${ROLE_RE.source}`, 'g'),
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const name = acceptName(match[1] || '');
      if (!name) continue;
      const key = name.toLowerCase();
      if (!found.has(key)) {
        found.set(key, { name, role: roleNear(source, match.index || 0) });
      }
    }
  }

  return [...found.values()];
}

export function nameAppearsInText(name: string, text: string): boolean {
  const person = normalizeApostrophes(name).normalize('NFC').trim().replace(/\s+/g, ' ');
  if (person.split(' ').filter(Boolean).length < 2) return false;
  const haystack = normalizeApostrophes(text).normalize('NFC').toLowerCase();
  return haystack.includes(person.toLowerCase());
}

const TOPIC_STOP = new Set(
  [
    'about', 'after', 'their', 'there', 'these', 'those', 'which', 'where', 'while', 'would',
    'could', 'should', 'being', 'from', 'with', 'that', 'this', 'have', 'into', 'your', 'they',
    'companies', 'company', 'business', 'clients', 'client', 'services', 'service', 'looking',
    'target', 'targeting', 'market', 'growth', 'commercial', 'canada', 'canadian', 'united',
    'states', 'ontario', 'alberta', 'british', 'columbia',
  ]
);

export function profileTerms(input: QueryPlannerInput): { geo: string[]; topic: string[] } {
  const geo = new Set<string>();
  const location = (input.location || '').toLowerCase();
  for (const token of location.split(/[^a-z]+/).filter((part) => part.length > 2)) {
    if (!['the', 'and', 'for'].includes(token)) geo.add(token);
  }

  const topic = new Set<string>();
  const blobs = [
    ...(input.targetIndustries || []),
    ...(input.targetTriggers || []),
    ...(input.servicesOffered || []),
    ...(input.productsOffered || []),
    input.userMission || '',
    input.valueProp || '',
    input.companyDescription || '',
  ];
  for (const blob of blobs) {
    for (const raw of blob.split(/[^A-Za-z0-9+]+/)) {
      const word = raw.toLowerCase();
      if (word.length < 4 || TOPIC_STOP.has(word) || geo.has(word)) continue;
      topic.add(word);
    }
  }
  return { geo: [...geo], topic: [...topic] };
}

export function isRelevantToProfile(
  input: QueryPlannerInput,
  title: string,
  body = '',
  publisher = ''
): boolean {
  if (isLowYieldArticle(title, publisher) || classifyArticleType(title, body) === 'listicle_roundup') return false;
  if (/\b(charged with|sentenced|arrested|obituary|dies at)\b/i.test(`${title} ${body}`)) return false;
  const { geo, topic } = profileTerms(input);
  const haystack = `${title} ${body}`.toLowerCase();
  const topicHit = topic.some((term) => haystack.includes(term));
  const localGeo = geo.filter((term) => !['canada', 'canadian', 'united', 'states', 'usa'].includes(term));
  const geoOk = localGeo.length === 0 || localGeo.some((term) => haystack.includes(term));
  if (input.userIntent === 'subcontractor_partners' && geoOk) {
    if (/\b(breaks ground|groundbreaking|awarded|contract|construction|industrial|warehouse|facility)\b/.test(haystack)) {
      return true;
    }
  }
  if (!topicHit || !geoOk) return false;
  if (geo.length === 0) return true;
  return true;
}

export function isRecentPublished(value: string | undefined, now = Date.now(), withinDays = 14): boolean {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const age = now - parsed;
  const windowMs = withinDays * 24 * 60 * 60 * 1000;
  return age >= -6 * 60 * 60 * 1000 && age <= windowMs;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const GENERIC_MAILBOX = /^(noreply|no-reply|newsroom|editor|editors|tips|press|info|hello|contact|support|admin|office)@/i;

export function findReachableEmail(text: string): string | null {
  const matches = text.match(EMAIL_RE) || [];
  for (const email of matches) {
    if (!GENERIC_MAILBOX.test(email)) return email;
  }
  return null;
}
