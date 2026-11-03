import React from 'react';
import { RotateCcw, CheckCircle2, XCircle, Layers, Sparkles } from 'lucide-react';
import type { SwipeStats } from '../types/lead';
import type { Campaign } from '../types/campaign';
import { CampaignSelector } from './CampaignSelector';

interface StatsBarProps {
  stats: SwipeStats;
  canUndo: boolean;
  onUndo: () => void;
  onReset: () => void;
  totalCards: number;
  campaigns?: Campaign[];
  activeCampaignId?: string;
  onSelectCampaign?: (campaignId: string) => void;
  onCreateNewCampaign?: () => void;
  onEditCampaign?: (campaign: Campaign) => void;
  onNavigateToContacts?: () => void;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  stats,
  canUndo,
  onUndo,
  onReset,
  totalCards,
  campaigns = [],
  activeCampaignId,
  onSelectCampaign,
  onCreateNewCampaign,
  onEditCampaign,
  onNavigateToContacts,
}) => {
  const processed = stats.approvedCount + stats.passedCount;
  const progressPercent = totalCards > 0 ? Math.round((processed / totalCards) * 100) : 100;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-3">
      <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:px-4 sm:py-3 shadow-xs flex items-center justify-between gap-3 text-xs flex-wrap">
        {/* Left Side: Campaign Switcher & Queue Indicator */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          {onSelectCampaign && onCreateNewCampaign && onEditCampaign && (
            <CampaignSelector
              campaigns={campaigns}
              activeCampaignId={activeCampaignId}
              onSelectCampaign={onSelectCampaign}
              onCreateNewCampaign={onCreateNewCampaign}
              onEditCampaign={onEditCampaign}
            />
          )}

          {/* Deck Queue Status */}
          <div className="flex items-center gap-1.5 text-slate-600">
            <Layers className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-medium text-slate-600">
              Queue: <span className="font-mono text-slate-900 font-bold">{stats.remainingCount}</span> leads
            </span>
          </div>
        </div>

        {/* Right Side: Approved / Passed Counters & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onNavigateToContacts}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium transition-all ${
              onNavigateToContacts ? 'hover:bg-emerald-100 cursor-pointer' : ''
            }`}
            title="View approved contacts and organizations"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-mono font-bold">{stats.approvedCount}</span>
            <span className="text-[10px] uppercase hidden sm:inline font-semibold">Approved</span>
          </button>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-medium">
            <XCircle className="w-3.5 h-3.5 text-rose-500" />
            <span className="font-mono font-bold">{stats.passedCount}</span>
            <span className="text-[10px] uppercase hidden sm:inline font-semibold">Passed</span>
          </div>

          {/* Undo Button */}
          {canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all font-semibold text-xs cursor-pointer"
              title="Undo last swipe"
            >
              <RotateCcw className="w-3 h-3 text-slate-600" />
              <span>Undo</span>
            </button>
          )}

          {stats.remainingCount === 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all text-xs font-semibold shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Subtle Progress Bar */}
      <div className="w-full h-1.5 bg-slate-200/80 rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
