import React, { useState, useRef, useEffect } from 'react';
import {
  Target,
  ChevronDown,
  Plus,
  Sliders,
  Check,
  MapPin,
} from 'lucide-react';
import type { Campaign } from '../types/campaign';

interface CampaignSelectorProps {
  campaigns: Campaign[];
  activeCampaignId?: string;
  onSelectCampaign: (campaignId: string) => void;
  onCreateNewCampaign: () => void;
  onEditCampaign: (campaign: Campaign) => void;
  isLoading?: boolean;
}

export const CampaignSelector: React.FC<CampaignSelectorProps> = ({
  campaigns,
  activeCampaignId,
  onSelectCampaign,
  onCreateNewCampaign,
  onEditCampaign,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const activeCampaign =
    campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeCampaign && campaigns.length === 0) {
    return (
      <button
        type="button"
        onClick={onCreateNewCampaign}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Create First Campaign</span>
      </button>
    );
  }

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Campaign Button Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-xs font-medium text-slate-200 transition-all shadow-sm focus:outline-none"
        title="Switch or manage market campaigns"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Target className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold hidden sm:inline">
            Campaign:
          </span>
          <span className="font-semibold text-white max-w-[140px] sm:max-w-[200px] truncate">
            {activeCampaign?.name || 'Default Campaign'}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 rounded-xl bg-[#0F141F] border border-white/10 shadow-2xl p-2 z-50 animate-fade-in space-y-1.5">
          {/* Header */}
          <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-white/[0.06]">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              Active Campaigns ({campaigns.length})
            </span>
            {activeCampaign && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onEditCampaign(activeCampaign);
                }}
                className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-indigo-200 transition-colors font-medium"
              >
                <Sliders className="w-3 h-3" />
                <span>Edit Current</span>
              </button>
            )}
          </div>

          {/* Campaign List */}
          <div className="max-h-60 overflow-y-auto space-y-1 py-0.5">
            {campaigns.map((cmp) => {
              const isSelected = cmp.id === activeCampaign?.id;
              return (
                <button
                  key={cmp.id}
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (!isSelected) {
                      onSelectCampaign(cmp.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'bg-indigo-600/15 border border-indigo-500/30 text-white'
                      : 'hover:bg-white/[0.04] text-slate-300 hover:text-white border border-transparent'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="text-xs font-semibold truncate">
                        {cmp.name}
                      </span>
                    </div>
                    {cmp.targetLocation && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 pl-5 pt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
                        <span className="truncate">{cmp.targetLocation}</span>
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                      isSelected
                        ? 'bg-indigo-500/20 text-indigo-300 font-bold'
                        : 'bg-white/5 text-slate-400'
                    }`}
                  >
                    {cmp.leadsCount} leads
                  </span>
                </button>
              );
            })}
          </div>

          {/* Actions Footer */}
          <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCreateNewCampaign();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Campaign</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
