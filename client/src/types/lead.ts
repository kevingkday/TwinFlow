export interface DecisionMaker {
  id: string;
  name: string;
  title: string;
  company: string;
  avatarUrl?: string;
  email?: string;
  linkedinUrl?: string;
  isEnriched?: boolean;
}

export interface EmailDraft {
  id?: string;
  subject: string;
  body: string;
  cta?: string;
  estimatedReadTime?: string;
}

export type SignalCategory = 
  | 'Series A/B Funding'
  | 'Series B Funding'
  | 'Executive Leadership'
  | 'Enterprise Expansion'
  | 'AI Infrastructure'
  | 'Product Launch'
  | 'Regulatory Pivot'
  | string;

export interface LeadCardData {
  id: string;
  parentSignalId?: string | null;
  headline: string;
  companyName?: string;
  source: string;
  sourceUrl: string;
  publishedAgo: string;
  category: SignalCategory;
  fitScore: number;
  summaryBullets: string[];
  articleSummary?: string;
  decisionMaker: DecisionMaker;
  contacts?: DecisionMaker[];
  emailDraft: EmailDraft;
  rawSignalSummary: string;
  tags: string[];
  industryTags?: string[];
}

export type SwipeDirection = 'left' | 'right';
export type SwipeAction = 'pass' | 'approve';

export interface SwipeStats {
  approvedCount: number;
  passedCount: number;
  remainingCount: number;
  streak: number;
  creditsRemaining: number;
  totalPoints: number;
  branchCombo?: number;
}

export interface BranchEntity {
  id: string;
  entityType: 'competitor' | 'internal_peer';
  name: string;
  domain?: string | null;
  reason: string;
  status: 'unexplored' | 'explored';
}

export interface BranchesResponse {
  success: boolean;
  signalId: string;
  companyName: string;
  parentSignalId?: string | null;
  branches: BranchEntity[];
  error?: string;
}

export interface BranchScoutResponse {
  success: boolean;
  newSignal: ApiSignalItem;
  user: {
    id: string;
    email: string;
    creditBalance: number;
    streakCount: number;
    totalPoints: number;
  };
  branchCombo: number;
  creditsDeducted: number;
  pointsAwarded: number;
  message: string;
  insufficientCredits?: boolean;
  error?: string;
}

export interface ApiSignalItem {
  id: string;
  parentSignalId?: string | null;
  title: string;
  sourceUrl: string;
  publishedAt: string;
  summaryBullets: string[];
  articleSummary?: string | null;
  companyName: string;
  signalType: string;
  industryTags?: string[];
  status: 'queued' | 'approved' | 'dismissed';
  contacts?: Array<{
    id: string;
    name: string;
    title: string;
    company?: string;
    email?: string | null;
    linkedinUrl?: string | null;
    avatarUrl?: string | null;
    isEnriched?: boolean;
  }>;
  contact: {
    id: string;
    name: string;
    title: string;
    company?: string;
    email?: string | null;
    linkedinUrl?: string | null;
    avatarUrl?: string | null;
    isEnriched?: boolean;
  } | null;
  outreachDraft: {
    id: string;
    subject: string;
    body: string;
    status: 'draft' | 'sent';
  } | null;
}

export interface ApiDeckResponse {
  success: boolean;
  count: number;
  signals: ApiSignalItem[];
  user: {
    id: string;
    email: string;
    creditBalance: number;
    streakCount: number;
    totalPoints: number;
  };
  error?: string;
}

export interface ApiActionResponse {
  success: boolean;
  action: 'approve' | 'pass';
  signal: {
    id: string;
    status: 'approved' | 'dismissed';
  };
  user: {
    id: string;
    creditBalance: number;
    streakCount: number;
    totalPoints: number;
  };
  ghl?: {
    contactId: string;
    synced: boolean;
    mock: boolean;
  };
  creditsDeducted?: number;
  pointsAwarded?: number;
  message?: string;
  insufficientCredits?: boolean;
  crmNotConnected?: boolean;
  error?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  role?: 'admin' | 'user';
  isAdmin?: boolean;
  organization?: string | null;
  avatarUrl?: string | null;
  ghlSubaccountId?: string | null;
  isGhlConnected: boolean;
  hasCustomGhlKey: boolean;
  ghlApiKeyMasked?: string | null;
  creditBalance: number;
  streakCount: number;
  totalPoints: number;
  onboardingCompleted?: boolean;
  icpQuery?: string | null;
  targetLocation?: string | null;
  userIntent?: string | null;
  userMission?: string | null;
  targetIndustries?: string[];
  targetTriggers?: string[];
  targetRoles?: string[];
  valueProp?: string | null;
}

export interface AuthResponse {
  success: boolean;
  authenticated?: boolean;
  user?: UserProfile;
  token?: string;
  subaccount?: {
    id: string;
    name: string;
    mock: boolean;
  };
  error?: string;
  message?: string;
}

export interface OnboardingData {
  targetLocation: string;
  userIntent: string;
  userMission: string;
  targetIndustries: string[];
  targetTriggers: string[];
  targetRoles: string[];
  valueProp: string;
}

export interface GhlSubaccountOption {
  id: string;
  name: string;
  email?: string;
  timezone?: string;
  country?: string;
}

