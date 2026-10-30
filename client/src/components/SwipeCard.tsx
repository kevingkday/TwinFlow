import React from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo
} from 'framer-motion';
import {
  ExternalLink,
  Mail,
  CheckCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
  Edit3,
  Network
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
  onSelectForDetail,
  onOpenBranchOut,
}) => {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-250, 0, 250], [-18, 0, 18]);
  const opacity = useTransform(x, [-300, -200, 0, 200, 300], [0, 1, 1, 1, 0]);

  // Opacity of "APPROVE" indicator (drag right)
  const approveOpacity = useTransform(x, [20, 100], [0, 1]);
  const approveScale = useTransform(x, [20, 100], [0.8, 1.1]);

  // Opacity of "PASS" indicator (drag left)
  const passOpacity = useTransform(x, [-20, -100], [0, 1]);
  const passScale = useTransform(x, [-20, -100], [0.8, 1.1]);

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
      dragElastic={0.8}
      onDragEnd={isFront ? handleDragEnd : undefined}
      whileTap={isFront ? { cursor: 'grabbing' } : undefined}
      className={`absolute inset-0 w-full rounded-2xl select-none cursor-grab active:cursor-grabbing ${
        isFront ? 'z-20' : 'z-10'
      }`}
    >
      <div className="relative w-full h-full bg-[#111827] rounded-2xl border border-white/10 shadow-card-depth flex flex-col overflow-hidden">
        
        {/* Swipe Overlays */}
        {isFront && (
          <>
            {/* Approve Stamp (Swiping Right) */}
            <motion.div
              style={{ opacity: approveOpacity, scale: approveScale }}
              className="absolute top-8 left-6 z-30 pointer-events-none transform -rotate-12 px-4 py-2 rounded-xl bg-emerald-500/20 border-2 border-emerald-400 backdrop-blur-md shadow-glow-emerald"
            >
              <div className="flex items-center gap-2 text-emerald-300 font-display font-black text-xl sm:text-2xl tracking-wider">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
                APPROVE & QUEUE
              </div>
            </motion.div>

            {/* Pass Stamp (Swiping Left) */}
            <motion.div
              style={{ opacity: passOpacity, scale: passScale }}
              className="absolute top-8 right-6 z-30 pointer-events-none transform rotate-12 px-4 py-2 rounded-xl bg-rose-500/20 border-2 border-rose-400 backdrop-blur-md shadow-glow-rose"
            >
              <div className="flex items-center gap-2 text-rose-300 font-display font-black text-xl sm:text-2xl tracking-wider">
                PASS
              </div>
            </motion.div>
          </>
        )}

        {/* Card Header Bar */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent">
          <div className="flex items-center justify-between gap-2 mb-2.5">
            {/* Category Pill */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {lead.parentSignalId && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1">
                  <Network className="w-2.5 h-2.5" />
                  Branched
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                {lead.category}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                <Clock className="w-3 h-3" />
                {lead.publishedAgo}
              </span>
            </div>

            {/* Right side: Branch Out Button + Fit Score Badge */}
            <div className="flex items-center gap-1.5">
              {onOpenBranchOut && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenBranchOut(lead);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 text-cyan-300 border border-cyan-500/40 shadow-sm transition-all active:scale-95"
                  title="Branch Out: Scout competitors & internal peers"
                >
                  <Network className="w-3 h-3 text-cyan-400 animate-pulse" />
                  <span className="hidden xs:inline">Branch Out</span>
                </button>
              )}

              {/* Fit Score Badge */}
              <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono border ${getScoreBadgeColor(lead.fitScore)}`}>
                <TrendingUp className="w-3 h-3" />
                <span>{lead.fitScore}% Fit</span>
              </div>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2 font-display">
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

        {/* Card Scrollable / Viewable Body */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* Section 1: Core Pipeline - 3 Summary Bullet Points */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Key Signal Intelligence (3-Point Summary)
              </span>
            </div>
            <ul className="space-y-2">
              {lead.summaryBullets.map((bullet, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 text-xs sm:text-[13px] text-slate-200 bg-white/[0.02] p-2.5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                >
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-[10px] font-bold font-mono border border-indigo-500/30 mt-0.5">
                    {idx + 1}
                  </span>
                  <span className="leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Section 2: Core Pipeline - Extracted Decision-Maker */}
          <div className="rounded-xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-3 sm:p-3.5 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Extracted Decision-Maker
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Verified Prospect
              </span>
            </div>

            <div className="flex items-center gap-3">
              <ExecutiveAvatar
                name={lead.decisionMaker.name}
                avatarUrl={lead.decisionMaker.avatarUrl}
                size="md"
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
                      className="text-slate-400 hover:text-cyan-400 transition-colors"
                      title="LinkedIn Profile"
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
          </div>

          {/* Section 3: Core Pipeline - Email Draft Preview */}
          <div className="rounded-xl bg-[#090D14] p-3 sm:p-3.5 border border-indigo-500/20 relative group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-300 font-semibold">
                <Mail className="w-3.5 h-3.5 text-indigo-400" />
                <span>Pitch Draft Preview</span>
                <span className="text-[10px] font-normal text-slate-500 font-mono">
                  ({lead.emailDraft.estimatedReadTime})
                </span>
              </div>
              {onOpenPitchEditor && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenPitchEditor(lead);
                  }}
                  className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                >
                  <Edit3 className="w-3 h-3" />
                  Edit Pitch
                </button>
              )}
            </div>

            <div className="text-xs text-slate-400 mb-1.5 font-mono">
              <span className="text-slate-500">Subject: </span>
              <span className="text-slate-200">{lead.emailDraft.subject}</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed line-clamp-3 bg-black/30 p-2.5 rounded-lg border border-white/5 font-mono text-[11px]">
              {lead.emailDraft.body}
            </p>
          </div>
        </div>

        {/* Card Footer Tap Prompt (on mobile or split pane) */}
        {onSelectForDetail && (
          <button
            onClick={() => onSelectForDetail(lead)}
            className="md:hidden py-2.5 px-4 bg-white/[0.02] border-t border-white/10 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-1 transition-colors"
          >
            <span>View Full Context Details</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
};
