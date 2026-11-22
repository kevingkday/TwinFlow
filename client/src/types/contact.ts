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

export interface SimilarContactCandidate {
  apolloPersonId: string;
  firstName: string;
  title: string;
  organizationName: string;
  hasEmail: boolean;
}

export interface SimilarOrganizationGroup {
  organizationName: string;
  contacts: SimilarContactCandidate[];
}

export interface VerifiedFact {
  statement: string;
  sourceUrl: string;
  sourceLabel: string;
  sourceDate: string;
  verbatimQuote: string;
}

export interface InferredOpportunity {
  area: string;
  rationale: string;
  confidence: 'high' | 'medium';
}

export interface VerificationLog {
  checkedFacts: number;
  keptFacts: number;
  rejectedFacts: number;
  rewrittenFacts: number;
  rewrittenOpportunities: number;
  pass2Mode: 'openai' | 'deterministic';
  notes: string[];
}

export interface ResearchBrief {
  id: string;
  organizationName: string;
  companyDomain: string | null;
  signalId: string | null;
  briefTitle: string;
  verifiedFacts: VerifiedFact[];
  inferredOpportunities: InferredOpportunity[];
  investigationQuestions: string[];
  verificationLog: VerificationLog | null;
  createdAt: string;
}

