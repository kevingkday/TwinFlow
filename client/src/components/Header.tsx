import React, { useState, useRef, useEffect } from 'react';
import {
  Zap,
  HelpCircle,
  Volume2,
  VolumeX,
  Radio,
  LogOut,
  ChevronDown,
  Building,
  Home,
  ShieldCheck,
  Coins,
  Compass,
  User,
  Share2,
  Building2,
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
  onOpenMakeNews?: () => void;
  isGhlConnected?: boolean;
  isScouting?: boolean;
  serverOnline?: boolean;
  user?: UserProfile | null;
  onOpenAuth?: (initialMode?: 'signup' | 'login') => void;
  onLogout?: () => void;
  onOpenOnboarding?: () => void;
  currentView?: 'landing' | 'deck' | 'contacts' | 'profile';
  onNavigate?: (view: 'landing' | 'deck' | 'contacts' | 'profile') => void;
  leadsCount?: number;
  contactsCount?: number;
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
  onOpenMakeNews,
  isGhlConnected = false,
  isScouting = false,
  user,
  onOpenAuth,
  onLogout,
  onOpenOnboarding,
  currentView = 'landing',
  onNavigate,
  leadsCount,
  contactsCount,
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
    <header className="sticky top-0 z-30 w-full bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-2.5 sm:px-6 transition-colors shadow-xs">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Left Side: Brand Logo & Navigation */}
        <div className="flex items-center gap-3 sm:gap-6">
          <button
            type="button"
            onClick={() => onNavigate?.('landing')}
            className="flex items-center gap-2.5 text-left group focus:outline-none cursor-pointer"
            title="TwinFlow Home"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600 text-white font-bold text-sm shadow-xs group-hover:bg-blue-700 transition-all">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-bold tracking-tight text-slate-900 font-sans">
                Twin<span className="text-blue-600">Flow</span>
              </span>
            </div>
          </button>

          {/* Segmented Navigation (Home vs Lead Deck vs Admin) */}
          {onNavigate && (
            <nav className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentView === 'landing'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('deck')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentView === 'deck'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                <span>Lead Deck</span>
                {leadsCount !== undefined && leadsCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-mono font-bold">
                    {leadsCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('contacts')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentView === 'contacts'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Contacts</span>
                {contactsCount !== undefined && contactsCount > 0 && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-mono font-bold">
                    {contactsCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  currentView === 'profile'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>Profile</span>
              </button>
              {user?.isAdmin && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-800 hover:text-amber-950 hover:bg-amber-100 transition-all cursor-pointer"
                  title="Open Admin Console"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>Admin</span>
                </button>
              )}
            </nav>
          )}
        </div>

        {/* Right Side: Primary Actions & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Make News (Social Broadcast) Action */}
          {onOpenMakeNews && (
            <button
              type="button"
              onClick={onOpenMakeNews}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200/80 bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 text-xs font-semibold shadow-xs transition-all cursor-pointer"
              title="Make News & Broadcast to CRM Social Channels"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Make News</span>
            </button>
          )}

          {/* Scout Signals Action */}
          <button
            onClick={onScoutNews}
            disabled={isScouting}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              isScouting
                ? 'bg-blue-50 border-blue-200 text-blue-700 cursor-wait'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 hover:text-slate-900 shadow-xs'
            }`}
            title="Scout live market signals via AI"
            aria-label="Scout Market Signals"
          >
            <Radio className={`w-3.5 h-3.5 ${isScouting ? 'text-blue-600 animate-spin' : 'text-slate-500'}`} />
            <span>{isScouting ? 'Scouting AI...' : 'Scout Signals'}</span>
          </button>

          {/* Credits Badge */}
          <button
            onClick={onOpenUpgrade}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 shadow-xs transition-all cursor-pointer"
            title={`${stats.creditsRemaining} credits available. Click to manage.`}
          >
            <Coins className="w-3.5 h-3.5 text-amber-500" />
            <span className="font-mono font-bold text-slate-900">{stats.creditsRemaining}</span>
            <span className="text-[11px] text-slate-500 hidden md:inline">credits</span>
          </button>

          {/* User Account / Profile / Actions */}
          {user ? (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setUserMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 py-1 pl-1 pr-2.5 rounded-xl hover:bg-slate-100 border border-slate-200 text-xs text-slate-700 transition-all focus:outline-none cursor-pointer bg-white shadow-xs"
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
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-white ${
                      isGhlConnected ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                    title={isGhlConnected ? 'CRM Connected' : 'CRM Not Connected'}
                  />
                </div>
                <span className="hidden sm:inline font-semibold text-slate-800 max-w-[120px] truncate">
                  {user.name || 'Operator'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* Comprehensive Workspace Command Menu */}
              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl p-3 z-50 animate-fade-in space-y-2 text-slate-800">
                  {/* Profile Header */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">
                        {user.name || 'Operator'}
                      </span>
                      {user.isAdmin ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          ADMIN
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono text-slate-600 bg-white border border-slate-200">
                          MEMBER
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate font-mono">
                      {user.email}
                    </div>
                    {user.organization && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-600 pt-0.5">
                        <Building className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{user.organization}</span>
                      </div>
                    )}
                  </div>

                  {/* Summary Metric Strip */}
                  <div className="grid grid-cols-2 gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200/70 text-center">
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Available Credits</div>
                      <div className="text-xs font-mono font-bold text-slate-900">{stats.creditsRemaining}</div>
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Leads Approved</div>
                      <div className="text-xs font-mono font-bold text-emerald-600">{stats.approvedCount}</div>
                    </div>
                  </div>

                  {/* Workspace & Settings Actions */}
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onNavigate?.('profile');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-left cursor-pointer font-medium"
                    >
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-600" />
                        <span>Profile & Offerings</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Edit</span>
                    </button>

                    {onOpenMakeNews && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenMakeNews();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-left cursor-pointer font-medium"
                      >
                        <div className="flex items-center gap-2">
                          <Share2 className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Make News (Push Social)</span>
                        </div>
                        <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded">
                          Broadcast
                        </span>
                      </button>
                    )}

                    {onOpenGhlSettings && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenGhlSettings();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2 font-medium">
                          <Zap className="w-3.5 h-3.5 text-blue-600" />
                          <span>CRM Integration</span>
                        </div>
                        <span
                          className={`text-[10px] font-semibold flex items-center gap-1 ${
                            isGhlConnected ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isGhlConnected ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                          />
                          {isGhlConnected ? 'Connected' : 'Setup'}
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
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors text-left cursor-pointer font-medium"
                      >
                        <Compass className="w-3.5 h-3.5 text-slate-500" />
                        <span>Campaign Targeting</span>
                      </button>
                    )}

                    {user.isAdmin && onOpenAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onOpenAdmin();
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-amber-800 hover:text-amber-900 hover:bg-amber-50 transition-colors text-left font-semibold cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>Admin Console</span>
                        </div>
                        <span className="text-[10px] font-bold bg-amber-100 px-1.5 py-0.5 rounded text-amber-800">
                          Admin
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Preferences: Audio & Shortcuts */}
                  <div className="pt-1 border-t border-slate-200 space-y-0.5">
                    <button
                      type="button"
                      onClick={onToggleSound}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        {soundEnabled ? (
                          <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Sound Feedback</span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-500 font-semibold">
                        {soundEnabled ? 'ON' : 'OFF'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        onOpenHelp();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>Keyboard Shortcuts</span>
                    </button>
                  </div>

                  {/* Sign Out */}
                  {onLogout && (
                    <div className="pt-1.5 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenAuth?.('login')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth?.('signup')}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer"
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
