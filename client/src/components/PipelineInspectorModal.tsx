import React, { useState } from 'react';
import {
  X,
  Radio,
  CheckCircle2,
  Filter,
  ExternalLink,
  Layers,
  Search,
  Building2,
  Mail,
  RefreshCw,
  Clock,
} from 'lucide-react';
import type { PipelineTrace, PipelineAuditItem } from '../types/lead';

interface PipelineInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  trace: PipelineTrace | null;
  isLoading?: boolean;
  onScoutWithLimit?: (limit: number) => Promise<void>;
  isScouting?: boolean;
}

export const PipelineInspectorModal: React.FC<PipelineInspectorModalProps> = ({
  isOpen,
  onClose,
  trace,
  isLoading = false,
  onScoutWithLimit,
  isScouting = false,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'ingested' | 'filtered'>('all');
  const [selectedBatchSize, setSelectedBatchSize] = useState<number>(3);
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const auditLog: PipelineAuditItem[] = trace?.auditLog || [];
  const ingestedCount = auditLog.filter((item) => item.status === 'ingested').length;
  const filteredCount = auditLog.filter((item) => item.status === 'filtered').length;

  const filteredItems = auditLog.filter((item) => {
    if (filterTab === 'ingested' && item.status !== 'ingested') return false;
    if (filterTab === 'filtered' && item.status !== 'filtered') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCompany = (item.companyName || '').toLowerCase().includes(q);
      const matchPub = item.publisher.toLowerCase().includes(q);
      const matchReason = item.reason.toLowerCase().includes(q);
      return matchTitle || matchCompany || matchPub || matchReason;
    }
    return true;
  });

  const handleTriggerScout = () => {
    onScoutWithLimit?.(selectedBatchSize);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">AI Radar Pipeline Inspector</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Live Trace
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Inspect every article scouted, AI qualification decisions, and Apollo contact trails.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Query & Controls Subheader */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">Scouted Query:</span>
            <code className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 font-mono text-[11px] border border-slate-200">
              {trace?.query || 'Live Market Search'}
            </code>
            {trace?.location && (
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-200">
                📍 {trace.location}
              </span>
            )}
            {trace?.timestamp && (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(trace.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Batch Size Selector & Re-Scout Trigger */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Batch Size:</span>
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
              {[3, 5, 10].map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedBatchSize(size)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                    selectedBatchSize === size
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            {onScoutWithLimit && (
              <button
                onClick={handleTriggerScout}
                disabled={isScouting}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold text-white transition-all cursor-pointer shadow-xs ${
                  isScouting ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScouting ? 'animate-spin' : ''}`} />
                <span>{isScouting ? 'Scouting...' : `Scout ${selectedBatchSize}`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Metrics Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-50/50 border-b border-slate-100">
          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500">Articles Scouted</div>
            <div className="text-lg font-bold text-slate-900 mt-0.5">
              {trace?.telemetry?.fetchedCount ?? auditLog.length}
            </div>
            <div className="text-[10px] text-slate-400">Google News Pool</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-emerald-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-emerald-700">Ingested to Deck</div>
            <div className="text-lg font-bold text-emerald-700 mt-0.5">{ingestedCount}</div>
            <div className="text-[10px] text-emerald-600">Commercial Catalysts</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-slate-500">Filtered Out</div>
            <div className="text-lg font-bold text-slate-700 mt-0.5">{filteredCount}</div>
            <div className="text-[10px] text-slate-400">Non-milestone / Noise</div>
          </div>

          <div className="p-3 bg-white rounded-xl border border-blue-200/80 shadow-2xs">
            <div className="text-[11px] font-medium text-blue-700">Triage Decision Engine</div>
            <div className="text-xs font-bold text-blue-900 mt-1 truncate">
              {trace?.telemetry?.triageModel || 'Jev / Heuristic AI'}
            </div>
            <div className="text-[10px] text-blue-600">Calibrated Multi-Tier</div>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="px-5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterTab('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterTab === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Articles ({auditLog.length})
            </button>
            <button
              onClick={() => setFilterTab('ingested')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterTab === 'ingested'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Ingested ({ingestedCount})
            </button>
            <button
              onClick={() => setFilterTab('filtered')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                filterTab === 'filtered'
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Filtered ({filteredCount})
            </button>
          </div>

          <div className="relative max-w-xs w-full hidden sm:block">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter headlines, companies..."
              className="w-full pl-8 pr-3 py-1 rounded-lg border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Scrollable Audit Log */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/30">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">
              <RefreshCw className="w-7 h-7 mx-auto animate-spin text-blue-600 mb-2" />
              <p className="text-sm font-medium">Loading pipeline audit trace...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">No articles match your filter.</p>
              <p className="text-xs text-slate-400 mt-1">
                Run a scout session above to populate the pipeline audit log.
              </p>
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={`${item.index}_${idx}`}
                className={`p-4 rounded-xl border bg-white shadow-2xs transition-all ${
                  item.status === 'ingested'
                    ? 'border-emerald-200 hover:border-emerald-300'
                    : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {/* Status Badge & Publisher */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      {item.status === 'ingested' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          INGESTED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          <Filter className="w-3 h-3 text-slate-400" />
                          FILTERED
                        </span>
                      )}

                      <span className="text-xs font-semibold text-slate-700">{item.publisher}</span>
                      {item.publishedAt && (
                        <span className="text-[11px] text-slate-400">
                          • {new Date(item.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    {/* Headline */}
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-slate-900 hover:text-blue-600 inline-flex items-center gap-1 group transition-colors"
                    >
                      <span>{item.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 shrink-0" />
                    </a>

                    {/* Decision Reasoning */}
                    <div className="mt-2 text-xs text-slate-600 flex items-start gap-1.5">
                      <span className="font-semibold text-slate-500 shrink-0">Decision:</span>
                      <span
                        className={
                          item.status === 'ingested' ? 'text-emerald-900 font-medium' : 'text-slate-500'
                        }
                      >
                        {item.reason}
                      </span>
                    </div>

                    {/* Extracted Company (If Ingested) */}
                    {item.companyName && (
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-slate-500 font-medium">Target Company:</span>
                        <span className="font-bold text-slate-800">{item.companyName}</span>
                      </div>
                    )}

                    {/* Contact Discovery Waterfall Trail (If Ingested) */}
                    {item.contact && (
                      <div className="mt-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                              {item.contact.name.charAt(0)}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900">{item.contact.name}</span>
                              <span className="text-slate-500 text-[11px]"> • {item.contact.title}</span>
                            </div>
                          </div>

                          {item.contact.email && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                              <Mail className="w-3 h-3" />
                              {item.contact.email}
                            </span>
                          )}
                        </div>

                        {item.contact.trail && item.contact.trail.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-100/80 flex items-center gap-1 text-[11px] text-blue-800">
                            <span className="text-slate-500 font-medium">Apollo Path:</span>
                            <span className="font-mono text-[10px] text-blue-700">
                              {item.contact.trail.join(' ➔ ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Showing {filteredItems.length} of {auditLog.length} evaluated articles
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-all cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
