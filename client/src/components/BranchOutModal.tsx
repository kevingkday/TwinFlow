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
        playSound('streak');
        // Mark as explored locally
        setBranches((prev) =>
          prev.map((b) => (b.id === branch.id ? { ...b, status: 'explored' } : b))
        );

        setStatusMessage({
          type: 'success',
          text: `Branched lead created for ${branch.name}! Slid to the top of your deck (-5 credits, +${data.pointsAwarded} XP Combo).`,
        });

        onBranchScouted(data.newSignal, data.pointsAwarded, data.creditsDeducted, data.branchCombo);
      } else {
        playSound('pass');
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to scout branch. Please try again.',
        });
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setScoutingEntityId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glass-card rounded-2xl border border-white/15 p-6 shadow-2xl bg-[#0b0f19] text-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-cyan-500/40 flex items-center justify-center shadow-glow-brand">
            <Network className="w-6 h-6 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-display text-white">Branch Out Knowledge Graph</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                Lead Multiplier
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Source: <span className="text-slate-200 font-semibold">{lead.companyName}</span> • Multiply pipeline velocity with peer companies & internal roles
            </p>
          </div>
        </div>

        {/* Cost & Combo Bonus Banner */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-cyan-950/40 border border-indigo-500/30 mb-5 text-xs">
          <div className="flex items-center gap-2 text-indigo-300">
            <Zap className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Cost:</strong> 5 Credits per scout • <strong>Reward:</strong> +25 Combo XP & instant top-of-deck placement
            </span>
          </div>
          <div className="text-[11px] font-mono font-semibold text-slate-300">
            Balance: <span className={creditBalance < 5 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{creditBalance} credits</span>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-3 mb-4">
          <button
            onClick={() => setActiveTab('competitors')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'competitors'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Similar Companies (Competitors)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
              {competitors.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('peers')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'peers'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Other Key Roles (Internal Peers)</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono">
              {internalPeers.length}
            </span>
          </button>
        </div>

        {/* Loading Spinner */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Radio className="w-6 h-6 text-cyan-400 animate-spin" />
            <span className="text-xs">Mapping knowledge graph connections...</span>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 mb-4 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300'
                : statusMessage.type === 'error'
                ? 'bg-rose-950/40 border border-rose-500/30 text-rose-300'
                : 'bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 animate-pulse'
            }`}
          >
            {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {statusMessage.type === 'info' && <Radio className="w-4 h-4 text-cyan-400 animate-spin shrink-0" />}
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
                        ? 'bg-slate-900/40 border-emerald-500/30'
                        : 'bg-slate-900/80 hover:bg-slate-800/80 border-white/10 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-white font-display">{comp.name}</h4>
                          {comp.domain && (
                            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-950/50 border border-cyan-500/30 px-1.5 py-0.2 rounded">
                              {comp.domain}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.2 rounded">
                            Competitor
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{comp.reason}</p>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isExplored ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>In Deck</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleScout(comp)}
                            disabled={isScoutingThis || creditBalance < 5}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 ${
                              creditBalance < 5
                                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-white/10'
                                : 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-glow-brand'
                            }`}
                          >
                            {isScoutingThis ? (
                              <>
                                <Radio className="w-3.5 h-3.5 animate-spin text-white" />
                                <span>Scouting...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
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
                        ? 'bg-slate-900/40 border-emerald-500/30'
                        : 'bg-slate-900/80 hover:bg-slate-800/80 border-white/10 hover:border-purple-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-bold text-white font-display">{peer.name}</h4>
                          <span className="text-[10px] text-purple-300 bg-purple-950/50 border border-purple-500/30 px-1.5 py-0.2 rounded font-medium">
                            At {lead.companyName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{peer.reason}</p>
                      </div>

                      <div className="shrink-0 flex items-center">
                        {isExplored ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>In Deck</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleScout(peer)}
                            disabled={isScoutingThis || creditBalance < 5}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all shadow-sm active:scale-95 ${
                              creditBalance < 5
                                ? 'bg-slate-800 text-slate-400 cursor-not-allowed border border-white/10'
                                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-glow-brand'
                            }`}
                          >
                            {isScoutingThis ? (
                              <>
                                <Radio className="w-3.5 h-3.5 animate-spin text-white" />
                                <span>Resolving...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
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
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10 text-xs text-slate-400">
          <div className="flex items-center gap-1 text-[11px]">
            <span>Tip: Multi-threading competitor and peer leads triggers combo XP multipliers.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-300 hover:text-white rounded-xl hover:bg-white/5 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
