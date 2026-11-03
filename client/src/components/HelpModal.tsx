import React from 'react';
import { X, ArrowLeft, ArrowRight, RotateCcw, Edit3, Compass } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 font-display">Shortcuts & Gestures</h3>
            <p className="text-xs text-slate-500">Keyboard navigation and touch controls</p>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-5 leading-relaxed">
          TwinFlow streamlines your account-based intelligence workflow. Rapidly review leads with simple touch gestures or keyboard shortcuts:
        </p>

        <div className="space-y-2.5 mb-6 text-xs">
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="flex items-center gap-2.5 text-slate-800 font-medium">
              <span className="w-6 h-6 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
              Approve Lead
            </span>
            <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              Swipe Right / [→]
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="flex items-center gap-2.5 text-slate-800 font-medium">
              <span className="w-6 h-6 rounded-md bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-bold">
                <ArrowLeft className="w-3.5 h-3.5" />
              </span>
              Pass Lead
            </span>
            <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              Swipe Left / [←]
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="flex items-center gap-2.5 text-slate-800 font-medium">
              <span className="w-6 h-6 rounded-md bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
                <RotateCcw className="w-3.5 h-3.5" />
              </span>
              Undo Last Action
            </span>
            <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              [U] / [Ctrl+Z]
            </span>
          </div>

          <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="flex items-center gap-2.5 text-slate-800 font-medium">
              <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-bold">
                <Edit3 className="w-3.5 h-3.5" />
              </span>
              Edit Pitch
            </span>
            <span className="font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              [E]
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs tracking-wide transition-all shadow-xs"
        >
          Got it
        </button>
      </div>
    </div>
  );
};
