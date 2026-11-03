import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, CheckCircle2, RotateCcw, Radio } from 'lucide-react';
import type { LeadCardData, SwipeAction, DecisionMaker } from '../types/lead';
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
  onSelectContact?: (leadId: string, contact: DecisionMaker) => void;
  onEnrichContact?: (leadId: string, contact: DecisionMaker) => Promise<void>;
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
  onSelectContact,
  onEnrichContact,
}) => {
  const currentLead = leads[0];
  const nextLead = leads[1];
  const thirdLead = leads[2];

  if (!currentLead) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-xl min-h-[460px] mx-auto rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center justify-center p-8 sm:p-12 text-center text-slate-800"
      >
        <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2 font-sans">
          Queue Cleared!
        </h3>
        <p className="text-sm text-slate-600 mb-6 max-w-sm leading-relaxed">
          All intelligence signals have been triaged. Approved pitches are saved and synchronized directly to your CRM.
        </p>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {onScoutNews && (
            <button
              onClick={onScoutNews}
              disabled={isScouting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 cursor-pointer ${
                isScouting
                  ? 'bg-blue-50 text-blue-700 border border-blue-200 cursor-wait'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
              }`}
            >
              <Radio className={`w-4 h-4 ${isScouting ? 'animate-spin text-white' : 'text-blue-200'}`} />
              <span>{isScouting ? 'Scouting AI...' : 'Scout Live Signals'}</span>
              <Sparkles className="w-4 h-4 text-amber-300" />
            </button>
          )}
          <button
            onClick={onReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
            <span>Reset Demo Batch</span>
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative w-full max-w-6xl mx-auto">
      {/* 3rd Card in Stack (Visual depth) */}
      {thirdLead && (
        <div
          className="absolute inset-0 w-full rounded-2xl bg-slate-100 border border-slate-200/80 opacity-60 scale-[0.98] translate-y-3 pointer-events-none transition-all duration-300 shadow-xs"
          aria-hidden="true"
        />
      )}

      {/* 2nd Card in Stack (Visual depth) */}
      {nextLead && (
        <div
          className="absolute inset-0 w-full rounded-2xl bg-white border border-slate-200 opacity-90 scale-[0.99] translate-y-1.5 pointer-events-none transition-all duration-300 shadow-xs"
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
          onSelectContact={onSelectContact}
          onEnrichContact={onEnrichContact}
        />
      </AnimatePresence>
    </div>
  );
};
