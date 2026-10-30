export interface Campaign {
  id: string;
  name: string;
  targetLocation: string;
  userIntent: string;
  userMission: string;
  targetIndustries: string[];
  targetTriggers: string[];
  targetRoles: string[];
  valueProp: string;
  icpQuery: string;
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

