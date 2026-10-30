import React, { useState, useEffect } from 'react';
import { X, Mail, Send, Check } from 'lucide-react';
import type { LeadCardData } from '../types/lead';

interface PitchEditorModalProps {
  lead: LeadCardData | null;
  isOpen: boolean;
  onClose: () => void;
  onSaveAndApprove: (leadId: string, subject: string, body: string) => void;
  onUpdateDraft: (leadId: string, subject: string, body: string) => void;
}

export const PitchEditorModal: React.FC<PitchEditorModalProps> = ({
  lead,
  isOpen,
  onClose,
  onSaveAndApprove,
  onUpdateDraft,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  useEffect(() => {
    if (lead) {
      setSubject(lead.emailDraft.subject);
      setBody(lead.emailDraft.body);
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  const handleSave = () => {
    onUpdateDraft(lead.id, subject, body);
    onClose();
  };

  const handleApprove = () => {
    onSaveAndApprove(lead.id, subject, body);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl glass-panel border border-white/10 p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-3">
          <Mail className="w-5 h-5 text-indigo-400" />
          <h3 className="text-base sm:text-lg font-bold text-white font-display">
            Customize Pitch for {lead.decisionMaker.name}
          </h3>
        </div>

        <p className="text-xs text-slate-400 mb-4">
          To: <span className="text-slate-200 font-medium">{lead.decisionMaker.name}</span> ({lead.decisionMaker.title} @ {lead.decisionMaker.company})
        </p>

        <div className="space-y-3.5 flex-1 overflow-y-auto mb-4 pr-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#090D14] text-slate-200 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
              Email Pitch Body
            </label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-[#090D14] text-slate-200 border border-white/10 rounded-lg p-3 text-xs font-mono leading-relaxed focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={handleApprove}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold uppercase tracking-wider shadow-glow-emerald transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Approve & Queue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
