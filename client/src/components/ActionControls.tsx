import React from 'react';
import { X, Send, Edit3, ArrowLeft, ArrowRight, Zap, KeyRound } from 'lucide-react';
import type { SwipeAction } from '../types/lead';

interface ActionControlsProps {
  onAction: (action: SwipeAction) => void;
  onEditPitch: () => void;
  disabled?: boolean;
  creditBalance?: number;
  onUpgradePrompt?: () => void;
  isCrmConnected?: boolean;
  onOpenCrmSettings?: () => void;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  onAction,
  onEditPitch,
  disabled = false,
  creditBalance,
  onUpgradePrompt,
  isCrmConnected = false,
  onOpenCrmSettings,
}) => {
  const isOutOfCredits = creditBalance !== undefined && creditBalance < 10;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-3 flex items-center justify-center gap-4">
      {/* Pass Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction('pass')}
        className="group relative flex-1 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-surface hover:bg-rose-500/10 text-slate-300 hover:text-rose-400 border border-white/10 hover:border-rose-500/40 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-glow-rose"
        aria-label="Pass lead"
      >
        <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
          <X className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
        </div>
        <div className="text-left">
          <span className="block text-xs font-bold font-display uppercase tracking-wider text-rose-300">
            Pass
          </span>
          <span className="block text-[10px] text-slate-500 flex items-center gap-0.5">
            <ArrowLeft className="w-2.5 h-2.5" /> swipe left
          </span>
        </div>
      </button>

      {/* Edit Pitch Quick Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={onEditPitch}
        className="p-3.5 rounded-xl bg-surface hover:bg-white/10 text-slate-400 hover:text-indigo-300 border border-white/10 hover:border-indigo-500/30 transition-all duration-200 active:scale-95 disabled:opacity-40 shadow-lg"
        title="Customize pitch email"
        aria-label="Customize pitch email"
      >
        <Edit3 className="w-5 h-5" />
      </button>

      {/* Approve & Queue Pitch Button (or Out of Credits / Connect CRM state) */}
      {isOutOfCredits ? (
        <button
          type="button"
          onClick={onUpgradePrompt}
          className="group relative flex-1.5 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 font-semibold border border-amber-500/40 transition-all duration-200 active:scale-95 shadow-lg"
          aria-label="Need 10 credits to approve"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold font-display uppercase tracking-wider text-amber-300">
              Need 10 Credits
            </span>
            <span className="block text-[10px] text-amber-400/80">Top Up to Approve</span>
          </div>
        </button>
      ) : !isCrmConnected ? (
        <button
          type="button"
          onClick={onOpenCrmSettings}
          className="group relative flex-1.5 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/40 hover:to-orange-600/40 text-amber-200 font-semibold border border-amber-500/40 transition-all duration-200 active:scale-95 shadow-lg"
          aria-label="Connect CRM Private Key to approve"
          title="Connect your CRM Private Integration Token to approve and push leads"
        >
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-amber-300" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold font-display uppercase tracking-wider text-amber-200">
              Connect CRM
            </span>
            <span className="block text-[10px] text-amber-300/80">Setup Private Key</span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction('approve')}
          className="group relative flex-1.5 flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold border border-emerald-400/30 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-glow-emerald"
          aria-label="Approve and push to CRM (-10 credits)"
        >
          <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Send className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold font-display uppercase tracking-wider text-white">
              Approve (-10 credits)
            </span>
            <span className="block text-[10px] text-emerald-100/80 flex items-center gap-0.5">
              swipe right <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>
      )}
    </div>
  );
};
