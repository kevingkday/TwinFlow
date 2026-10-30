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
  CheckCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Edit3,
  Network,
  Copy,
  Check,
} from 'lucide-react';
import { LinkedInIcon } from './icons';
import { ExecutiveAvatar } from './ExecutiveAvatar';
import type { LeadCardData, SwipeAction } from '../types/lead';

interface SwipeCardProps {
  lead: LeadCardData;
  isFront: boolean;
  onSwipe: (action: SwipeAction) => void;
  onOpenPitchEditor?: (lead: LeadCardData) => void;
  onSelectForDetail?: (lead: LeadCardData) => void;
  onOpenBranchOut?: (lead: LeadCardData) => void;
}

export const SwipeCard: React.FC<SwipeCardProps> = ({
  lead,
  isFront,
  onSwipe,
  onOpenPitchEditor,
  onOpenBranchOut,
}) => {
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-14, 0, 14]);
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

  const getScoreBadgeColor = (score: number) => {
    if (score >= 95) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 90) return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
    return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
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
    if (lead.decisionMaker.email) {
      navigator.clipboard.writeText(lead.decisionMaker.email);
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
        touchAction: 'none',
      }}
      drag={isFront ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.7}
      onDragEnd={isFront ? handleDragEnd : undefined}
      whileTap={isFront ? { cursor: 'grabbing' } : undefined}
      className={`absolute inset-0 w-full rounded-2xl select-none cursor-grab active:cursor-grabbing ${
        isFront ? 'z-20' : 'z-10'
      }`}
    >
      <div className="relative w-full h-full bg-[#101622] rounded-2xl border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        {/* Swipe Overlays */}
        {isFront && (
          <>
            {/* Approve Stamp (Swiping Right) */}
            <motion.div
              style={{ opacity: approveOpacity, scale: approveScale }}
              className="absolute top-8 left-8 z-30 pointer-events-none transform -rotate-12 px-5 py-2.5 rounded-xl bg-emerald-500/25 border-2 border-emerald-400 backdrop-blur-md shadow-2xl"
            >
              <div className="flex items-center gap-2 text-emerald-300 font-display font-black text-xl sm:text-2xl tracking-wider">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                APPROVE & QUEUE
              </div>
            </motion.div>

            {/* Pass Stamp (Swiping Left) */}
            <motion.div
              style={{ opacity: passOpacity, scale: passScale }}
              className="absolute top-8 right-8 z-30 pointer-events-none transform rotate-12 px-5 py-2.5 rounded-xl bg-rose-500/25 border-2 border-rose-400 backdrop-blur-md shadow-2xl"
            >
              <div className="flex items-center gap-2 text-rose-300 font-display font-black text-xl sm:text-2xl tracking-wider">
                PASS
              </div>
            </motion.div>
          </>
        )}

        {/* Card Header Bar */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
            {/* Badges: Category, Published Time */}
            <div className="flex items-center gap-2 flex-wrap">
              {lead.parentSignalId && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Network className="w-2.5 h-2.5" />
                  Branched Lead
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {lead.category}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3 text-slate-500" />
                {lead.publishedAgo}
              </span>
            </div>

            {/* Right: Branch Out Button + Fit Score Badge */}
            <div className="flex items-center gap-2">
              {onOpenBranchOut && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBranchOut(lead);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-white/[0.04] hover:bg-white/[0.08] text-cyan-300 border border-cyan-500/30 hover:border-cyan-400 transition-all active:scale-95 shadow-sm"
                  title="Branch Out: Scout competitors & internal peers"
                >
                  <Network className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Branch Out</span>
                </button>
              )}

              {/* Fit Score Badge */}
              <div
                className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${getScoreBadgeColor(
                  lead.fitScore
                )}`}
              >
                <TrendingUp className="w-3 h-3" />
                <span>{lead.fitScore}% Fit</span>
              </div>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-base sm:text-xl font-bold text-white leading-snug font-display mt-1">
            {lead.headline}
          </h2>

          {/* Source Link */}
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
            <span className="font-medium text-slate-300">{lead.source}</span>
            <span>•</span>
            <a
              href={lead.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              Read article <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Card Body: 2 Spacious Columns on md+ screens */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          {/* Left Column (md:col-span-5): Decision-Maker & Signal Intelligence */}
          <div className="md:col-span-5 flex flex-col gap-4">
            {/* Extracted Decision-Maker Card */}
            <div className="rounded-xl bg-white/[0.03] p-4 border border-white/[0.08] hover:border-white/15 transition-all">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Extracted Decision-Maker
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
                  Verified Prospect
                </span>
              </div>

              <div className="flex items-center gap-3">
                <ExecutiveAvatar
                  name={lead.decisionMaker.name}
                  avatarUrl={lead.decisionMaker.avatarUrl}
                  size="lg"
                  className="w-12 h-12 text-sm flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-white truncate">
                      {lead.decisionMaker.name}
                    </h3>
                    {lead.decisionMaker.linkedinUrl && (
                      <a
                        href={lead.decisionMaker.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-cyan-400 transition-colors p-0.5"
                        title="View LinkedIn Profile"
                      >
                        <LinkedInIcon className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-indigo-300 font-medium truncate">
                    {lead.decisionMaker.title}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {lead.decisionMaker.company}
                  </p>
                </div>
              </div>

              {lead.decisionMaker.email && (
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-mono truncate">
                    <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                    <span className="truncate">{lead.decisionMaker.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                    title="Copy Email"
                  >
                    {copiedEmail ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Key Signal Intelligence (3-Point Summary) */}
            <div className="flex-1 flex flex-col justify-start">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  Key Signal Intelligence
                </span>
              </div>
              <ul className="space-y-2">
                {lead.summaryBullets.map((bullet, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 text-xs text-slate-300 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.05]"
                  >
                    <span className="flex-shrink-0 w-4 h-4 rounded-full bg-indigo-500/15 text-indigo-300 flex items-center justify-center text-[10px] font-mono font-bold mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column (md:col-span-7): Pitch Studio */}
          <div className="md:col-span-7 flex flex-col rounded-xl bg-black/30 p-4 border border-white/[0.08] relative">
            <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-white/[0.06]">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>Customizable Outbound Pitch</span>
                <span className="text-[10px] text-slate-500 font-mono font-normal">
                  ({lead.emailDraft.estimatedReadTime})
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyPitch}
                  className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 hover:text-white transition-colors"
                  title="Copy subject & body"
                >
                  {copiedPitch ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-400" />
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
                    className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/25 transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            </div>

            {/* Subject Line */}
            <div className="text-xs mb-2">
              <span className="text-slate-500 font-medium">Subject: </span>
              <span className="text-slate-200 font-semibold">{lead.emailDraft.subject}</span>
            </div>

            {/* Body */}
            <div className="flex-1 p-3 rounded-lg bg-[#080C14] border border-white/[0.05] text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap select-text min-h-[160px]">
              {lead.emailDraft.body}
            </div>

            {lead.industryTags && lead.industryTags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/[0.06] flex-wrap">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Tags:</span>
                {lead.industryTags.map((tag, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.03] text-slate-400 border border-white/[0.06]"
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
