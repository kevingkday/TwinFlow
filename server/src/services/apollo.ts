import { isVerifiedEmailStatus } from './signalQuality';

/**
 * Apollo Contact Matching Service Adapter
 * Takes extracted person's name, role, and company domain to query Apollo for a verified
 * business email and LinkedIn URL. Gracefully falls back if no exact match is found.
 */

export interface ApolloContactResult {
  email?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
  matched: boolean;
  status: 'verified' | 'inferred' | 'fallback';
}

export async function findApolloContact(
  name: string,
  role: string,
  companyDomain: string,
  apiKey?: string
): Promise<ApolloContactResult> {
  const cleanKey = (apiKey || '').trim();
  
  // Clean honorifics / titles from name so search and fallback email are clean
  const cleanFullName = name.replace(/^(dr|mr|mrs|ms|prof|hon)\.?\s+/i, '').trim() || name.trim();
  const nameParts = cleanFullName.split(/\s+/);
  const firstName = nameParts[0] || 'Executive';
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
  const cleanDomain = companyDomain.replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();

  // If live Apollo key is supplied, query Apollo People Match endpoint
  if (cleanKey && !cleanKey.includes('your_') && cleanKey.length > 10) {
    try {
      const response = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': cleanKey,
        },
        body: JSON.stringify({
          first_name: firstName,
          last_name: lastName,
          domain: cleanDomain,
          title: role,
        }),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          person?: {
            email?: string;
            email_status?: string;
            linkedin_url?: string;
            photo_url?: string;
            id?: string;
          };
        };

        let avatarUrl: string | undefined;
        if (json.person?.photo_url) {
          const p = json.person.photo_url.trim();
          // Filter out LinkedIn / social default silhouette placeholder SVGs
          const isPlaceholder =
            p.includes('licdn.com/aero-v1/sc/h/') ||
            p.includes('ghost_person') ||
            p.includes('default-avatar') ||
            p.includes('static.licdn.com');
          if (!isPlaceholder && p.startsWith('http')) {
            avatarUrl = p;
          }
        }

        if (json.person?.email && isVerifiedEmailStatus(json.person.email_status)) {
          return {
            email: json.person.email,
            linkedinUrl: json.person.linkedin_url,
            avatarUrl,
            matched: true,
            status: 'verified',
          };
        }
      }
    } catch (err) {
      console.warn(`Apollo match failed for ${name} @ ${cleanDomain}, falling back gracefully:`, err);
    }
  }

  // Do not invent an email or LinkedIn URL. A guessed address is not a reachable contact.
  return {
    matched: false,
    status: 'fallback',
  };
}

/* ------------------------------------------------------------------ */
/* Contact discovery waterfall: article -> company -> lookalike -> related */
/* ------------------------------------------------------------------ */

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

/** Default buyer titles when the profile has none. */
export const DEFAULT_BUYER_TITLES = ['CEO', 'Founder', 'President', 'Owner', 'COO', 'CFO'];

/** Credit-costing reveals (people/match by id) per signal. Search itself is free. */
export const APOLLO_MAX_REVEALS_PER_SIGNAL = 1;

export type ContactSource = 'article' | 'company' | 'lookalike' | 'related';

export interface ApolloPersonHit {
  id: string;
  firstName: string;
  title: string;
  organizationName: string;
  hasEmail: boolean;
}

export interface ApolloPeopleSearchParams {
  organizationDomains?: string[];
  organizationName?: string;
  /** Undocumented (beta) but verified: people at companies similar to these Apollo org ids. */
  lookalikeOrganizationIds?: string[];
  /** Undocumented (beta) but verified: people similar to these Apollo person ids. */
  lookalikePersonIds?: string[];
  organizationLocations?: string[];
  organizationKeywordTags?: string[];
  personTitles?: string[];
  perPage?: number;
}

export interface ApolloOrganization {
  id: string;
  name: string;
  domain: string;
  industry?: string;
}

export interface ResolvedContact {
  name: string;
  title: string;
  company: string;
  companyDomain?: string;
  email?: string;
  linkedinUrl?: string;
  avatarUrl?: string;
  source: ContactSource;
  apolloPersonId?: string;
  emailVerified: boolean;
}

export interface ContactResolutionInput {
  /** Decision maker printed in the article, if any. */
  articlePerson?: { name: string; role: string } | null;
  /** Subject company of the article, if any. */
  companyName?: string;
  companyDomain?: string;
  /** Buyer titles to target (profile buyerRoles). */
  buyerTitles?: string[];
  /** Industries for the related-company search (article tags + buyer industries). */
  industries?: string[];
  /** Apollo organization_locations for lookalike/related tiers, e.g. "British Columbia, Canada". */
  locations?: string[];
}

export interface ContactResolution {
  contacts: ResolvedContact[];
  source: ContactSource | 'none';
  /** Step-by-step trace for telemetry. */
  trail: string[];
}

function liveApolloKey(apiKey?: string): string | null {
  const key = (apiKey || '').trim();
  return key && !key.includes('your_') && key.length > 10 ? key : null;
}

function apolloHeaders(key: string): Record<string, string> {
  return { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': key };
}

function cleanPhoto(url?: string): string | undefined {
  const p = (url || '').trim();
  if (!p.startsWith('http')) return undefined;
  if (/licdn\.com\/aero-v1\/sc\/h\/|ghost_person|default-avatar|static\.licdn\.com/.test(p)) return undefined;
  return p;
}

/**
 * Apollo People API Search (`mixed_people/api_search`). Free (no credits) and
 * returns obfuscated last names; use `revealApolloPerson` to get the full
 * record. Array filters use plain keys: the `[]` suffix is silently ignored.
 */
export async function searchApolloPeople(params: ApolloPeopleSearchParams, apiKey?: string): Promise<ApolloPersonHit[]> {
  const key = liveApolloKey(apiKey);
  if (!key) return [];
  const body: Record<string, unknown> = { page: 1, per_page: params.perPage ?? 10 };
  if (params.organizationDomains?.length) body.q_organization_domains_list = params.organizationDomains;
  if (params.organizationName) body.q_organization_name = params.organizationName;
  if (params.lookalikeOrganizationIds?.length) body.lookalike_organization_ids = params.lookalikeOrganizationIds.slice(0, 5);
  if (params.lookalikePersonIds?.length) body.lookalike_person_ids = params.lookalikePersonIds.slice(0, 5);
  if (params.organizationLocations?.length) body.organization_locations = params.organizationLocations;
  if (params.organizationKeywordTags?.length) body.q_organization_keyword_tags = params.organizationKeywordTags;
  if (params.personTitles?.length) body.person_titles = params.personTitles;
  try {
    const response = await fetch(`${APOLLO_BASE}/mixed_people/api_search`, {
      method: 'POST',
      headers: apolloHeaders(key),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.warn(`[Apollo] people search status ${response.status}`);
      return [];
    }
    const json = (await response.json()) as {
      people?: Array<{ id?: string; first_name?: string; title?: string; has_email?: boolean; organization?: { name?: string } }>;
    };
    return (json.people || [])
      .filter((p) => p.id && p.first_name)
      .map((p) => ({
        id: p.id!,
        firstName: p.first_name!,
        title: p.title || '',
        organizationName: p.organization?.name || '',
        hasEmail: Boolean(p.has_email),
      }));
  } catch (err) {
    console.warn('[Apollo] people search failed:', err);
    return [];
  }
}

/** Organization Enrichment by domain (costs an Apollo credit). Supplies lookalike seed ids. */
export async function enrichApolloOrganization(domain: string, apiKey?: string): Promise<ApolloOrganization | null> {
  const key = liveApolloKey(apiKey);
  const clean = (domain || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').trim();
  if (!key || !clean) return null;
  try {
    const response = await fetch(`${APOLLO_BASE}/organizations/enrich?domain=${encodeURIComponent(clean)}`, {
      headers: apolloHeaders(key),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      organization?: { id?: string; name?: string; primary_domain?: string; industry?: string };
    };
    const org = json.organization;
    if (!org?.id) return null;
    return { id: org.id, name: org.name || clean, domain: org.primary_domain || clean, industry: org.industry };
  } catch (err) {
    console.warn(`[Apollo] organization enrich failed for ${clean}:`, err);
    return null;
  }
}

/** People Enrichment by Apollo person id (costs a credit). Returns the full name and a verified email only. */
export async function revealApolloPerson(personId: string, apiKey?: string): Promise<Omit<ResolvedContact, 'source'> | null> {
  const key = liveApolloKey(apiKey);
  if (!key || !personId) return null;
  try {
    const response = await fetch(`${APOLLO_BASE}/people/match`, {
      method: 'POST',
      headers: apolloHeaders(key),
      body: JSON.stringify({ id: personId }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as {
      person?: {
        id?: string;
        name?: string;
        first_name?: string;
        last_name?: string;
        title?: string;
        email?: string;
        email_status?: string;
        linkedin_url?: string;
        photo_url?: string;
        organization?: { name?: string; primary_domain?: string };
      };
    };
    const p = json.person;
    const name = (p?.name || [p?.first_name, p?.last_name].filter(Boolean).join(' ')).trim();
    if (!p || !name) return null;
    const verified = Boolean(p.email && isVerifiedEmailStatus(p.email_status));
    return {
      name,
      title: p.title || '',
      company: p.organization?.name || '',
      companyDomain: p.organization?.primary_domain || undefined,
      email: verified ? p.email : undefined,
      linkedinUrl: p.linkedin_url || undefined,
      avatarUrl: cleanPhoto(p.photo_url),
      apolloPersonId: p.id || personId,
      emailVerified: verified,
    };
  } catch (err) {
    console.warn(`[Apollo] reveal failed for ${personId}:`, err);
    return null;
  }
}

const WEAK_TITLE = /\b(office of|chief of staff|assistant|recruit|talent|intern|designer|coordinator|specialist|consultant|analyst|associate)\b/i;
const SENIOR_TITLE = /\b(ceo|chief executive|founder|co-founder|owner|president|managing director|managing partner|general manager|coo|cfo|cto|cmo|cro|chief [a-z]+ officer)\b/i;

/** Rank search hits: requested titles and senior roles first, weak "office of" roles last, emails preferred. */
export function rankApolloHits(hits: ApolloPersonHit[], buyerTitles: string[]): ApolloPersonHit[] {
  const wanted = buyerTitles.map((t) => t.toLowerCase()).filter(Boolean);
  const score = (hit: ApolloPersonHit) => {
    const title = hit.title.toLowerCase();
    let s = 0;
    if (wanted.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(title))) s += 4;
    if (SENIOR_TITLE.test(hit.title)) s += 3;
    if (WEAK_TITLE.test(hit.title)) s -= 6;
    if (hit.hasEmail) s += 2;
    return s;
  };
  return hits
    .map((hit, order) => ({ hit, order, s: score(hit) }))
    .sort((a, b) => b.s - a.s || a.order - b.order)
    .map((row) => row.hit);
}

async function revealTop(
  hits: ApolloPersonHit[],
  buyerTitles: string[],
  source: ContactSource,
  apiKey: string,
  fallbackCompany: string
): Promise<ResolvedContact[]> {
  const ranked = rankApolloHits(hits, buyerTitles).filter((hit) => !WEAK_TITLE.test(hit.title) || hits.length === 1);
  const out: ResolvedContact[] = [];
  for (const hit of ranked) {
    if (out.length >= APOLLO_MAX_REVEALS_PER_SIGNAL) break;
    const person = await revealApolloPerson(hit.id, apiKey);
    if (!person) continue;
    out.push({ ...person, title: person.title || hit.title, company: person.company || hit.organizationName || fallbackCompany, source });
  }
  return out;
}

/**
 * Always try to hand the user a contact:
 *  1. article  - person named in the article (People Match by name + company).
 *  2. company  - no named person: Apollo search at the article company for buyer titles.
 *  3. lookalike - company has nobody in Apollo: people at Apollo lookalikes of that company,
 *                 inside the service area (beta `lookalike_organization_ids`).
 *  4. related  - no company at all (or no seed): companies matching the buyer industries
 *                 inside the service area.
 */
export async function resolveSignalContacts(input: ContactResolutionInput, apiKey?: string): Promise<ContactResolution> {
  const trail: string[] = [];
  const key = liveApolloKey(apiKey);
  const titles = input.buyerTitles?.length ? input.buyerTitles : DEFAULT_BUYER_TITLES;
  const company = (input.companyName || '').trim();
  const domain = (input.companyDomain || '').trim();

  // 1. Person named in the article: keep them even without a verified email.
  if (input.articlePerson?.name) {
    const match = domain
      ? await findApolloContact(input.articlePerson.name, input.articlePerson.role, domain, apiKey)
      : ({ matched: false, status: 'fallback' } as ApolloContactResult);
    trail.push(`article:${match.status}`);
    return {
      source: 'article',
      trail,
      contacts: [
        {
          name: input.articlePerson.name,
          title: input.articlePerson.role,
          company,
          companyDomain: domain || undefined,
          email: match.email,
          linkedinUrl: match.linkedinUrl,
          avatarUrl: match.avatarUrl,
          source: 'article',
          emailVerified: match.status === 'verified',
        },
      ],
    };
  }

  if (!key) {
    trail.push('no_apollo_key');
    return { contacts: [], source: 'none', trail };
  }

  const STOP_CITIES = new Set([
    'vancouver', 'toronto', 'calgary', 'edmonton', 'montreal', 'ottawa', 'victoria', 'canada',
    'british columbia', 'ontario', 'alberta', 'morning', 'industry', 'business', 'the', 'new', 'city', 'enterprise'
  ]);
  const isRealCompany = company && !STOP_CITIES.has(company.toLowerCase()) && company.length >= 2;

  // 2. Article company, no named person.
  if (isRealCompany || domain) {
    const hits = await searchApolloPeople(
      domain
        ? { organizationDomains: [domain], personTitles: titles }
        : { organizationName: company, organizationLocations: input.locations, personTitles: titles },
      key
    );
    trail.push(`company:${hits.length}`);
    if (hits.length > 0) {
      const contacts = await revealTop(hits, titles, 'company', key, company);
      if (contacts.length > 0) return { contacts, source: 'company', trail };
    }

    // 3. Lookalikes of the article company (needs an Apollo org id seed).
    const seed = domain ? await enrichApolloOrganization(domain, key) : null;
    trail.push(`seed:${seed ? 'found' : 'none'}`);
    if (seed) {
      const lookalikes = await searchApolloPeople(
        { lookalikeOrganizationIds: [seed.id], organizationLocations: input.locations, personTitles: titles },
        key
      );
      trail.push(`lookalike:${lookalikes.length}`);
      const contacts = await revealTop(lookalikes, titles, 'lookalike', key, '');
      if (contacts.length > 0) return { contacts, source: 'lookalike', trail };
    }
  }

  // 4. Related companies matching the buyer profile in the service area.
  const tags = (input.industries || []).map((t) => t.trim()).filter(Boolean).slice(0, 5);
  if (tags.length > 0 || input.locations?.length) {
    const related = await searchApolloPeople(
      {
        ...(tags.length > 0 ? { organizationKeywordTags: tags } : {}),
        organizationLocations: input.locations,
        personTitles: titles,
      },
      key
    );
    trail.push(`related:${related.length}`);
    const contacts = await revealTop(related, titles, 'related', key, '');
    if (contacts.length > 0) return { contacts, source: 'related', trail };
  }

  return { contacts: [], source: 'none', trail };
}
