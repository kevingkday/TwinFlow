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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display">Credit Balance & Plans</h3>
            <p className="text-xs text-slate-500">
              Current balance: <span className="font-mono text-slate-900 font-bold">{currentCredits} credits</span>
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 mb-5 text-xs text-blue-800 leading-relaxed">
          Each approved lead costs <strong>10 credits</strong>. This automatically enriches verified executive contacts and pushes the account dossier, 3-point summary, and outbound pitch directly into your <strong>CRM</strong> workspace.
        </div>

        {/* Upgrade options */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-400 transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900">Growth Tier</span>
              <span className="text-[10px] text-blue-700 bg-blue-100 font-mono font-bold px-1.5 py-0.5 rounded">500 Credits</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">For scaling SDR and outbound teams</p>
            <div className="text-sm font-bold text-slate-900 font-mono">$49/mo</div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/60 border-2 border-blue-600 relative overflow-hidden">
            <div className="absolute top-0 right-0 px-2 py-0.5 bg-blue-600 text-[9px] font-bold text-white uppercase rounded-bl">
              Popular
            </div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-900">Agency / Pro</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 font-mono font-bold px-1.5 py-0.5 rounded">2,500 Credits</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">Unlimited subaccounts & CRM webhooks</p>
            <div className="text-sm font-bold text-blue-700 font-mono">$199/mo</div>
          </div>
        </div>

        {/* Dev Top-Up / Demo Credit Action */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 mb-4">
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Dev / Testing Top-Up</span>
            </div>
            <p className="text-[11px] text-slate-500">Add test credits to local Cloudflare D1</p>
          </div>
          <button
            onClick={() => onReplenishDevCredits(100)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>+100 Credits</span>
          </button>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
