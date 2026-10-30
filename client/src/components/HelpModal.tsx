import React from 'react';
import { X, ArrowLeft, ArrowRight, RotateCcw, Edit3, Sparkles } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl glass-panel border border-white/10 p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <h3 className="text-lg font-bold text-white font-display">How to Play & Triage</h3>
        </div>

        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          TwinFlow gamifies your account-based intelligence queue. Triage leads at lightning speed with gestures or keys:
        </p>

        <div className="space-y-3 mb-6 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="flex items-center gap-2 text-slate-200">
              <span className="w-6 h-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
              Approve & Queue Pitch
            </span>
            <span className="font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              Swipe Right / [→]
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="flex items-center gap-2 text-slate-200">
              <span className="w-6 h-6 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                <ArrowLeft className="w-3.5 h-3.5" />
              </span>
              Pass Lead
            </span>
            <span className="font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              Swipe Left / [←]
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="flex items-center gap-2 text-slate-200">
              <span className="w-6 h-6 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                <RotateCcw className="w-3.5 h-3.5" />
              </span>
              Undo Last Swipe
            </span>
            <span className="font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              [U] / [Ctrl+Z]
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="flex items-center gap-2 text-slate-200">
              <span className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <Edit3 className="w-3.5 h-3.5" />
              </span>
              Quick Customize Pitch
            </span>
            <span className="font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
              [E]
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs tracking-wide transition-all shadow-glow-brand"
        >
          Got it, let's triage!
        </button>
      </div>
    </div>
  );
};
