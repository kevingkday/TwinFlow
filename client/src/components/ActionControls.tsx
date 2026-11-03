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
    <div className="w-full max-w-6xl mx-auto px-4 py-3 flex items-center justify-center gap-3 sm:gap-4">
      {/* Pass Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAction('pass')}
        className="group relative flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
        aria-label="Pass lead"
      >
        <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
          <X className="w-4 h-4 text-rose-600" />
        </div>
        <div className="text-left">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-800 group-hover:text-rose-700">
            Pass
          </span>
          <span className="block text-[10px] text-slate-400 flex items-center gap-0.5">
            <ArrowLeft className="w-2.5 h-2.5" /> swipe left
          </span>
        </div>
      </button>

      {/* Edit Pitch Quick Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={onEditPitch}
        className="p-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all active:scale-95 disabled:opacity-40 shadow-xs cursor-pointer"
        title="Customize pitch email"
        aria-label="Customize pitch email"
      >
        <Edit3 className="w-5 h-5" />
      </button>

      {/* Approve & Push to CRM Button (or Out of Credits / Connect CRM) */}
      {isOutOfCredits ? (
        <button
          type="button"
          onClick={onUpgradePrompt}
          className="group relative flex-1.5 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-all active:scale-95 shadow-xs cursor-pointer"
          aria-label="Need 10 credits to approve"
        >
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold uppercase tracking-wider text-white">
              Need 10 Credits
            </span>
            <span className="block text-[10px] text-amber-100">Top Up to Approve</span>
          </div>
        </button>
      ) : !isCrmConnected ? (
        <button
          type="button"
          onClick={onOpenCrmSettings}
          className="group relative flex-1.5 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-all active:scale-95 shadow-xs cursor-pointer"
          aria-label="Connect CRM Private Key to approve"
          title="Connect your CRM Private Integration Token to approve and push leads"
        >
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
            <KeyRound className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold uppercase tracking-wider text-white">
              Connect CRM
            </span>
            <span className="block text-[10px] text-amber-100">Setup Private Key</span>
          </div>
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction('approve')}
          className="group relative flex-1.5 flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs cursor-pointer"
          aria-label="Approve and push to CRM (-10 credits)"
        >
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <Send className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold uppercase tracking-wider text-white">
              Approve (-10 credits)
            </span>
            <span className="block text-[10px] text-blue-100 flex items-center gap-0.5">
              swipe right <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        </button>
      )}
    </div>
  );
};
