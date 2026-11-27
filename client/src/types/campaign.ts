export interface CustomerModel {
  idealCustomerTypes: string[];
  customerSize: string;
  buyingSignals: string[];
  serviceArea: 'local' | 'national';
}

export interface Campaign {
  id: string;
  name: string;
  organization?: string;
  website?: string;
  targetLocation: string;
  userIntent: string;
  userMission: string;
  companyDescription?: string;
  servicesOffered?: string[];
  productsOffered?: string[];
  targetIndustries: string[];
  targetTriggers: string[];
  targetRoles: string[];
  valueProp: string;
  icpQuery: string;
  buyerIndustries?: string[];
  buyerRoles?: string[];
  buyerCompanySize?: 'smb' | 'midmarket' | 'enterprise' | 'any';
  serviceArea?: 'local' | 'national';
  customerModel?: CustomerModel | null;
  isDefault: boolean;
  leadsCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignsResponse {
  success: boolean;
  activeCampaignId: string;
  campaigns: Campaign[];
  error?: string;
}

