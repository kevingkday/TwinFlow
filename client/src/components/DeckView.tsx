import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, CheckCircle2, RotateCcw, Radio } from 'lucide-react';
import type { LeadCardData, SwipeAction } from '../types/lead';
import { SwipeCard } from './SwipeCard';

interface DeckViewProps {
  leads: LeadCardData[];
  onSwipe: (action: SwipeAction) => void;
  onOpenPitchEditor: (lead: LeadCardData) => void;
  onSelectForDetail?: (lead: LeadCardData) => void;
  onReset: () => void;
  onScoutNews?: () => void;
  isScouting?: boolean;
  onOpenBranchOut?: (lead: LeadCardData) => void;
}

export const DeckView: React.FC<DeckViewProps> = ({
  leads,
  onSwipe,
  onOpenPitchEditor,
  onSelectForDetail,
  onReset,
  onScoutNews,
  isScouting = false,
  onOpenBranchOut,
}) => {
  const currentLead = leads[0];
  const nextLead = leads[1];
  const thirdLead = leads[2];

  if (!currentLead) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl min-h-[460px] mx-auto rounded-2xl glass-card flex flex-col items-center justify-center p-8 sm:p-12 text-center border border-white/10"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white font-display mb-2">
          Queue Cleared!
        </h3>
        <p className="text-sm text-slate-400 mb-6 max-w-sm">
          All intelligence signals have been triaged. Your approved pitches are queued and synced to your CRM.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {onScoutNews && (
            <button
              onClick={onScoutNews}
              disabled={isScouting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                isScouting
                  ? 'bg-indigo-900/40 text-indigo-300 border border-indigo-500/40 cursor-wait'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm'
              }`}
            >
              <Radio className={`w-4 h-4 ${isScouting ? 'animate-spin text-white' : 'animate-pulse text-indigo-200'}`} />
              <span>{isScouting ? 'Scouting AI...' : 'Scout Live Signals'}</span>
              <Sparkles className="w-4 h-4 text-amber-300" />
            </button>
          )}
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Reset Demo Batch</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative w-full max-w-4xl h-[540px] sm:h-[560px] mx-auto">
      {/* 3rd Card in Stack (Visual depth) */}
      {thirdLead && (
        <div
          className="absolute inset-0 w-full rounded-2xl bg-[#090E17] border border-white/5 opacity-40 scale-[0.92] translate-y-6 pointer-events-none transition-all duration-300"
          aria-hidden="true"
        />
      )}

      {/* 2nd Card in Stack (Visual depth) */}
      {nextLead && (
        <div
          className="absolute inset-0 w-full rounded-2xl bg-[#0E1522] border border-white/10 opacity-70 scale-[0.96] translate-y-3 pointer-events-none transition-all duration-300 shadow-xl"
          aria-hidden="true"
        />
      )}

      {/* Top Active Card */}
      <AnimatePresence mode="popLayout">
        <SwipeCard
          key={currentLead.id}
          lead={currentLead}
          isFront={true}
          onSwipe={onSwipe}
          onOpenPitchEditor={onOpenPitchEditor}
          onSelectForDetail={onSelectForDetail}
          onOpenBranchOut={onOpenBranchOut}
        />
      </AnimatePresence>
    </div>
  );
};
