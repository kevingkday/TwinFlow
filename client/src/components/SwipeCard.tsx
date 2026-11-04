import React, { useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import {
  ExternalLink,
  Mail,
  Clock,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Edit3,
  Network,
  Copy,
  Check,
  Users,
  Radio,
  Send,
} from 'lucide-react';
import { LinkedInIcon } from './icons';
import { ExecutiveAvatar } from './ExecutiveAvatar';
import { openEmailClient } from '../utils/email';
import type { LeadCardData, SwipeAction, DecisionMaker } from '../types/lead';

interface SwipeCardProps {
  lead: LeadCardData;
  isFront?: boolean;
  senderEmail?: string;
  senderName?: string;
  onSwipe: (action: SwipeAction) => void;
  onOpenPitchEditor?: (lead: LeadCardData) => void;
  onSelectForDetail?: (lead: LeadCardData) => void;
  onOpenBranchOut?: (lead: LeadCardData) => void;
  onSelectContact?: (leadId: string, contact: DecisionMaker) => void;
  onEnrichContact?: (leadId: string, contact: DecisionMaker) => Promise<void>;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  lead,
  isFront = true,
  senderEmail,
  onSwipe,
  onOpenPitchEditor,
  onOpenBranchOut,
  onSelectContact,
  onEnrichContact,
}) => {
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);

  const currentContact = lead.decisionMaker;
  const effectiveSenderEmail = senderEmail || 'demo@twinflow.co';
  const effectiveRecipientEmail =
    currentContact.email ||
    `${(currentContact.name || 'contact').toLowerCase().replace(/[^a-z0-9]/g, '.')}@${(lead.companyName || 'domain')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')}.com`;
  const contactsList = lead.contacts && lead.contacts.length > 0 ? lead.contacts : [lead.decisionMaker];

  const handleSelectContact = (contact: DecisionMaker) => {
    onSelectContact?.(lead.id, contact);
  };

  const handleEnrich = async (contact: DecisionMaker) => {
    if (isEnriching) return;
    setIsEnriching(true);
    try {
      if (onEnrichContact) {
        await onEnrichContact(lead.id, contact);
      }
    } finally {
      setIsEnriching(false);
    }
  };

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-10, 0, 10]);
  const opacity = useTransform(x, [-300, -200, 0, 200, 300], [0, 1, 1, 1, 0]);

  // Opacity of "APPROVE" indicator (drag right)
  const approveOpacity = useTransform(x, [20, 100], [0, 1]);
  const approveScale = useTransform(x, [20, 100], [0.8, 1.05]);

  // Opacity of "PASS" indicator (drag left)
  const passOpacity = useTransform(x, [-20, -100], [0, 1]);
  const passScale = useTransform(x, [-20, -100], [0.8, 1.05]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = 100;
    const velocityThreshold = 400;

    if (info.offset.x > threshold || info.velocity.x > velocityThreshold) {
      onSwipe('approve');
    } else if (info.offset.x < -threshold || info.velocity.x < -velocityThreshold) {
      onSwipe('pass');
    }
  };

  const handleCopyPitch = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `Subject: ${lead.emailDraft.subject}\n\n${lead.emailDraft.body}`;
    navigator.clipboard.writeText(text);
    setCopiedPitch(true);
    setTimeout(() => setCopiedPitch(false), 2000);
  };

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentContact.email) {
      navigator.clipboard.writeText(currentContact.email);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    }
  };

  return (
    <motion.div
      style={{
        x: isFront ? x : 0,
        rotate: isFront ? rotate : 0,
        opacity: isFront ? opacity : 1,
        touchAction: 'pan-y',
      }}
      drag={isFront ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.65}
      onDragEnd={isFront ? handleDragEnd : undefined}
      whileTap={isFront ? { cursor: 'grabbing' } : undefined}
      className={`relative w-full rounded-2xl select-none cursor-grab active:cursor-grabbing ${
        isFront ? 'z-20' : 'z-10'
      }`}
    >
      <div className="relative w-full bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col overflow-hidden text-slate-800">
        {/* Swipe Visual Feedback Stamps */}
        {isFront && (
          <>
            {/* Approve Stamp */}
            <motion.div
              style={{ opacity: approveOpacity, scale: approveScale }}
              className="absolute top-8 left-8 z-30 pointer-events-none transform -rotate-12 px-6 py-2.5 rounded-2xl bg-emerald-600 text-white border-2 border-emerald-500 shadow-xl"
            >
              <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl tracking-wider">
                APPROVE
              </div>
            </motion.div>

            {/* Pass Stamp */}
            <motion.div
              style={{ opacity: passOpacity, scale: passScale }}
              className="absolute top-8 right-8 z-30 pointer-events-none transform rotate-12 px-6 py-2.5 rounded-2xl bg-rose-600 text-white border-2 border-rose-500 shadow-xl"
            >
              <div className="flex items-center gap-2 font-bold text-xl sm:text-2xl tracking-wider">
                PASS
              </div>
            </motion.div>
          </>
        )}

        {/* Card Header Section: Editorial Catalyst Headline */}
        <div className="p-5 sm:p-7 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between gap-3 mb-2.5 flex-wrap">
            {/* Category & Time Meta */}
            <div className="flex items-center gap-2 flex-wrap">
              {lead.parentSignalId && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200 flex items-center gap-1">
                  <Network className="w-3 h-3 text-cyan-600" />
                  Branched Lead
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                {lead.category}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {lead.publishedAgo}
              </span>
            </div>

            {/* Right Side: Branch Out Action & Fit Indicator */}
            <div className="flex items-center gap-2.5">
              {onOpenBranchOut && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBranchOut(lead);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition-all active:scale-95 cursor-pointer"
                  title="Branch Out: Scout competitors & internal peers"
                >
                  <Network className="w-3.5 h-3.5 text-blue-600" />
                  <span>Branch Out</span>
                </button>
              )}

              {/* Clean Fit Score Pill */}
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <TrendingUp className="w-3 h-3 text-emerald-600" />
                <span>{lead.fitScore}% Fit</span>
              </div>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug tracking-tight font-sans mt-1">
            {lead.headline}
          </h2>

          {/* Source Link Byline */}
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 font-medium">
            <span className="text-slate-600 font-semibold">{lead.source}</span>
            <span>•</span>
            <a
              href={lead.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              Read full article <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Executive Article Summary Callout */}
          {lead.articleSummary && (
            <div className="mt-3.5 p-3.5 sm:p-4 rounded-xl bg-slate-50 border-l-4 border-blue-600 text-slate-700 text-xs sm:text-[13px] leading-relaxed">
              <span className="text-[11px] uppercase font-bold text-blue-700 tracking-wider block mb-1">
                Article Brief & Context
              </span>
              <p className="text-slate-700 leading-relaxed font-sans">{lead.articleSummary}</p>
            </div>
          )}
        </div>

        {/* Card Body: Expansive 2-Column Desktop Layout */}
        <div className="p-5 sm:p-7 grid grid-cols-1 md:grid-cols-12 gap-7 lg:gap-8 items-start">
          {/* Left Column (md:col-span-5): People & Signal Intelligence */}
          <div className="md:col-span-5 flex flex-col gap-5">
            {/* Key Names Detected in Article */}
            {contactsList.length > 1 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Key People in Article ({contactsList.length})
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Click to select target</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {contactsList.map((c) => {
                    const isSelected = c.id === currentContact.id || c.name === currentContact.name;
                    const isEnriched = Boolean(c.email || c.linkedinUrl || c.isEnriched);
                    return (
                      <button
                        key={c.id || c.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectContact(c);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                        title={isEnriched ? 'Verified contact dossier' : 'Pending enrichment'}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            isEnriched ? (isSelected ? 'bg-white' : 'bg-emerald-500') : (isSelected ? 'bg-amber-200' : 'bg-amber-500')
                          }`}
                        />
                        <span>{c.name}</span>
                        <span className={`text-[10px] hidden sm:inline ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                          ({c.title})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Target Decision-Maker Dossier */}
            <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Target Decision-Maker
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                    currentContact.email || currentContact.linkedinUrl || currentContact.isEnriched
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {currentContact.email || currentContact.linkedinUrl || currentContact.isEnriched
                    ? 'Verified Prospect'
                    : 'Pending Enrichment'}
                </span>
              </div>

              <div className="flex items-center gap-3.5">
                <ExecutiveAvatar
                  name={currentContact.name}
                  avatarUrl={currentContact.avatarUrl}
                  size="lg"
                  className="w-13 h-13 text-sm flex-shrink-0 shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {currentContact.name}
                    </h3>
                    {currentContact.linkedinUrl && (
                      <a
                        href={currentContact.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-blue-600 transition-colors p-0.5"
                        title="View LinkedIn Profile"
                      >
                        <LinkedInIcon className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs font-semibold text-blue-600 truncate mt-0.5">
                    {currentContact.title}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {currentContact.company || lead.companyName}
                  </p>
                </div>
              </div>

              {currentContact.email ? (
                <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-mono truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate select-text">{currentContact.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-500 hover:text-slate-800 transition-colors flex-shrink-0 cursor-pointer"
                    title="Copy Email"
                  >
                    {copiedEmail ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ) : (
                <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnrich(currentContact);
                    }}
                    disabled={isEnriching}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {isEnriching ? (
                      <>
                        <Radio className="w-3.5 h-3.5 animate-spin text-white" />
                        <span>Enriching Dossier via Apollo...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                        <span>Enrich {currentContact.name.split(' ')[0]} (Find Verified Email)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Key Signal Intelligence: Clean Typographic List */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                Key Signal Intelligence
              </span>
              <ul className="space-y-2.5">
                {lead.summaryBullets.map((bullet, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-xs sm:text-[13px] text-slate-700 leading-relaxed"
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-[11px] font-bold font-mono mt-0.5 border border-blue-200/60">
                      {idx + 1}
                    </span>
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column (md:col-span-7): Pitch Studio */}
          <div className="md:col-span-7 flex flex-col justify-between">
            <div>
              {/* Pitch Studio Header */}
              <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span>Outbound Pitch Studio</span>
                  <span className="text-xs text-slate-400 font-normal">
                    ({lead.emailDraft.estimatedReadTime})
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEmailClient('gmail', effectiveRecipientEmail, lead.emailDraft.subject, lead.emailDraft.body);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 transition cursor-pointer shadow-2xs"
                    title="Launch Gmail web compose with pre-filled recipient, subject, and 2-sentence pitch"
                  >
                    <Mail className="w-3.5 h-3.5 text-red-600" />
                    <span>Gmail</span>
                    <ExternalLink className="w-3 h-3 opacity-70" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEmailClient('default', effectiveRecipientEmail, lead.emailDraft.subject, lead.emailDraft.body);
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
                    title="Copy subject & body"
                  >
                    {copiedPitch ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                  {onOpenPitchEditor && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenPitchEditor(lead);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 transition cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>

              {/* From / To email routing bar */}
              <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400">From:</span>
                  <span className="font-mono text-slate-800 truncate font-medium">{effectiveSenderEmail}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-100/70 text-red-700 font-medium">Gmail</span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400">To:</span>
                  <span className="font-mono text-slate-800 truncate font-medium">{effectiveRecipientEmail}</span>
                </div>
              </div>

              {/* Subject Line */}
              <div className="text-xs mb-2.5 flex items-baseline gap-1.5">
                <span className="text-slate-400 font-medium">Subject:</span>
                <span className="text-slate-900 font-bold text-sm tracking-tight">{lead.emailDraft.subject}</span>
              </div>

              {/* Email Body: Clean Readable Compose View (Strict 2-Sentence Standard) */}
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs sm:text-[13px] text-slate-800 leading-relaxed whitespace-pre-wrap select-text font-sans selection:bg-blue-100">
                {lead.emailDraft.body}
              </div>

              {/* 1-Click Send Strip */}
              <div className="mt-2.5 flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  Quick Launch:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEmailClient('gmail', effectiveRecipientEmail, lead.emailDraft.subject, lead.emailDraft.body);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white hover:bg-red-50 text-slate-800 hover:text-red-700 border border-slate-200 hover:border-red-200 shadow-2xs transition cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-red-600" />
                    <span>Open in Gmail</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEmailClient('default', effectiveRecipientEmail, lead.emailDraft.subject, lead.emailDraft.body);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs transition cursor-pointer"
                  >
                    <span>Default Mail</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Industry Tags */}
            {lead.industryTags && lead.industryTags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 flex-wrap">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">Tags:</span>
                {lead.industryTags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 font-medium border border-slate-200/60"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
