import type { QueryPlannerInput } from './aiQueryPlanner';

export type ServiceArea = 'local' | 'national';

export interface BuyerProfile {
  buyerIndustries: string[];
  buyerRoles: string[];
  buyerCompanySize: 'smb' | 'midmarket' | 'enterprise' | 'any';
  /** local = city, then province/state only. national = software, SaaS, agencies. */
  serviceArea: ServiceArea;
  allowNationalSearch: boolean;
}

function inferServiceArea(blob: string, intent?: string): ServiceArea {
  if (/(\bsaas\b|\bsoftware\b|marketing agency|digital agency|demand generation|\bplatform\b|\bapp\b)/.test(blob) && !/insurance|broker|managed it|\bmsp\b|contractor|real estate|lawyer|accountant/.test(blob)) {
    return 'national';
  }
  if (
    /lawyer|law firm|insurance|brokerage|broker|accountant|\bcpa\b|contractor|managed it|\bmsp\b|managed services|real estate|commercial broker|clinic/.test(blob) ||
    intent === 'subcontractor_partners'
  ) {
    return 'local';
  }
  return 'local';
}

function extractMentionedBuyerSectors(blob: string): string[] {
  const sectors: string[] = [];
  if (/\bclinics?\b|\bmedical\b|\bhealthcare\b|\bdental\b/.test(blob)) sectors.push('medical clinics');
  if (/\blaw firms?\b|\blegal\b|\battorneys?\b/.test(blob)) sectors.push('law firms');
  if (/\baccount(ing|ants?)\b|\bcpa\b/.test(blob)) sectors.push('accounting firms');
  if (/\bmanufactur(ing|ers?)\b|\bindustrial\b/.test(blob)) sectors.push('manufacturing');
  if (/\bconstruct(ion|ors?)\b|\bbuilders?\b|\bdevelopers?\b/.test(blob)) sectors.push('construction');
  if (/\bretail\b|\bhospitality\b|\brestaurants?\b/.test(blob)) sectors.push('retail');
  if (/\blogistics\b|\bfreight\b|\bwarehouse\b/.test(blob)) sectors.push('logistics');
  if (/\bsmb\b|\bsmall and mid[- ]?sized|\bsmall business|\bmid[- ]?market/.test(blob)) sectors.push('small business');
  if (/\btech(nology)?\b|\bsoftware\b|\bsaas\b|\bai\b/.test(blob) && !/cyber\s*(?:&|and)?\s*ai\s*(?:risk|insurance)/.test(blob)) {
    sectors.push('technology');
  }
  return sectors;
}

export function deriveBuyerProfile(input: QueryPlannerInput): BuyerProfile {
  const blob = `${(input.userMission || '')} ${(input.valueProp || '')} ${(input.companyDescription || '')} ${(input.servicesOffered || []).join(' ')} ${(input.targetIndustries || []).join(' ')}`.toLowerCase();
  const serviceArea: ServiceArea = input.serviceArea || inferServiceArea(blob, input.userIntent);
  const allowNationalSearch = serviceArea === 'national';

  if (input.buyerIndustries && input.buyerIndustries.length > 0) {
    return {
      buyerIndustries: input.buyerIndustries,
      buyerRoles: input.buyerRoles?.length ? input.buyerRoles : ['CEO', 'owner'],
      buyerCompanySize: input.buyerCompanySize || 'any',
      serviceArea,
      allowNationalSearch,
    };
  }

  const mentioned = extractMentionedBuyerSectors(blob);

  if (/captive/.test(blob)) {
    return {
      buyerIndustries: mentioned.length ? mentioned : ['manufacturing', 'healthcare systems', 'logistics', 'energy'],
      buyerRoles: ['CFO', 'treasurer', 'risk manager'],
      buyerCompanySize: 'enterprise',
      serviceArea,
      allowNationalSearch,
    };
  }
  if (/managed it|\bmsp\b|managed services|it support|it services/.test(blob)) {
    return {
      buyerIndustries: mentioned.length ? mentioned : ['medical clinics', 'law firms', 'professional services'],
      buyerRoles: ['owner', 'managing partner', 'operations director', 'IT manager'],
      buyerCompanySize: 'smb',
      serviceArea,
      allowNationalSearch,
    };
  }
  if (/cyber|ai risk|ai liability|cyber insurance/.test(blob)) {
    return {
      buyerIndustries: mentioned.length ? mentioned : ['small business', 'technology', 'healthcare', 'professional services'],
      buyerRoles: ['CEO', 'CFO', 'founder', 'COO'],
      buyerCompanySize: 'smb',
      serviceArea,
      allowNationalSearch,
    };
  }
  if (/property and casualty|casualty insurance|p&c|commercial insurance|commercial lines|insurance broker|insurance brokerage|insurance services/.test(blob)) {
    return {
      buyerIndustries: mentioned.length ? mentioned : ['contractors', 'manufacturing', 'logistics', 'commercial real estate'],
      buyerRoles: ['CFO', 'COO', 'CEO', 'risk manager', 'owner'],
      buyerCompanySize: 'smb',
      serviceArea,
      allowNationalSearch,
    };
  }
  if (/real estate|tenant representation|\blease\b|commercial broker/.test(blob)) {
    return {
      buyerIndustries: mentioned.length ? mentioned : ['law firms', 'professional services', 'corporate occupiers'],
      buyerRoles: ['managing partner', 'office director', 'COO'],
      buyerCompanySize: 'any',
      serviceArea,
      allowNationalSearch,
    };
  }
  if (/construct|contractor|general contracting/.test(blob) || input.userIntent === 'subcontractor_partners') {
    return {
      buyerIndustries: mentioned.length ? mentioned : ['property developers', 'building owners'],
      buyerRoles: ['development director', 'project owner'],
      buyerCompanySize: 'any',
      serviceArea,
      allowNationalSearch,
    };
  }
  if (/saas|software|marketing agency|demand generation/.test(blob)) {
    return {
      buyerIndustries: mentioned.length ? mentioned : ['b2b software'],
      buyerRoles: ['CMO', 'founder', 'VP marketing'],
      buyerCompanySize: 'smb',
      serviceArea,
      allowNationalSearch,
    };
  }

  return {
    buyerIndustries: mentioned.length ? mentioned : (input.targetIndustries?.length ? input.targetIndustries : ['business']),
    buyerRoles: input.targetRoles?.length ? input.targetRoles : ['CEO', 'owner'],
    buyerCompanySize: 'any',
    serviceArea,
    allowNationalSearch,
  };
}

export function splitPlace(location: string): { city: string; region: string; country: string } {
  const parts = location.split(',').map((part) => part.trim()).filter(Boolean);
  const regionNames = /^(ontario|alberta|british columbia|quebec|texas|california|florida|new york)$/i;
  if (parts.length >= 3) return { city: parts[0], region: parts[1], country: parts.slice(2).join(' ') };
  if (parts.length === 2) {
    if (regionNames.test(parts[0])) return { city: '', region: parts[0], country: parts[1] };
    return { city: parts[0], region: '', country: parts[1] };
  }
  return { city: parts[0] || '', region: '', country: '' };
}

const REGION_ALIASES: Record<string, string[]> = {
  'british columbia': ['british columbia', 'b.c.', ' bc '],
  ontario: ['ontario'],
  alberta: ['alberta'],
  quebec: ['quebec'],
  texas: ['texas'],
  california: ['california'],
};

/** City or province must be written out. "Canadian" does not prove a Vancouver or BC story. */
export function hasExplicitLocalEvidence(text: string, location: string, allowNationalSearch: boolean): { ok: boolean; reason: string } {
  const haystack = ` ${text.toLowerCase()} `;
  const place = splitPlace(location || '');
  if (place.city && haystack.includes(place.city.toLowerCase())) {
    return { ok: true, reason: `Names the city ${place.city}.` };
  }
  const region = place.region.toLowerCase();
  const aliases = REGION_ALIASES[region] || (region ? [region] : []);
  if (aliases.some((alias) => haystack.includes(alias))) {
    return { ok: true, reason: `Names the province or state ${place.region}.` };
  }
  if (allowNationalSearch && place.country && haystack.includes(place.country.toLowerCase())) {
    return { ok: true, reason: `National search is on and the article names ${place.country}.` };
  }
  return {
    ok: false,
    reason: 'No explicit city or province. A country word such as Canadian does not match a local profile.',
  };
}

export function companiesMatch(a: string, b: string): boolean {
  const norm = (value: string) =>
    value
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/\b(incorporated|inc|ltd|llc|corp|corporation|company|co|limited|group|the)\b/g, '')
      .replace(/[^a-z0-9]/g, '');
  const left = norm(a);
  const right = norm(b);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.length >= 4 && right.length >= 4 && (left.includes(right) || right.includes(left));
}

const BLOCKED_ROLES =
  /\b(minister|deputy minister|premier|mayor|councillor|senator|governor|mla|mp\b|public official|bureaucrat|journalist|reporter|columnist|analyst|investor|venture partner|lender|spokesperson)\b/i;

const BLOCKED_EMPLOYERS = /\b(bdc|business development bank|export development canada|edc|hub international|marsh|aon|willis|wtw)\b/i;

function quoteAppears(quote: string, source: string): boolean {
  const squash = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
  const needle = squash(quote);
  if (needle.length < 12) return false;
  return squash(source).includes(needle);
}

export interface EvidenceCheckInput {
  sourceText: string;
  buyerCompany: string;
  namedPerson: string;
  personEmployer: string;
  personRole: string;
  quotes: string[];
  location: string;
  allowNationalSearch: boolean;
  extractedName?: string;
  extractedEmployer?: string;
}

export function validateSignalEvidence(input: EvidenceCheckInput): { ok: boolean; reason: string } {
  if (!input.buyerCompany || !input.namedPerson) {
    return { ok: false, reason: 'Missing buyer company or named person.' };
  }
  if (!input.quotes.length || input.quotes.some((quote) => !quoteAppears(quote, input.sourceText))) {
    return { ok: false, reason: 'A claimed quote is not verbatim in the source text.' };
  }
  const source = input.sourceText.toLowerCase();
  if (!source.includes(input.namedPerson.toLowerCase()) || !source.includes(input.buyerCompany.toLowerCase())) {
    return { ok: false, reason: 'The person or buyer company is not in the source text.' };
  }
  const personAt = source.indexOf(input.namedPerson.toLowerCase());
  const window = source.slice(Math.max(0, personAt - 500), personAt + input.namedPerson.length + 500);
  if (!window.includes(input.buyerCompany.toLowerCase())) {
    return { ok: false, reason: 'The person and buyer company do not appear together.' };
  }
  if (input.personEmployer && !companiesMatch(input.personEmployer, input.buyerCompany)) {
    return { ok: false, reason: 'The person works at a different company than the buyer.' };
  }
  if (BLOCKED_ROLES.test(input.personRole) || BLOCKED_EMPLOYERS.test(input.personEmployer) || BLOCKED_EMPLOYERS.test(input.buyerCompany)) {
    return { ok: false, reason: 'The person is an official, journalist, investor, lender, or insurance intermediary.' };
  }
  if (input.extractedName && !companiesMatch(input.extractedName, input.namedPerson) && input.extractedName.toLowerCase() !== input.namedPerson.toLowerCase()) {
    return { ok: false, reason: 'Extraction and relevance name different people.' };
  }
  if (input.extractedEmployer && !companiesMatch(input.extractedEmployer, input.buyerCompany)) {
    return { ok: false, reason: 'Extraction and relevance name different companies.' };
  }
  const place = hasExplicitLocalEvidence(input.sourceText, input.location, input.allowNationalSearch);
  if (!place.ok) return place;
  return { ok: true, reason: 'Quotes, employer, and place check out.' };
}

export function isPolicyCommentary(title: string, body = ''): boolean {
  return /\b(federal budget|legislation|parliament|white paper|editorial|opinion:|national policy|bill c-|regulatory commentary)\b/i.test(
    `${title} ${body}`
  );
}
