export interface PipelineContact {
  id: string;
  name: string;
  title: string;
  email: string | null;
  linkedinUrl: string | null;
  avatarUrl: string | null;
  ghlContactId: string | null;
  createdAt: string;
  updatedAt: string;
  companyName: string;
  signalId: string;
  signalTitle: string;
  signalType: string;
  sourceUrl: string;
  publishedAt: string;
  articleSummary: string | null;
  summaryBullets: string[];
  industryTags: string[];
  signalStatus: string;
  campaignId: string | null;
  campaignName: string | null;
  outreachDraft: {
    id: string;
    subject: string;
    body: string;
    status: string;
  } | null;
}

export interface PipelineStats {
  totalCount: number;
  organizationsCount: number;
  crmSyncedCount: number;
  withEmailCount: number;
}

export interface PipelineContactsResponse {
  success: boolean;
  contacts: PipelineContact[];
  stats: PipelineStats;
  error?: string;
}

