import React from 'react';
import { ArrowUpRight, CheckCircle2, Globe, Layers, Trash2 } from 'lucide-react';
import type { LeadCardData } from '../types/lead';

interface DeckQueueListProps {
  leads: LeadCardData[];
  onSelectLead: (leadId: string) => void;
  onDismissLead?: (leadId: string) => void;
}

function formatSourceLabel(lead: LeadCardData): string {
  const rawSource = (lead.source || '').trim();
  if (rawSource && rawSource.toLowerCase() !== 'news source') return rawSource;
  if (lead.sourceUrl) {
    try {
      return new URL(lead.sourceUrl).hostname.replace(/^www\./, '');
    } catch {
      return rawSource || 'News Source';
    }
  }
  return rawSource || 'News Source';
}

export const DeckQueueList: React.FC<DeckQueueListProps> = ({ leads, onSelectLead, onDismissLead }) => {
  if (leads.length === 0) return null;

  return (
    <section className="w-full max-w-6xl mt-6 rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-900">Leads in Queue</h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            {leads.length}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Select any lead below to display and triage it above
        </p>
      </div>

      <div className="divide-y divide-slate-100">
        {leads.map((lead, index) => {
          const isCurrent = index === 0;
          const sourceLabel = formatSourceLabel(lead);
          const company = lead.companyName || lead.decisionMaker?.company;

          return (
            <div
              key={lead.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!isCurrent) onSelectLead(lead.id);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && !isCurrent) {
                  e.preventDefault();
                  onSelectLead(lead.id);
                }
              }}
              className={`px-4 sm:px-5 py-3 flex items-center justify-between gap-4 transition-colors ${
                isCurrent
                  ? 'bg-blue-50/60 border-l-2 border-l-blue-600 cursor-default'
                  : 'hover:bg-slate-50 cursor-pointer'
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {isCurrent ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-600 text-white">
                      <CheckCircle2 className="w-3 h-3" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-100 text-slate-600">
                      #{index + 1}
                    </span>
                  )}

                  <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                    {lead.category}
                  </span>

                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600">
                    <Globe className="w-3 h-3 text-slate-400" />
                    <span>{sourceLabel}</span>
                  </span>

                  {lead.publishedAgo && (
                    <span className="text-[11px] text-slate-400">• {lead.publishedAgo}</span>
                  )}
                </div>

                <p className="text-sm font-semibold text-slate-900 truncate">
                  {lead.headline}
                </p>

                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {company && <span className="font-medium text-slate-700">{company}</span>}
                  {lead.decisionMaker?.name && (
                    <span>
                      {company ? '• ' : ''}
                      {lead.decisionMaker.name}
                      {lead.decisionMaker.title ? ` (${lead.decisionMaker.title})` : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {lead.fitScore}% Fit
                </span>
                {lead.sourceUrl && (
                  <a
                    href={lead.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`Open source (${sourceLabel})`}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                )}
                {!isCurrent && (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200">
                    Display
                  </span>
                )}
                {onDismissLead && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDismissLead(lead.id);
                    }}
                    title="Remove / Pass lead"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
