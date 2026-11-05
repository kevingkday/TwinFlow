import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Mail,
  Copy,
  Check,
  Sparkles,
  Send,
  X,
  Target,
  Clock,
  Layers,
  Activity,
  Network,
  KeyRound,
} from 'lucide-react';
import { LinkedInIcon } from './icons';
import { ExecutiveAvatar } from './ExecutiveAvatar';
import { openEmailClient } from '../utils/email';
import type { LeadCardData, SwipeAction } from '../types/lead';
import { isExternalArticleUrl } from '../utils/publishedAt';

interface LeadDetailPaneProps {
  lead: LeadCardData | null;
  user?: { email?: string; name?: string } | null;
  onSwipe: (action: SwipeAction) => void;
  onUpdateDraft?: (leadId: string, newSubject: string, newBody: string) => void;
  onCloseMobileModal?: () => void;
  isMobileModal?: boolean;
  creditBalance?: number;
  onUpgradePrompt?: () => void;
  onOpenBranchOut?: (lead: LeadCardData) => void;
  isCrmConnected?: boolean;
  onOpenCrmSettings?: () => void;
}

export const LeadDetailPane: React.FC<LeadDetailPaneProps> = ({
  lead,
  user,
  onSwipe,
  onUpdateDraft,
  onCloseMobileModal,
  isMobileModal = false,
  creditBalance,
  onUpgradePrompt,
  onOpenBranchOut,
  isCrmConnected = false,
  onOpenCrmSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'pitch' | 'dossier' | 'pipeline'>('pitch');
  const [subject, setSubject] = useState(lead?.emailDraft.subject || '');
  const [body, setBody] = useState(lead?.emailDraft.body || '');

  useEffect(() => {
    if (lead) {
      setSubject(lead.emailDraft.subject);
      setBody(lead.emailDraft.body);
    }
  }, [lead]);

  if (!lead) {
    return (
      <div className="h-full rounded-2xl bg-white border border-slate-200 p-8 flex flex-col items-center justify-center text-center text-slate-400">
        <Layers className="w-12 h-12 text-slate-300 mb-3" />
        <h4 className="text-base font-semibold text-slate-700 mb-1">No Active Lead Selected</h4>
        <p className="text-xs max-w-xs text-slate-500">
          Select or swipe through the deck to inspect intelligence signals and customize pitches.
        </p>
      </div>
    );
  }

  const handleCopyPitch = () => {
    const fullText = `Subject: ${subject}\n\n${body}`;
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveDraft = () => {
    if (onUpdateDraft && lead) {
      onUpdateDraft(lead.id, subject, body);
    }
  };

  return (
    <div className={`h-full rounded-2xl bg-white border border-slate-200 flex flex-col overflow-hidden shadow-sm ${isMobileModal ? 'p-2' : ''}`}>
      {/* Pane Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {lead.parentSignalId && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 shadow-2xs">
                <Network className="w-2.5 h-2.5" />
                Branched Lead
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {lead.category}
            </span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lead.publishedAgo}
            </span>
            <span className="text-[11px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              {lead.fitScore}% Fit
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 truncate font-display">
            {lead.headline}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenBranchOut && (
            <button
              onClick={() => onOpenBranchOut(lead)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-semibold transition-all active:scale-95 shrink-0"
              title="Open Knowledge Graph: Scout competitors & internal peers"
            >
              <Network className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden sm:inline">Branch Out</span>
            </button>
          )}

          {isMobileModal && onCloseMobileModal && (
            <button
              onClick={onCloseMobileModal}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center border-b border-slate-200 px-4 bg-white">
        <button
          onClick={() => setActiveTab('pitch')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'pitch'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Pitch Studio</span>
        </button>
        <button
          onClick={() => setActiveTab('dossier')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'dossier'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Decision-Maker</span>
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'pipeline'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Signal Breakdown</span>
        </button>
      </div>

      {/* Pane Content Body */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
        {activeTab === 'pitch' && (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                2-Sentence Pitch Studio
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const domain = (lead.companyName || lead.decisionMaker.company || 'domain')
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, '');
                    const recipient =
                      lead.decisionMaker.email ||
                      `${lead.decisionMaker.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${domain}.com`;
                    openEmailClient('gmail', recipient, subject, body);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 transition cursor-pointer shadow-2xs"
                  title="Launch Gmail web compose"
                >
                  <Mail className="w-3.5 h-3.5 text-red-600" />
                  <span>Open in Gmail</span>
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const domain = (lead.companyName || lead.decisionMaker.company || 'domain')
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, '');
                    const recipient =
                      lead.decisionMaker.email ||
                      `${lead.decisionMaker.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${domain}.com`;
                    openEmailClient('default', recipient, subject, body);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                  title="Launch default system mail client"
                >
                  <Send className="w-3 h-3 text-slate-500" />
                  <span>Mail App</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyPitch}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Sender / Recipient Metadata Bar */}
            <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400">From:</span>
                <span className="font-mono text-slate-800 font-medium truncate">{user?.email || 'demo@twinflow.co'}</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-100/70 text-red-700 font-medium">Gmail</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] uppercase font-bold text-slate-400">To:</span>
                <span className="font-mono text-slate-800 font-medium truncate">
                  {lead.decisionMaker.email ||
                    `${lead.decisionMaker.name.toLowerCase().replace(/[^a-z0-9]/g, '.')}@${(
                      lead.companyName ||
                      lead.decisionMaker.company ||
                      'domain'
                    )
                      .toLowerCase()
                      .replace(/[^a-z0-9]/g, '')}.com`}
                </span>
              </div>
            </div>

            {/* Subject input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  handleSaveDraft();
                }}
                className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono focus:outline-none focus:border-blue-600 shadow-2xs"
              />
            </div>

            {/* Body textarea */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1">
                2-Sentence Email Pitch
              </label>
              <textarea
                rows={7}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  handleSaveDraft();
                }}
                className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl p-3 text-xs font-mono leading-relaxed focus:outline-none focus:border-blue-600 resize-none shadow-2xs"
              />
            </div>
          </div>
        )}

        {activeTab === 'dossier' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3.5">
              <ExecutiveAvatar
                name={lead.decisionMaker.name}
                avatarUrl={lead.decisionMaker.avatarUrl}
                size="lg"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900">{lead.decisionMaker.name}</h3>
                  {lead.decisionMaker.linkedinUrl && (
                    <a
                      href={lead.decisionMaker.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-blue-600"
                    >
                      <LinkedInIcon className="w-4 h-4 fill-current" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  {lead.decisionMaker.title} @ <strong className="text-slate-800">{lead.decisionMaker.company}</strong>
                </p>

                {lead.decisionMaker.email && (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-slate-200 text-xs font-mono text-slate-700 shadow-2xs">
                    <Mail className="w-3.5 h-3.5 text-blue-600" />
                    <span>{lead.decisionMaker.email}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Core Signal Triad (3-Point Extraction)
            </h4>
            <div className="space-y-2.5">
              {lead.summaryBullets.map((bullet, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold font-mono border border-blue-200 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-[11px] font-bold text-blue-800 block mb-0.5">
                      {idx === 0 ? 'Primary Trigger' : idx === 1 ? 'Operational Impact' : 'Commercial Angle'}
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed">{bullet}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Source publication reference */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600">Source Publication: <strong className="text-slate-900">{lead.source}</strong></span>
              {isExternalArticleUrl(lead.sourceUrl) ? (
                <a
                  href={lead.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Open Article <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-slate-400">Example coverage, not a live link</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pane Footer Action Buttons */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-500 font-mono">
          Cost: <span className="text-emerald-700 font-semibold">10 credits</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSwipe('pass')}
            className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 hover:border-rose-300 text-xs font-semibold transition-colors shadow-2xs"
          >
            Pass Lead
          </button>
          {creditBalance !== undefined && creditBalance < 10 ? (
            <button
              onClick={onUpgradePrompt}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold transition-all shadow-xs"
            >
              Need 10 Credits (Top Up)
            </button>
          ) : !isCrmConnected ? (
            <button
              type="button"
              onClick={onOpenCrmSettings}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
              title="Connect your CRM Private Integration Token to approve and push leads"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Connect CRM to Push</span>
            </button>
          ) : (
            <button
              onClick={() => onSwipe('approve')}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Approve & Push to CRM</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
