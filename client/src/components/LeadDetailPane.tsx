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
import type { LeadCardData, SwipeAction } from '../types/lead';

interface LeadDetailPaneProps {
  lead: LeadCardData | null;
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
      <div className="h-full rounded-2xl glass-panel p-8 flex flex-col items-center justify-center text-center text-slate-400">
        <Layers className="w-12 h-12 text-slate-600 mb-3" />
        <h4 className="text-base font-semibold text-slate-300 mb-1">No Active Lead Selected</h4>
        <p className="text-xs max-w-xs">
          Select or swipe through the deck on the left to inspect intelligence signals and customize pitches.
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
    <div className={`h-full rounded-2xl glass-panel border border-white/10 flex flex-col overflow-hidden ${isMobileModal ? 'p-4' : ''}`}>
      {/* Pane Header */}
      <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-r from-white/[0.04] to-transparent flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {lead.parentSignalId && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shadow-sm">
                <Network className="w-2.5 h-2.5" />
                Branched Lead
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {lead.category}
            </span>
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lead.publishedAgo}
            </span>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {lead.fitScore}% Fit
            </span>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-white truncate font-display">
            {lead.headline}
          </h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenBranchOut && (
            <button
              onClick={() => onOpenBranchOut(lead)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-500/40 text-cyan-200 text-xs font-semibold shadow-glow-brand transition-all active:scale-95 shrink-0"
              title="Open Knowledge Graph: Scout competitors & internal peers"
            >
              <Network className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span className="hidden sm:inline">Branch Out</span>
            </button>
          )}

          {isMobileModal && onCloseMobileModal && (
            <button
              onClick={onCloseMobileModal}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center border-b border-white/10 px-4 bg-white/[0.01]">
        <button
          onClick={() => setActiveTab('pitch')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'pitch'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          <span>Pitch Studio</span>
        </button>
        <button
          onClick={() => setActiveTab('dossier')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'dossier'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Decision-Maker</span>
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === 'pipeline'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Signal Breakdown</span>
        </button>
      </div>

      {/* Pane Content Body */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
        {activeTab === 'pitch' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Customizable Email Pitch
              </span>
              <button
                onClick={handleCopyPitch}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy to Clipboard'}</span>
              </button>
            </div>

            {/* Subject input */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Subject Line
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  handleSaveDraft();
                }}
                className="w-full bg-[#090D14] text-slate-200 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Body editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Email Body
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  {body.length} chars • ~{Math.ceil(body.split(' ').length / 200 * 60)}s read
                </span>
              </div>
              <textarea
                rows={9}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  handleSaveDraft();
                }}
                className="w-full bg-[#090D14] text-slate-200 border border-white/10 rounded-lg p-3 text-xs font-mono leading-relaxed focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {/* Call to action pill */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <span className="text-xs text-slate-400">Target Call To Action:</span>
              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                {lead.emailDraft.cta}
              </span>
            </div>
          </div>
        )}

        {activeTab === 'dossier' && (
          <div className="space-y-4">
            {/* Decision maker profile card */}
            <div className="p-4 rounded-xl bg-[#090D14] border border-white/10 flex items-start gap-4">
              <ExecutiveAvatar
                name={lead.decisionMaker.name}
                avatarUrl={lead.decisionMaker.avatarUrl}
                size="lg"
              />
              <div className="flex-1">
                <h3 className="text-base font-bold text-white">{lead.decisionMaker.name}</h3>
                <p className="text-xs text-indigo-400 font-medium">{lead.decisionMaker.title}</p>
                <p className="text-xs text-slate-400">{lead.decisionMaker.company}</p>

                <div className="flex items-center gap-2 mt-3">
                  {lead.decisionMaker.email && (
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-white/5 text-slate-300 border border-white/10 font-mono">
                      <Mail className="w-3 h-3 text-emerald-400" />
                      {lead.decisionMaker.email}
                    </span>
                  )}
                  {lead.decisionMaker.linkedinUrl && (
                    <a
                      href={lead.decisionMaker.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-white/5 text-cyan-300 hover:bg-white/10 border border-white/10"
                    >
                      <LinkedInIcon className="w-3 h-3" />
                      LinkedIn
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Account Signals info */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Account Intelligence</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {lead.rawSignalSummary}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2">
                {lead.industryTags && lead.industryTags.length > 0
                  ? lead.industryTags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20"
                      >
                        #{tag}
                      </span>
                    ))
                  : lead.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 border border-white/10"
                      >
                        #{tag}
                      </span>
                    ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Core Signal Triad (3-Point Extraction)
            </h4>
            <div className="space-y-2.5">
              {lead.summaryBullets.map((bullet, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono border border-indigo-500/30 flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="text-[11px] font-bold text-indigo-300 block mb-0.5">
                      {idx === 0 ? 'Primary Trigger' : idx === 1 ? 'Operational Impact' : 'GTM Opportunity'}
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed">{bullet}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Source publication reference */}
            <div className="p-3 rounded-xl bg-[#090D14] border border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400">Source Publication: <strong className="text-white">{lead.source}</strong></span>
              <a
                href={lead.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300"
              >
                Open Article <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Knowledge Graph Multiplier Banner */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-indigo-950/30 to-purple-950/40 border border-cyan-500/30 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-bold text-cyan-200 flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  Knowledge Graph Multiplier
                </span>
                <p className="text-[11px] text-slate-300 truncate">
                  Scout competitor signals or key executives at {lead.companyName}.
                </p>
              </div>
              {onOpenBranchOut && (
                <button
                  onClick={() => onOpenBranchOut(lead)}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-cyan-200 text-xs font-semibold shrink-0 transition-colors"
                >
                  Explore Web
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pane Footer Action Buttons */}
      <div className="p-4 border-t border-white/10 bg-gradient-to-t from-white/[0.03] to-transparent flex items-center justify-between gap-3">
        <div className="text-[11px] text-slate-400 font-mono">
          Cost: <span className="text-emerald-400 font-semibold">10 credits</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onSwipe('pass')}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/30 text-xs font-bold tracking-wider uppercase transition-colors"
          >
            Pass Lead
          </button>
          {creditBalance !== undefined && creditBalance < 10 ? (
            <button
              onClick={onUpgradePrompt}
              className="px-5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold tracking-wider uppercase transition-all"
            >
              Need 10 Credits (Top Up)
            </button>
          ) : !isCrmConnected ? (
            <button
              type="button"
              onClick={onOpenCrmSettings}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-bold tracking-wider uppercase shadow-lg transition-all active:scale-95"
              title="Connect your CRM Private Integration Token to approve and push leads"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Connect CRM to Push</span>
            </button>
          ) : (
            <button
              onClick={() => onSwipe('approve')}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold tracking-wider uppercase shadow-glow-emerald transition-all active:scale-95"
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
