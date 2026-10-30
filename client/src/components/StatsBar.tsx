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
}) => {
  const processed = stats.approvedCount + stats.passedCount;
  const progressPercent = totalCards > 0 ? Math.round((processed / totalCards) * 100) : 100;

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-2">
      <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
        {/* Left Side: Campaign Switcher & Queue Indicator */}
        <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-1.5 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-medium text-slate-300">
              Queue: <span className="font-mono text-white font-bold">{stats.remainingCount}</span> leads
            </span>
          </div>
        </div>

        {/* Right Side: Approved / Passed Counters & Actions */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-mono font-semibold">{stats.approvedCount}</span>
            <span className="text-[10px] text-slate-400 uppercase hidden sm:inline">Approved</span>
          </div>

          <div className="flex items-center gap-1.5 text-rose-400">
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-mono font-semibold">{stats.passedCount}</span>
            <span className="text-[10px] text-slate-400 uppercase hidden sm:inline">Passed</span>
          </div>

          {/* Undo Button */}
          {canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all border border-white/10 shadow-sm"
              title="Undo last swipe"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span className="text-[11px] font-medium">Undo</span>
            </button>
          )}

          {stats.remainingCount === 0 && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-all text-[11px] font-medium shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Subtle Progress Bar */}
      <div className="w-full h-1 bg-white/5 rounded-full mt-2 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
};
