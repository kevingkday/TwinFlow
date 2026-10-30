import React from 'react';
import { X, Zap, Sparkles, PlusCircle } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits: number;
  onReplenishDevCredits: (amount: number) => Promise<void>;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  currentCredits,
  onReplenishDevCredits,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl glass-panel border border-white/10 p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-glow-amber">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white font-display">Credit Balance & Top-Up</h3>
            <p className="text-xs text-slate-400">
              Current balance: <span className="font-mono text-amber-300 font-bold">{currentCredits} credits</span>
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 mb-5 text-xs text-indigo-200 leading-relaxed">
          Each approved lead costs <strong>10 credits</strong>. This automatically enriches verified executive contacts and pushes the account dossier, 3-point summary, and cold pitch directly into your <strong>CRM</strong> workspace.
        </div>

        {/* Upgrade options */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 hover:border-indigo-500/40 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">Growth Tier</span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">500 Credits</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2.5">For scaling SDR and outbound teams</p>
            <div className="text-xs font-bold text-indigo-300 font-mono">$49/mo</div>
          </div>

          <div className="p-3.5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 hover:border-indigo-400 transition-colors relative overflow-hidden">
            <div className="absolute top-0 right-0 px-2 py-0.5 bg-gradient-to-l from-indigo-600 to-purple-600 text-[9px] font-bold text-white uppercase rounded-bl">
              Popular
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white">Agency / Pro</span>
              <span className="text-[10px] text-emerald-400 font-mono font-bold">2,500 Credits</span>
            </div>
            <p className="text-[11px] text-slate-400 mb-2.5">Unlimited subaccounts & CRM webhooks</p>
            <div className="text-xs font-bold text-indigo-300 font-mono">$199/mo</div>
          </div>
        </div>

        {/* Dev Top-Up / Demo Credit Action */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Dev / Testing Top-Up</span>
            </div>
            <p className="text-[11px] text-slate-400">Add test credits to local Cloudflare D1</p>
          </div>
          <button
            onClick={() => onReplenishDevCredits(100)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-glow-brand transition-all active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+100 Credits</span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
