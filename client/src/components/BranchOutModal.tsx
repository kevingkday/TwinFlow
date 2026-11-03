import React, { useState, useEffect } from 'react';
import {
  X,
  Network,
  Building2,
  Users,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Radio,
  ArrowRight,
  Zap,
} from 'lucide-react';
import type { LeadCardData, BranchEntity, BranchesResponse, BranchScoutResponse, ApiSignalItem } from '../types/lead';
import { playSound } from '../utils/audio';
import { authFetch } from '../utils/api';

interface BranchOutModalProps {
  lead: LeadCardData | null;
  isOpen: boolean;
  onClose: () => void;
  creditBalance: number;
  onBranchScouted: (newCard: ApiSignalItem, pointsAwarded: number, creditsDeducted: number, combo: number) => void;
  onOpenUpgrade?: () => void;
}

export const BranchOutModal: React.FC<BranchOutModalProps> = ({
  lead,
  isOpen,
  onClose,
  creditBalance,
  onBranchScouted,
  onOpenUpgrade,
}) => {
  const [activeTab, setActiveTab] = useState<'competitors' | 'peers'>('competitors');
  const [branches, setBranches] = useState<BranchEntity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scoutingEntityId, setScoutingEntityId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && lead) {
      fetchBranches(lead.id);
      setStatusMessage(null);
    }
  }, [isOpen, lead]);

  const fetchBranches = async (signalId: string) => {
    setIsLoading(true);
    try {
      const res = await authFetch(`/api/signals/${encodeURIComponent(signalId)}/branches`);
      if (res.ok) {
        const data: BranchesResponse = await res.json();
        if (data.success && Array.isArray(data.branches)) {
          setBranches(data.branches);
        }
      }
    } catch (err) {
      console.warn('Error loading branches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !lead) return null;

  const competitors = branches.filter((b) => b.entityType === 'competitor');
  const internalPeers = branches.filter((b) => b.entityType === 'internal_peer');

  const handleScout = async (branch: BranchEntity) => {
    if (creditBalance < 5) {
      if (onOpenUpgrade) onOpenUpgrade();
      return;
    }

    setScoutingEntityId(branch.id);
    setStatusMessage({
      type: 'info',
      text: `Scouting news & resolving decision-makers for ${branch.name}...`,
    });

    try {
      const res = await authFetch(`/api/signals/${encodeURIComponent(lead.id)}/branch-scout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEntityName: branch.name,
          targetDomain: branch.domain || undefined,
          entityType: branch.entityType,
          entityId: branch.id,
          reason: branch.reason,
        }),
      });

      const data: BranchScoutResponse = await res.json();

      if (res.ok && data.success && data.newSignal) {
        playSound('approve');
        // Mark as explored locally
        setBranches((prev) =>
          prev.map((b) => (b.id === branch.id ? { ...b, status: 'explored' } : b))
        );

        setStatusMessage({
          type: 'success',
          text: `Added ${branch.name} directly to your active Lead Deck!`,
        });

        onBranchScouted(data.newSignal, data.pointsAwarded || 25, data.creditsDeducted || 5, data.branchCombo || 1);
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Could not discover a live signal for this peer at this time.',
        });
      }
    } catch {
      setStatusMessage({
        type: 'error',
        text: 'Network error communicating with intelligence engine.',
      });
    } finally {
      setScoutingEntityId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 p-6 shadow-2xl bg-white text-slate-800 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <Network className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-display text-slate-900">Branch Out Knowledge Graph</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Lead Multiplier
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Source: <span className="text-slate-900 font-semibold">{lead.companyName}</span> • Multiply pipeline velocity with peer companies & internal roles
            </p>
          </div>
        </div>

        {/* Cost & Balance Banner */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-5 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              <strong>Cost:</strong> 5 Credits per scout • Instant top-of-deck placement
            </span>
          </div>
          <div className="text-[11px] font-mono font-semibold text-slate-600">
            Balance: <span className={creditBalance < 5 ? 'text-rose-600 font-bold' : 'text-slate-900'}>{creditBalance} credits</span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('competitors')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'competitors'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Similar Companies (Competitors)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/10 text-[10px] font-mono">
              {competitors.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('peers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'peers'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Other Key Roles (Internal Peers)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/10 text-[10px] font-mono">
              {internalPeers.length}
            </span>
          </button>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500">
            <Radio className="w-6 h-6 text-blue-600 animate-spin" />
            <span className="text-xs">Mapping knowledge graph connections...</span>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 mb-4 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                : statusMessage.type === 'error'
                ? 'bg-rose-50 border border-rose-200 text-rose-800'
                : 'bg-blue-50 border border-blue-200 text-blue-800'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
            {statusMessage.type === 'info' && <Radio className="w-4 h-4 text-blue-600 animate-spin shrink-0" />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Entity Cards List */}
        {!isLoading && (
          <div className="space-y-3 flex-1 overflow-y-auto pr-1">
            {activeTab === 'competitors' &&
              competitors.map((comp) => {
                const isExplored = comp.status === 'explored';
                const isScoutingThis = scoutingEntityId === comp.id;

                return (
                  <div
                    key={comp.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isExplored
                        ? 'bg-slate-50 border-emerald-300'
                        : 'bg-white hover:bg-slate-50/50 border-slate-200 hover:border-blue-400 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-slate-900 font-display">{comp.name}</h4>
                          {comp.domain && (
                            <span className="text-[10px] font-mono text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded">
                              {comp.domain}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                            Competitor
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{comp.reason}</p>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isExplored ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>In Deck</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleScout(comp)}
                            disabled={isScoutingThis || creditBalance < 5}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 ${
                              creditBalance < 5
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                            }`}
                          >
                            {isScoutingThis ? (
                              <>
                                <Radio className="w-3.5 h-3.5 animate-spin text-white" />
                                <span>Scouting...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                                <span>Scout Competitor (-5)</span>
                                <ArrowRight className="w-3 h-3 text-white/80" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {activeTab === 'peers' &&
              internalPeers.map((peer) => {
                const isExplored = peer.status === 'explored';
                const isScoutingThis = scoutingEntityId === peer.id;

                return (
                  <div
                    key={peer.id}
                    className={`p-4 rounded-xl border transition-all ${
                      isExplored
                        ? 'bg-slate-50 border-emerald-300'
                        : 'bg-white hover:bg-slate-50/50 border-slate-200 hover:border-blue-400 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-slate-900 font-display">{peer.name}</h4>
                          <span className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.2 rounded font-medium">
                            At {lead.companyName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{peer.reason}</p>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isExplored ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>In Deck</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleScout(peer)}
                            disabled={isScoutingThis || creditBalance < 5}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-xs active:scale-95 ${
                              creditBalance < 5
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
                            }`}
                          >
                            {isScoutingThis ? (
                              <>
                                <Radio className="w-3.5 h-3.5 animate-spin text-white" />
                                <span>Resolving...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                                <span>Scout Peer Contact (-5)</span>
                                <ArrowRight className="w-3 h-3 text-white/80" />
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-200 text-xs text-slate-500">
          <div className="flex items-center gap-1 text-[11px]">
            <span>Tip: Multi-threading competitor and peer leads surfaces broader buying committee reach.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
