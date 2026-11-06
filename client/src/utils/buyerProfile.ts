/** Mirrors server/src/services/buyerProfile.ts so onboarding can show and edit the derived buyers. */
export type ServiceArea = 'local' | 'national';

export interface BuyerProfileInput {
  userMission?: string;
  valueProp?: string;
  companyDescription?: string;
  targetIndustries?: string[];
  userIntent?: string;
  buyerIndustries?: string[];
  buyerRoles?: string[];
  buyerCompanySize?: 'smb' | 'midmarket' | 'enterprise' | 'any';
  serviceArea?: ServiceArea;
}

export interface BuyerProfile {
  buyerIndustries: string[];
  buyerRoles: string[];
  buyerCompanySize: 'smb' | 'midmarket' | 'enterprise' | 'any';
  serviceArea: ServiceArea;
}

function inferServiceArea(blob: string): ServiceArea {
  if (/saas|\bsoftware\b|marketing agency|demand generation/.test(blob)) return 'national';
  return 'local';
}

export function deriveBuyerProfile(input: BuyerProfileInput): BuyerProfile {
  const targetIndustriesArr = Array.isArray(input.targetIndustries)
    ? input.targetIndustries
    : typeof input.targetIndustries === 'string'
    ? [input.targetIndustries]
    : [];
  const blob = `${input.userMission || ''} ${input.valueProp || ''} ${input.companyDescription || ''} ${targetIndustriesArr.join(' ')}`.toLowerCase();
  const serviceArea = input.serviceArea || inferServiceArea(blob);
  if (Array.isArray(input.buyerIndustries) && input.buyerIndustries.length > 0) {
    return {
      buyerIndustries: input.buyerIndustries,
      buyerRoles: Array.isArray(input.buyerRoles) && input.buyerRoles.length ? input.buyerRoles : ['CEO', 'owner'],
      buyerCompanySize: input.buyerCompanySize || 'any',
      serviceArea,
    };
  }
  if (/captive/.test(blob)) {
    return { buyerIndustries: ['manufacturing', 'healthcare systems', 'logistics'], buyerRoles: ['CFO', 'treasurer', 'risk manager'], buyerCompanySize: 'enterprise', serviceArea };
  }
  if (/managed it|\bmsp\b|managed services/.test(blob)) {
    return { buyerIndustries: ['manufacturing', 'professional services', 'local business'], buyerRoles: ['owner', 'operations director'], buyerCompanySize: 'smb', serviceArea };
  }
  if (/cyber insurance|ai liability/.test(blob)) {
    return { buyerIndustries: ['technology', 'software'], buyerRoles: ['CEO', 'CFO', 'founder'], buyerCompanySize: 'smb', serviceArea };
  }
  if (/property and casualty|casualty insurance|p&c|commercial insurance|commercial lines|insurance broker|insurance brokerage|insurance services/.test(blob)) {
    return { buyerIndustries: ['contractors', 'manufacturing', 'logistics', 'commercial real estate'], buyerRoles: ['CFO', 'COO', 'CEO', 'risk manager', 'owner'], buyerCompanySize: 'smb', serviceArea };
  }
  if (/real estate|tenant representation|\blease\b|commercial broker/.test(blob)) {
    return { buyerIndustries: ['law firms', 'professional services', 'corporate occupiers'], buyerRoles: ['managing partner', 'office director'], buyerCompanySize: 'any', serviceArea };
  }
  if (/construct|contractor/.test(blob) || input.userIntent === 'subcontractor_partners') {
    return { buyerIndustries: ['property developers', 'building owners'], buyerRoles: ['development director'], buyerCompanySize: 'any', serviceArea };
  }
  if (/saas|software|marketing agency/.test(blob)) {
    return { buyerIndustries: ['b2b software'], buyerRoles: ['CMO', 'founder'], buyerCompanySize: 'smb', serviceArea };
  }
  return {
    buyerIndustries: input.targetIndustries?.length ? input.targetIndustries : ['operating companies'],
    buyerRoles: ['CEO', 'owner'],
    buyerCompanySize: 'any',
    serviceArea,
  };
}
