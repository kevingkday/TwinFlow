import React, { useState, useRef, useEffect } from 'react';
import {
  Flame,
  Zap,
  HelpCircle,
  Volume2,
  VolumeX,
  Database,
  Trophy,
  Radio,
  Sparkles,
  Network,
  User,
  UserPlus,
  LogOut,
  ChevronDown,
  Compass,
  Building,
  Home,
  ShieldCheck,
} from 'lucide-react';
import type { SwipeStats, UserProfile } from '../types/lead';
import { ExecutiveAvatar } from './ExecutiveAvatar';

interface HeaderProps {
  stats: SwipeStats;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onOpenHelp: () => void;
  onScoutNews: () => void;
  onOpenUpgrade?: () => void;
  onOpenGhlSettings?: () => void;
  onOpenAdmin?: () => void;
  isGhlConnected?: boolean;
  isScouting?: boolean;
  serverOnline?: boolean;
  user?: UserProfile | null;
  onOpenAuth?: (initialMode?: 'signup' | 'login') => void;
  onLogout?: () => void;
  onOpenOnboarding?: () => void;
  currentView?: 'landing' | 'deck';
  onNavigate?: (view: 'landing' | 'deck') => void;
  leadsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  soundEnabled,
  onToggleSound,
  onOpenHelp,
  onScoutNews,
  onOpenUpgrade,
  onOpenGhlSettings,
  onOpenAdmin,
  isGhlConnected = false,
  isScouting = false,
  serverOnline = true,
  user,
  onOpenAuth,
  onLogout,
  onOpenOnboarding,
  currentView = 'landing',
  onNavigate,
  leadsCount,
}) => {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full glass-panel border-b border-white/10 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand & View Switcher */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => onNavigate?.('landing')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
            title="Go to TwinFlow Home"
          >
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-emerald-400 p-[1px] shadow-glow-brand group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-[#0B0F17] rounded-[11px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-indigo-400 fill-indigo-400/20" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-display">
                  Twin<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Flow</span>
                </h1>
                <span className="hidden md:inline-flex text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                  Signals Live
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden xl:block">Autonomous Market Signal Engine</p>
            </div>
          </button>

          {/* Navigation Pill (Home vs Lead Deck) */}
          {onNavigate && (
            <nav className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10 shadow-inner">
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'landing'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-glow-brand'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('deck')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  currentView === 'deck'
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 text-white shadow-glow-brand'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-emerald-300" />
                <span>Lead Deck</span>
                {leadsCount !== undefined && leadsCount > 0 && (
                  <span className="hidden sm:inline-block px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">
                    {leadsCount}
                  </span>
                )}
              </button>
              {user?.isAdmin && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold text-amber-300 hover:text-amber-200 hover:bg-amber-500/20 border border-amber-500/30 transition-all shadow-sm"
                  title="Open Admin Console"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin</span>
                </button>
              )}
            </nav>
          )}
        </div>

        {/* Right side stats & controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Scout News Trigger Button */}
          <button
            onClick={onScoutNews}
            disabled={isScouting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-sm active:scale-95 ${
              isScouting
                ? 'bg-indigo-900/40 border-indigo-500/50 text-indigo-300 cursor-wait'
                : 'bg-gradient-to-r from-indigo-500/15 via-purple-500/15 to-emerald-500/15 hover:from-indigo-500/25 hover:to-emerald-500/25 border-indigo-500/30 hover:border-indigo-400 text-slate-200 hover:text-white shadow-glow-brand'
            }`}
            title="Scout live market signals via AI Search & Enrichment"
            aria-label="Scout News Signals"
          >
            <Radio className={`w-3.5 h-3.5 ${isScouting ? 'text-indigo-400 animate-spin' : 'text-emerald-400 animate-pulse'}`} />
            <span className="font-display tracking-wide">{isScouting ? 'Scouting AI...' : 'Scout News'}</span>
            <Sparkles className="w-3 h-3 text-amber-400 hidden sm:inline" />
          </button>

          {/* Worker / D1 Health Status */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300">
            <Database className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] text-slate-400">D1:</span>
            <span className={`text-[11px] font-medium flex items-center gap-1 ${serverOnline ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${serverOnline ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
              {serverOnline ? 'Live' : 'Syncing'}
            </span>
          </div>

          {/* Branching Streak / Combo Pill */}
          {stats.branchCombo !== undefined && stats.branchCombo > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500/20 via-indigo-500/20 to-purple-500/20 border border-cyan-400/40 text-cyan-200 shadow-glow-brand animate-pulse">
              <Network className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-bold font-mono tracking-tight">x{stats.branchCombo} Combo!</span>
              <span className="text-[10px] font-bold text-amber-300 hidden sm:inline">+{stats.branchCombo * 25} XP</span>
            </div>
          )}

          {/* Points Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/40 border border-purple-500/30 text-purple-200">
            <Trophy className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs font-bold font-mono text-purple-300">{stats.totalPoints}</span>
            <span className="text-[10px] font-medium text-purple-400/80 uppercase hidden sm:inline">pts</span>
          </div>

          {/* Gamified Streak Pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/30 text-amber-300 shadow-sm">
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span className="text-xs font-bold font-mono tracking-tight">{stats.streak}</span>
            <span className="text-[10px] font-medium text-amber-400/80 uppercase hidden sm:inline">Streak</span>
          </div>

          {/* Credits Counter & Upgrade trigger */}
          <button
            onClick={onOpenUpgrade}
            className={`flex items-center gap-2 px-3 py-1 rounded-full border transition-all active:scale-95 ${
              stats.creditsRemaining < 10
                ? 'bg-rose-950/60 border-rose-500/50 text-rose-300 animate-pulse'
                : 'bg-indigo-950/40 hover:bg-indigo-900/40 border-indigo-500/30 hover:border-indigo-400 text-indigo-200'
            }`}
            title="Click to manage credits / top-up"
          >
            <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">Credits:</span>
            <span className="text-xs font-bold font-mono text-indigo-300">{stats.creditsRemaining}</span>
          </button>

          {/* CRM Connection Status Button */}
          {onOpenGhlSettings && (
            <button
              onClick={onOpenGhlSettings}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition-all active:scale-95 ${
                isGhlConnected
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 hover:border-emerald-400'
                  : 'bg-amber-950/40 border-amber-500/30 text-amber-300 hover:border-amber-400'
              }`}
              title={
                isGhlConnected
                  ? 'CRM Workspace Connected (Click to manage)'
                  : 'CRM Key Not Configured (Click to set private token)'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isGhlConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[10px] font-bold font-mono tracking-tight">CRM</span>
              <span className="text-[10px] hidden md:inline text-slate-400">
                {isGhlConnected ? 'Live' : 'Connect'}
              </span>
            </button>
          )}

          {/* User Account / Profile / Sign Out (Authenticated vs Unauthenticated) */}
          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2 p-1 pl-2 pr-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 transition-all active:scale-95"
                >
                  <ExecutiveAvatar
                    name={user.name || user.email || 'Operator'}
                    avatarUrl={user.avatarUrl}
                    size="sm"
                    className="w-5 h-5 text-[9px]"
                  />
                  <span className="hidden sm:inline font-semibold text-white max-w-[90px] truncate">
                    {user.name || 'Operator'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-card border border-white/10 shadow-2xl p-3 z-50 animate-fade-in space-y-2.5">
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white truncate">
                          {user.name || 'Operator'}
                        </span>
                        {user.isAdmin && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate font-mono">
                        {user.email}
                      </div>
                      {user.organization && (
                        <div className="flex items-center gap-1 text-[10px] text-cyan-300 pt-0.5">
                          <Building className="w-3 h-3 text-cyan-400" />
                          <span className="truncate">{user.organization}</span>
                        </div>
                      )}
                      {user.ghlSubaccountId && (
                        <div className="text-[10px] font-mono text-emerald-400 pt-1">
                          Subaccount: {user.ghlSubaccountId.slice(0, 10)}...
                        </div>
                      )}
                    </div>

                    <div className="space-y-1">
                      {user.isAdmin && onOpenAdmin && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onOpenAdmin();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/20 transition-colors text-left font-semibold"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Admin Console</span>
                        </button>
                      )}
                      {onOpenOnboarding && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onOpenOnboarding();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
                        >
                          <Compass className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Targeting & Signal ICP</span>
                        </button>
                      )}

                      {onOpenGhlSettings && (
                        <button
                          type="button"
                          onClick={() => {
                            setUserMenuOpen(false);
                            onOpenGhlSettings();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/5 transition-colors text-left"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>CRM Integration Setup</span>
                        </button>
                      )}
                    </div>

                    <div className="pt-1 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout?.();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-300 hover:text-rose-200 hover:bg-rose-500/10 transition-colors text-left font-semibold"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Explicit Sign Out button in header - only visible when user is signed in */}
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/25 hover:border-rose-400/50 text-xs font-semibold text-rose-300 hover:text-rose-200 transition-all active:scale-95 shadow-sm"
                title={`Sign out of ${user.email}`}
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Sign In button */}
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-xs font-semibold text-slate-200 hover:text-white transition-all active:scale-95"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Sign In</span>
              </button>

              {/* Register button */}
              <button
                type="button"
                onClick={() => onOpenAuth?.('signup')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 border border-indigo-400/40 text-xs font-semibold text-white shadow-glow-brand transition-all active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5 text-emerald-200" />
                <span>Register</span>
              </button>
            </div>
          )}

          {/* Audio toggle */}
          <button
            onClick={onToggleSound}
            aria-label={soundEnabled ? "Mute audio" : "Enable audio"}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
            title={soundEnabled ? "Sound Effects ON" : "Sound Effects OFF"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Help / Shortcuts */}
          <button
            onClick={onOpenHelp}
            aria-label="Keyboard shortcuts"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors border border-transparent hover:border-white/10"
            title="Keyboard shortcuts & gestures"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};

