import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Mail,
  RefreshCw,
  Users,
  Zap,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  Printer,
  BookmarkCheck,
  HelpCircle,
  Lightbulb,
  Quote,
  Send,
} from 'lucide-react';
import { LinkedInIcon } from './icons';
import { ExecutiveAvatar } from './ExecutiveAvatar';
import type {
  PipelineContact,
  ResearchBrief,
  SimilarContactCandidate,
  SimilarOrganizationGroup,
} from '../types/contact';
import type { UserProfile } from '../types/lead';
import { authFetch } from '../utils/api';
import { openEmailClient } from '../utils/email';
import { isExternalArticleUrl } from '../utils/publishedAt';

interface OrganizationDetailPageProps {
  organizationName: string;
  contacts: PipelineContact[];
  user: UserProfile | null;
  copiedId: string | null;
  syncingContactId: string | null;
  unlockingApolloId: string | null;
  onBack: () => void;
  onCopy: (text: string, id: string, label?: string) => void;
  onSyncContact: (contact: PipelineContact) => void;
  onSelectContactDossier: (contact: PipelineContact) => void;
  onUnlockSimilar: (
    candidate: SimilarContactCandidate,
    context: { sourceCompanyName?: string; parentSignalId?: string; campaignId?: string | null },
    openAfterUnlock?: 'dossier' | 'organization'
  ) => Promise<void>;
  onOpenOrganization: (orgName: string) => void;
  onCreditsUpdated?: (creditBalance: number, totalPoints: number) => void;
  onToast?: (message: string) => void;
}

export const OrganizationDetailPage: React.FC<OrganizationDetailPageProps> = ({
  organizationName,
  contacts,
  user,
  copiedId,
  syncingContactId,
  unlockingApolloId,
  onBack,
  onCopy,
  onSyncContact,
  onSelectContactDossier,
  onUnlockSimilar,
  onOpenOrganization,
  onCreditsUpdated,
  onToast,
}) => {
  const [similarOrgs, setSimilarOrgs] = useState<SimilarOrganizationGroup[]>([]);
  const [similarMode, setSimilarMode] = useState<string>('');
  const [loadingSimilar, setLoadingSimilar] = useState<boolean>(false);

  const [brief, setBrief] = useState<ResearchBrief | null>(null);
  const [loadingBrief, setLoadingBrief] = useState<boolean>(false);
  const [generatingBrief, setGeneratingBrief] = useState<boolean>(false);
  const [savingBriefCrm, setSavingBriefCrm] = useState<boolean>(false);
  const [briefError, setBriefError] = useState<string | null>(null);
  const [briefIntroDraft, setBriefIntroDraft] = useState<{
    subject: string;
    body: string;
    recipientEmail: string | null;
  } | null>(null);

  const loadResearchBrief = React.useCallback(async () => {
    setLoadingBrief(true);
    setBriefError(null);
    setBriefIntroDraft(null);
    try {
      const res = await authFetch(
        `/api/contacts/organization/brief?orgName=${encodeURIComponent(organizationName)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBrief(data.brief || null);
        }
      }
    } catch (err) {
      console.error('Failed to load research brief:', err);
    } finally {
      setLoadingBrief(false);
    }
  }, [organizationName]);

  const loadSimilarOrganizations = React.useCallback(async () => {
    setLoadingSimilar(true);
    try {
      const res = await authFetch(
        `/api/contacts/organization/similar?companyName=${encodeURIComponent(organizationName)}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSimilarOrgs(data.similarOrganizations || []);
          setSimilarMode(data.mode || '');
        }
      }
    } catch (err) {
      console.error('Failed to load similar organizations:', err);
    } finally {
      setLoadingSimilar(false);
    }
  }, [organizationName]);

  useEffect(() => {
    loadSimilarOrganizations();
    loadResearchBrief();
  }, [loadSimilarOrganizations, loadResearchBrief]);
  // Deduplicate market signals for this organization
  const signals = React.useMemo(() => {
    const map = new Map<
      string,
      {
        signalId: string;
        signalTitle: string;
        signalType: string;
        sourceUrl: string;
        publishedAt: string;
        articleSummary: string | null;
        summaryBullets: string[];
      }
    >();
    for (const c of contacts) {
      if (!map.has(c.signalId)) {
        map.set(c.signalId, {
          signalId: c.signalId,
          signalTitle: c.signalTitle,
          signalType: c.signalType,
          sourceUrl: c.sourceUrl,
          publishedAt: c.publishedAt,
          articleSummary: c.articleSummary,
          summaryBullets: c.summaryBullets || [],
        });
      }
    }
    return Array.from(map.values());
  }, [contacts]);

  // Collect unique industry tags & campaigns
  const industryTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) {
      for (const tag of c.industryTags || []) {
        set.add(tag);
      }
    }
    return Array.from(set);
  }, [contacts]);

  const campaignNames = React.useMemo(() => {
    const set = new Set<string>();
    for (const c of contacts) {
      if (c.campaignName) set.add(c.campaignName);
    }
    return Array.from(set);
  }, [contacts]);

  const syncedCount = contacts.filter((c) => Boolean(c.ghlContactId)).length;
  const withEmailCount = contacts.filter((c) => Boolean(c.email)).length;

  const primarySignal = signals[0] || null;
  const primaryContact = contacts.find((c) => Boolean(c.email)) || contacts[0] || null;

  const handleGenerateBrief = async () => {
    setGeneratingBrief(true);
    setBriefError(null);
    try {
      const res = await authFetch('/api/contacts/organization/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName,
          signalId: primarySignal?.signalId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBriefError(data.error || 'Could not generate Research Brief.');
        return;
      }
      setBrief(data.brief);
      if (typeof data.creditBalance === 'number' && typeof data.totalPoints === 'number') {
        onCreditsUpdated?.(data.creditBalance, data.totalPoints);
      }
      onToast?.('Verified Research Brief generated (+15 XP)');
    } catch (err: any) {
      setBriefError(err?.message || 'Network error generating Research Brief.');
    } finally {
      setGeneratingBrief(false);
    }
  };

  const formatBriefPlainText = (b: ResearchBrief): string => {
    const facts = b.verifiedFacts
      .map((f, i) => `${i + 1}. ${f.statement}\n   Quote: "${f.verbatimQuote}"\n   Source: ${f.sourceLabel} (${f.sourceDate}) ${f.sourceUrl}`)
      .join('\n\n');
    const opps = b.inferredOpportunities
      .map((o, i) => `${i + 1}. [${o.confidence.toUpperCase()}] ${o.area}\n   ${o.rationale}`)
      .join('\n\n');
    const qs = b.investigationQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n');
    return `${b.briefTitle}\nGenerated: ${new Date(b.createdAt).toLocaleString()}\n\nVERIFIED FACTS\n${facts || 'None'}\n\nANALYTICAL ASSESSMENT — STRATEGIC OPPORTUNITIES & EXPOSURE\n${opps || 'None'}\n\nQUESTIONS WORTH INVESTIGATING\n${qs || 'None'}`;
  };

  const handleSaveBriefToCrm = async () => {
    if (!brief) return;
    setSavingBriefCrm(true);
    setBriefError(null);
    try {
      const res = await authFetch('/api/contacts/organization/brief/save-crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName,
          briefId: brief.id,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setBriefError(data.error || 'Could not save Research Brief to CRM Notes.');
        return;
      }
      onToast?.(data.message || 'Research Brief saved to CRM Notes.');
    } catch (err: any) {
      setBriefError(err?.message || 'Network error saving to CRM.');
    } finally {
      setSavingBriefCrm(false);
    }
  };

  const handleDraftTwoSentenceIntro = () => {
    if (!brief) return;
    const firstName = primaryContact?.name?.split(' ')[0] || 'there';
    const topFact = brief.verifiedFacts[0];
    const topOpp = brief.inferredOpportunities[0];
    const sourceRef = topFact?.sourceLabel ? ` in ${topFact.sourceLabel}` : '';
    const topicArea = topOpp?.area ? topOpp.area.toLowerCase() : 'your upcoming initiatives';
    const senderName = user?.name || '';
    const senderOrg = user?.organization?.replace(/\s*-\s*TwinFlow/i, '').trim() || '';
    const signOff = [senderName, senderOrg].filter(Boolean).join('\n');

    const sentence1 = `I saw the recent report${sourceRef} regarding ${organizationName}'s latest milestone.`;
    const sentence2 = `Given our focus on ${topicArea}, would you be open to a brief intro call to see if we can support your upcoming plans?`;

    setBriefIntroDraft({
      subject: `quick question re: ${organizationName}`,
      body: `Hi ${firstName},\n\n${sentence1} ${sentence2}\n\nBest,${signOff ? `\n${signOff}` : ''}`,
      recipientEmail: primaryContact?.email || null,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      {/* Breadcrumb / Back Navigation */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Back to Organizations</span>
        </button>

        <div className="text-xs text-slate-500">
          Organization Detail • {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'}
        </div>
      </div>

      {/* Organization Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 font-bold text-lg flex-shrink-0">
              {organizationName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-semibold uppercase tracking-wider">
                  Organization Account
                </span>
                {campaignNames.map((camp) => (
                  <span
                    key={camp}
                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-medium"
                  >
                    {camp}
                  </span>
                ))}
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mt-1.5 break-words">
                {organizationName}
              </h2>
              {industryTags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {industryTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-[11px] font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Account Summary Metrics */}
          <div className="grid grid-cols-3 gap-3 flex-shrink-0">
            <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200/80 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
                <Users className="w-3.5 h-3.5 text-blue-600" />
                <span>Contacts</span>
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">{contacts.length}</div>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200/80 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>CRM Synced</span>
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
                {syncedCount}/{contacts.length}
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-200/80 text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 font-medium">
                <Mail className="w-3.5 h-3.5 text-amber-600" />
                <span>Emails</span>
              </div>
              <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">{withEmailCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Institutional Research Brief (Teardown) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 print:border-0 print:shadow-none">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Research Brief
            </h3>
            {brief && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Verified Sources
              </span>
            )}
          </div>

          {brief && (
            <div className="text-[11px] text-slate-500">
              Generated {new Date(brief.createdAt).toLocaleString()}
            </div>
          )}
        </div>

        {briefError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700 font-medium">
            {briefError}
          </div>
        )}

        {loadingBrief ? (
          <div className="py-8 flex items-center justify-center gap-2 text-xs text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
            <span>Loading saved research brief...</span>
          </div>
        ) : !brief ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 max-w-2xl">
              <div className="text-sm font-semibold text-slate-900">
                Source-Verified Account Teardown
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Generate a source-verified 1-page research brief separating confirmed facts from strategic opportunities.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateBrief}
              disabled={generatingBrief}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60 flex-shrink-0"
            >
              {generatingBrief ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Verifying Sources...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Generate Research Brief (10 cr)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
              <h4 className="text-base font-bold text-slate-900">{brief.briefTitle}</h4>
              {brief.verificationLog && (
                <span className="text-[11px] text-slate-500">
                  {brief.verificationLog.keptFacts}/{brief.verificationLog.checkedFacts} claims verified
                </span>
              )}
            </div>

            {/* Verified Facts */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Verified Facts</span>
              </div>
              {brief.verifiedFacts.length === 0 ? (
                <p className="text-xs text-slate-500 italic">
                  No direct verbatim facts met the strict source verification threshold.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {brief.verifiedFacts.map((fact, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2"
                    >
                      <div className="text-xs font-semibold text-slate-900 leading-relaxed">
                        {fact.statement}
                      </div>
                      <div className="rounded-lg bg-white border border-slate-200/80 px-3 py-2 flex items-start gap-2">
                        <Quote className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] text-slate-600 italic leading-relaxed">
                          &ldquo;{fact.verbatimQuote}&rdquo;
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-500">
                        <span>Source Date: {fact.sourceDate}</span>
                        {fact.sourceUrl && isExternalArticleUrl(fact.sourceUrl) ? (
                          <a
                            href={fact.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:text-blue-800"
                          >
                            <span>{fact.sourceLabel}</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <span>{fact.sourceLabel}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Strategic Opportunities & Exposure */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-800">
                  <Lightbulb className="w-4 h-4 text-indigo-600" />
                  <span>Strategic Opportunities &amp; Exposure</span>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold uppercase tracking-wider">
                  Analytical Assessment
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {brief.inferredOpportunities.map((opp, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{opp.area}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          opp.confidence === 'high'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {opp.confidence}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{opp.rationale}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Questions Worth Investigating */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-800">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <span>Questions Worth Investigating</span>
              </div>
              <ul className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                {brief.investigationQuestions.map((q, idx) => (
                  <li key={idx} className="text-xs text-slate-700 flex items-start gap-2 leading-relaxed">
                    <span className="font-mono font-bold text-amber-600">{idx + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Action Bar */}
            <div className="pt-2 border-t border-slate-200 flex items-center gap-2 flex-wrap print:hidden">
              <button
                type="button"
                onClick={() => onCopy(formatBriefPlainText(brief), `brief-${brief.id}`, 'Research Brief')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                {copiedId === `brief-${brief.id}` ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-600" />
                )}
                <span>Copy Brief</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Print / Save PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSaveBriefToCrm}
                disabled={savingBriefCrm}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                {savingBriefCrm ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <BookmarkCheck className="w-3.5 h-3.5" />
                )}
                <span>Save to CRM Notes</span>
              </button>

              <button
                type="button"
                onClick={handleDraftTwoSentenceIntro}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-all cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Draft 2-Sentence Intro referencing Brief</span>
              </button>
            </div>

            {briefIntroDraft && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2.5 print:hidden">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                    2-Sentence Brief Intro Draft
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onCopy(
                          `Subject: ${briefIntroDraft.subject}\n\n${briefIntroDraft.body}`,
                          `brief-intro-${brief.id}`,
                          '2-Sentence Intro'
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-50 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        openEmailClient(
                          'gmail',
                          briefIntroDraft.recipientEmail,
                          briefIntroDraft.subject,
                          briefIntroDraft.body
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 border border-red-200 text-red-700 text-[11px] font-semibold hover:bg-red-100 cursor-pointer"
                    >
                      <Mail className="w-3 h-3" />
                      <span>Open in Gmail</span>
                    </button>
                  </div>
                </div>
                <div className="text-xs font-semibold text-slate-800">
                  Subject: <span className="font-normal text-slate-700">{briefIntroDraft.subject}</span>
                </div>
                <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white rounded-lg border border-slate-200 p-3">
                  {briefIntroDraft.body}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Triggering Market Signals */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Market Signals & Catalysts ({signals.length})
            </h3>
          </div>
        </div>

        <div className="space-y-3">
          {signals.map((sig) => (
            <div
              key={sig.signalId}
              className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                  {sig.signalType}
                </span>
                {sig.publishedAt && (
                  <span className="text-[11px] text-slate-500">
                    {new Date(sig.publishedAt).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="text-sm font-semibold text-slate-900">{sig.signalTitle}</div>

              {sig.articleSummary && (
                <p className="text-xs text-slate-600 leading-relaxed">{sig.articleSummary}</p>
              )}

              {sig.summaryBullets.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {sig.summaryBullets.map((bullet, idx) => (
                    <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                      <span className="text-blue-600 font-bold">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {isExternalArticleUrl(sig.sourceUrl) && (
                <div className="pt-2 border-t border-slate-200/80">
                  <a
                    href={sig.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    <span>Read Original Source Article</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decision Makers & Outreach Drafts */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
            Decision-Makers at {organizationName} ({contacts.length})
          </h3>
        </div>

        <div className="space-y-4">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="rounded-xl border border-slate-200 p-4 hover:border-blue-300/80 transition-colors space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <ExecutiveAvatar name={contact.name} avatarUrl={contact.avatarUrl} size="md" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{contact.name}</span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                        Verified
                      </span>
                      {contact.ghlContactId ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Synced to CRM
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Pending Sync
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{contact.title}</div>

                    {/* Email & LinkedIn */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {contact.email ? (
                        <button
                          type="button"
                          onClick={() => onCopy(contact.email!, `org-email-${contact.id}`, 'Email')}
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-700 hover:text-blue-600 cursor-pointer"
                          title="Copy email"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          <span>{contact.email}</span>
                          {copiedId === `org-email-${contact.id}` ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3 text-slate-400" />
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">Direct email pending</span>
                      )}

                      {contact.linkedinUrl && (
                        <a
                          href={contact.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          <LinkedInIcon className="w-3.5 h-3.5 text-blue-600 fill-current" />
                          <span>LinkedIn</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact Actions */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-shrink-0">
                  {!contact.ghlContactId && (
                    <button
                      type="button"
                      onClick={() => onSyncContact(contact)}
                      disabled={syncingContactId === contact.id}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {syncingContactId === contact.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      ) : (
                        'Sync CRM'
                      )}
                    </button>
                  )}

                  {contact.outreachDraft && (
                    <button
                      type="button"
                      onClick={() =>
                        openEmailClient(
                          'gmail',
                          contact.email,
                          contact.outreachDraft?.subject,
                          contact.outreachDraft?.body
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 text-xs font-semibold transition-all cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-red-600" />
                      <span>Gmail</span>
                      <ExternalLink className="w-3 h-3 opacity-70" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onSelectContactDossier(contact)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs transition-all cursor-pointer"
                  >
                    <span>Dossier</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tailored Outreach Draft Preview */}
              {contact.outreachDraft && (
                <div className="rounded-lg bg-slate-50 border border-slate-200/70 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>Outreach Pitch</span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      From: <span className="font-mono text-slate-600">{user?.email || 'demo@twinflow.co'}</span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-800">
                    Subject: <span className="font-normal text-slate-700">{contact.outreachDraft.subject}</span>
                  </div>
                  <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                    {contact.outreachDraft.body}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Similar Organizations & Contacts (Opportunity Chaining) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                Similar Organizations & Contacts
              </h3>
              <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-semibold">
                {similarMode === 'lookalike_org' ? 'Apollo Lookalikes' : 'Industry Peers'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Keep your momentum going — unlock a decision-maker at a similar organization to earn +25 XP and chain into your next account.
            </p>
          </div>

          <button
            type="button"
            onClick={loadSimilarOrganizations}
            disabled={loadingSimilar}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingSimilar ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {loadingSimilar ? (
          <div className="py-8 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
            <span>Scanning Apollo for organizations similar to {organizationName}...</span>
          </div>
        ) : similarOrgs.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200/70">
            No similar organizations found right now. Try refreshing or scouting new signals from the Lead Deck.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {similarOrgs.map((org) => (
              <div
                key={org.organizationName}
                className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                      {org.organizationName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="font-bold text-slate-900 text-sm truncate">
                      {org.organizationName}
                    </div>
                  </div>
                  <span className="text-[10px] font-medium text-slate-500 flex-shrink-0">
                    {org.contacts.length} {org.contacts.length === 1 ? 'contact' : 'contacts'}
                  </span>
                </div>

                <div className="space-y-2">
                  {org.contacts.map((cand) => {
                    const isUnlocking = unlockingApolloId === cand.apolloPersonId;
                    return (
                      <div
                        key={cand.apolloPersonId}
                        className="rounded-lg bg-white border border-slate-200/90 p-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 text-xs truncate">
                              {cand.firstName}
                            </span>
                            {cand.hasEmail && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex-shrink-0">
                                Email
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">{cand.title}</div>
                        </div>

                        <button
                          type="button"
                          disabled={Boolean(unlockingApolloId)}
                          onClick={() =>
                            onUnlockSimilar(
                              cand,
                              {
                                sourceCompanyName: organizationName,
                                parentSignalId: contacts[0]?.signalId,
                                campaignId: contacts[0]?.campaignId,
                              },
                              'organization'
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                          title="Unlock full contact & add to pipeline (-5 credits, +25 XP)"
                        >
                          {isUnlocking ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Zap className="w-3 h-3" />
                          )}
                          <span>{isUnlocking ? 'Unlocking...' : 'Unlock (-5 cr · +25 XP)'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => onOpenOrganization(org.organizationName)}
                  className="w-full text-center text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 pt-1 cursor-pointer hidden"
                >
                  Open Organization →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
