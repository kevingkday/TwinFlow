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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-5 sm:p-6 shadow-2xl relative flex flex-col max-h-[90vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 font-display">
              Customize Pitch for {lead.decisionMaker.name}
            </h3>
            <p className="text-xs text-slate-500">
              Recipient: <span className="text-slate-700 font-medium">{lead.decisionMaker.name}</span> ({lead.decisionMaker.title} @ {lead.decisionMaker.company})
            </p>
          </div>
        </div>

        <div className="space-y-3.5 flex-1 overflow-y-auto my-4 pr-1">
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Subject Line
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Pitch Body
            </label>
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl p-3.5 text-xs font-mono leading-relaxed focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 resize-none shadow-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <Check className="w-3.5 h-3.5 text-slate-500" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={handleApprove}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Approve & Queue</span>
          </button>
        </div>
      </div>
    </div>
  );
};
