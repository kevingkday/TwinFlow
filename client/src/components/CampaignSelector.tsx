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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 transition-all shadow-xs focus:outline-none cursor-pointer"
        title="Switch or manage market campaigns"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Target className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold hidden sm:inline">
            Campaign:
          </span>
          <span className="font-semibold text-slate-900 max-w-[140px] sm:max-w-[200px] truncate">
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
        <div className="absolute left-0 mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-xl p-2.5 z-50 animate-fade-in space-y-2 text-slate-800">
          {/* Header */}
          <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">
              Active Campaigns ({campaigns.length})
            </span>
            {activeCampaign && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onEditCampaign(activeCampaign);
                }}
                className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 transition-colors font-semibold cursor-pointer"
              >
                <Sliders className="w-3 h-3" />
                <span>Edit Parameters</span>
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
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50 border border-blue-200/80 text-slate-900'
                      : 'hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-transparent'
                  }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                      ) : (
                        <span className="w-3.5 h-3.5 flex-shrink-0" />
                      )}
                      <span className="text-xs font-semibold truncate">
                        {cmp.name}
                      </span>
                    </div>
                    {cmp.targetLocation && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 pl-5 pt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{cmp.targetLocation}</span>
                      </div>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full flex-shrink-0 ${
                      isSelected
                        ? 'bg-blue-100 text-blue-700 font-bold'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {cmp.leadsCount} leads
                  </span>
                </button>
              );
            })}
          </div>

          {/* Actions Footer */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onCreateNewCampaign();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
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
