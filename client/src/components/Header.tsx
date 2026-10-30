import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  HelpCircle,
  Volume2,
  VolumeX,
  Radio,
  LogOut,
  ChevronDown,
  Compass,
  Building,
  Home,
  ShieldCheck,
  Coins,
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
    <header className="sticky top-0 z-30 w-full bg-[#0B0F17]/85 backdrop-blur-xl border-b border-white/[0.07] px-4 py-2.5 sm:px-6 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Segmented Navigation */}
        <div className="flex items-center gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => onNavigate?.('landing')}
            className="flex items-center gap-2.5 text-left group focus:outline-none"
            title="TwinFlow Home"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-400 group-hover:border-indigo-500/40 group-hover:bg-indigo-500/20 transition-all">
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-white font-display">
                Twin<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-200">Flow</span>
              </span>
            </div>
          </button>

          {/* Segmented Navigation (Home vs Lead Deck vs Admin) */}
          {onNavigate && (
            <nav className="flex items-center gap-1 p-0.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  currentView === 'landing'
                    ? 'bg-white/[0.08] text-white shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('deck')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  currentView === 'deck'
                    ? 'bg-white/[0.08] text-white shadow-sm border border-white/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.03]'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Lead Deck</span>
                {leadsCount !== undefined && leadsCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-semibold border border-indigo-500/30">
                    {leadsCount}
                  </span>
                )}
              </button>
              {user?.isAdmin && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-all border border-transparent hover:border-amber-500/20"
                  title="Open Admin Console"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Admin</span>
                </button>
              )}
            </nav>
          )}
        </div>

        {/* Right Side: Primary Actions & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Scout Signals Action */}
          <button
            onClick={onScoutNews}
            disabled={isScouting}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              isScouting
                ? 'bg-indigo-950/40 border-indigo-500/30 text-indigo-300 cursor-wait'
                : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white'
            }`}
            title="Scout live market signals via AI"
            aria-label="Scout Market Signals"
          >
            <Radio className={`w-3.5 h-3.5 ${isScouting ? 'text-indigo-400 animate-spin' : 'text-slate-400'}`} />
            <span>{isScouting ? 'Scouting AI...' : 'Scout Signals'}</span>
          </button>

          {/* Credits Badge & Quick Top-Up */}
          <button
            onClick={onOpenUpgrade}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-white/20 text-xs font-medium transition-all"
            title={`${stats.creditsRemaining} credits available. Click to manage.`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-400/80" />
            <span className="font-mono font-semibold text-slate-200">{stats.creditsRemaining}</span>
            <span className="text-[11px] text-slate-500 hidden md:inline">credits</span>
          </button>

          {/* User Account / Profile / Actions */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 py-1 pl-1 pr-2 rounded-lg hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08] text-xs text-slate-200 transition-all focus:outline-none"
              >
                <div className="relative">
                  <ExecutiveAvatar
                    name={user.name || user.email || 'Operator'}
                    avatarUrl={user.avatarUrl}
                    size="sm"
                    className="w-6 h-6 text-[10px]"
                  />
                  {/* Subtle CRM connectivity dot on avatar */}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-[#0B0F17] ${
                      isGhlConnected ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                    title={isGhlConnected ? 'CRM Workspace Connected' : 'CRM Not Connected'}
                  />
                </div>
                <span className="hidden sm:inline font-medium text-slate-200 max-w-[100px] truncate">
                  {user.name || 'Operator'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Comprehensive Workspace Command Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-[#0F141F] border border-white/10 shadow-2xl p-2.5 z-50 animate-fade-in space-y-2">
                  {/* Profile Header */}
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05] space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-semibold text-white truncate">
                        {user.name || 'Operator'}
                      </span>
                      {user.isAdmin ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          ADMIN
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-slate-400 bg-white/5 border border-white/10">
                          PRO
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate font-mono">
                      {user.email}
                    </div>
                    {user.organization && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
                        <Building className="w-3 h-3 text-slate-500" />
                        <span className="truncate">{user.organization}</span>
                      </div>
                    )}
                  </div>

                  {/* Activity & Performance Strip */}
                  <div className="grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-center">
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Credits</div>
                      <div className="text-xs font-mono font-bold text-white">{stats.creditsRemaining}</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Streak</div>
                      <div className="text-xs font-mono font-bold text-amber-300">{stats.streak}d</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">XP</div>
                      <div className="text-xs font-mono font-bold text-indigo-300">{stats.totalPoints}</div>
                    </div>
                  </div>

                  {/* Workspace & Settings Actions */}
                  <div className="space-y-0.5">
                    {onOpenGhlSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenGhlSettings();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>CRM Integration</span>
                        </div>
                        <span
                          className={`text-[10px] font-medium flex items-center gap-1 ${
                            isGhlConnected ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isGhlConnected ? 'bg-emerald-400' : 'bg-slate-500'
                            }`}
                          />
                          {isGhlConnected ? 'Active' : 'Setup'}
                        </span>
                      </button>
                    )}

                    {onOpenOnboarding && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenOnboarding();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors text-left"
                      >
                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Targeting & Signal ICP</span>
                      </button>
                    )}

                    {user.isAdmin && onOpenAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenAdmin();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors text-left font-medium"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                          <span>Admin Console</span>
                        </div>
                        <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Manage
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Preferences: Audio & Shortcuts */}
                  <div className="pt-1 border-t border-white/[0.06] space-y-0.5">
                    <button
                      type="button"
                      onClick={onToggleSound}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {soundEnabled ? (
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        <span>Sound Effects</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500">
                        {soundEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenHelp();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                      <span>Keyboard Shortcuts</span>
                    </button>
                  </div>

                  {/* Sign Out */}
                  <div className="pt-1 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onLogout?.();
                      }}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left font-medium"
                    >
                      <LogOut className="w-3.5 h-3.5 text-rose-400" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth?.('signup')}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-colors shadow-sm"
              >
                Get Started
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
