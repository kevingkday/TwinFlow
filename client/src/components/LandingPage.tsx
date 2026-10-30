import React, { useState } from 'react';
import {
  Zap,
  Radio,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Mail,
  Network,
  RotateCcw,
  Check,
  Flame,
  Trophy,
  ChevronRight,
  ChevronDown,
  Layers,
  MousePointerClick,
  Database,
  DollarSign,
} from 'lucide-react';
import type { LeadCardData, SwipeAction, SwipeStats, UserProfile } from '../types/lead';
import { SwipeCard } from './SwipeCard';
import { ActionControls } from './ActionControls';

interface LandingPageProps {
  onLaunchDeck: () => void;
  onOpenAuth: (mode?: 'signup' | 'login') => void;
  onOpenUpgrade?: () => void;
  user?: UserProfile | null;
  leads: LeadCardData[];
  onSwipe: (action: SwipeAction) => void;
  onOpenPitchEditor: (lead: LeadCardData) => void;
  onOpenBranchOut?: (lead: LeadCardData) => void;
  onReset: () => void;
  stats: SwipeStats;
  isCrmConnected?: boolean;
  onOpenCrmSettings?: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchDeck,
  onOpenAuth,
  onOpenUpgrade,
  user,
  leads,
  onSwipe,
  onOpenPitchEditor,
  onOpenBranchOut,
  onReset,
  stats,
  isCrmConnected = false,
  onOpenCrmSettings,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const activeDemoLead = leads[0];

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#070A0F] text-slate-100 flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-15%] left-[20%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl" />
        <div className="absolute top-[35%] right-[-10%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-cyan-600/10 via-emerald-600/10 to-transparent blur-3xl" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[700px] h-[700px] rounded-full bg-gradient-to-tr from-purple-900/15 to-transparent blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col">
        {/* =========================================================================
            HERO SECTION
           ========================================================================= */}
        <section className="pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 max-w-7xl mx-auto w-full text-center flex flex-col items-center">
          {/* Eyebrow Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Autonomous Market Signal Intelligence</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-300">Zero Stale Leads</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white font-display tracking-tight max-w-4xl leading-[1.15] mb-6">
            Turn Breaking Market Catalysts into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-300 to-indigo-100">
              High-Converting Pipeline
            </span>{' '}
            in Seconds.
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl leading-relaxed mb-8">
            Stop cold emailing stale databases. TwinFlow's AI monitors live regional business news,
            detects high-intent expansion events, enriches verified executive decision-makers, and drafts
            bespoke outbound pitches ready to push into your CRM with a single swipe.
          </p>

          {/* Primary CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md mb-12">
            {user ? (
              <button
                type="button"
                onClick={onLaunchDeck}
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-emerald-300" />
                <span>Launch Lead Deck</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="w-full sm:w-auto px-6 py-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Get Started Free (+500 Credits)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => scrollToSection('demo-section')}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 text-slate-200 hover:text-white font-medium text-sm transition-all flex items-center justify-center gap-2"
            >
              <MousePointerClick className="w-4 h-4 text-cyan-400" />
              <span>Try Interactive Demo</span>
            </button>
          </div>

          {/* Trust Highlights Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl text-left">
            <div className="p-3.5 rounded-xl glass-card border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                <TrendingUp className="w-4 h-4" />
                <span>Real-Time Catalysts</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Expansions, hires, funding rounds & contracts surfaced hours after happening.
              </p>
            </div>

            <div className="p-3.5 rounded-xl glass-card border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Verified Dossiers</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Direct executive emails and LinkedIn profiles auto-matched to the catalyst.
              </p>
            </div>

            <div className="p-3.5 rounded-xl glass-card border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-bold mb-1">
                <Mail className="w-4 h-4" />
                <span>Contextual Pitches</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                AI drafts personalized outreach referencing the exact article hook.
              </p>
            </div>

            <div className="p-3.5 rounded-xl glass-card border border-white/5 bg-white/[0.02]">
              <div className="flex items-center gap-2 text-amber-400 text-xs font-bold mb-1">
                <Database className="w-4 h-4" />
                <span>1-Click CRM Sync</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                Pushes leads directly into your dedicated CRM workspace with full context.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            INTERACTIVE LIVE DEMO SECTION
           ========================================================================= */}
        <section
          id="demo-section"
          className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-white/10 scroll-mt-12"
        >
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-3">
              <Zap className="w-3.5 h-3.5" />
              <span>Interactive Lead Triage Simulator</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display mb-3">
              Experience the Swipe-to-Pipeline Flow
            </h2>
            <p className="text-sm text-slate-400">
              Drag right to approve and queue into your CRM, or drag left to pass. You can also edit pitches
              or branch out to explore competitor intelligence.
            </p>
          </div>

          <div className="max-w-xl mx-auto flex flex-col items-center">
            {activeDemoLead ? (
              <div className="w-full flex flex-col items-center">
                {/* Embedded Card Container */}
                <div className="relative w-full max-w-md h-[510px] sm:h-[550px] mb-4">
                  {leads[1] && (
                    <div
                      className="absolute inset-0 w-full rounded-2xl bg-[#0E1522] border border-white/10 opacity-70 scale-[0.95] translate-y-3.5 pointer-events-none transition-all duration-300 shadow-lg"
                      aria-hidden="true"
                    />
                  )}

                  <SwipeCard
                    key={activeDemoLead.id}
                    lead={activeDemoLead}
                    isFront={true}
                    onSwipe={onSwipe}
                    onOpenPitchEditor={onOpenPitchEditor}
                    onOpenBranchOut={onOpenBranchOut}
                  />
                </div>

                {/* Demo Action Buttons */}
                <div className="w-full max-w-md">
                  <ActionControls
                    onAction={onSwipe}
                    onEditPitch={() => onOpenPitchEditor(activeDemoLead)}
                    disabled={false}
                    creditBalance={stats.creditsRemaining}
                    onUpgradePrompt={onOpenUpgrade}
                    isCrmConnected={isCrmConnected}
                    onOpenCrmSettings={onOpenCrmSettings}
                  />
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md h-[460px] rounded-2xl glass-card flex flex-col items-center justify-center p-8 text-center border border-white/10">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-glow-emerald">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white font-display mb-2">Demo Batch Cleared!</h3>
                <p className="text-xs text-slate-400 mb-6 max-w-xs leading-relaxed">
                  You just experienced the triage velocity. In production, TwinFlow streams continuous new signals
                  matching your targeting profile directly into your deck.
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={onReset}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-semibold transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reset Demo Cards</span>
                  </button>
                  <button
                    type="button"
                    onClick={onLaunchDeck}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 text-white text-xs font-bold shadow-glow-brand transition-all active:scale-95"
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-200" />
                    <span>Open Full Workspace</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Helper below demo */}
            <div className="mt-6 flex items-center justify-between w-full max-w-md px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-slate-400">
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Streak: <strong className="text-white">{stats.streak}</strong></span>
              </span>
              <span className="flex items-center gap-1.5">
                <Trophy className="w-3.5 h-3.5 text-purple-400" />
                <span>Points: <strong className="text-white">{stats.totalPoints}</strong></span>
              </span>
              <button
                type="button"
                onClick={onLaunchDeck}
                className="text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <span>Launch Deck</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            OLD WAY VS TWINFLOW COMPARISON
           ========================================================================= */}
        <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-white/10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mb-3">
              Why Cold Outbound is Broken — And How Catalysts Win
            </h2>
            <p className="text-sm text-slate-400">
              Buying static contact lists produces sub-1% response rates. Reaching out right after a public
              catalyst creates urgent, welcome conversations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* The Old Way */}
            <div className="p-6 rounded-2xl bg-rose-950/15 border border-rose-500/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-rose-400 font-bold text-sm uppercase tracking-wider mb-4">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span>The Legacy Way (Static B2B Databases)</span>
                </div>
                <ul className="space-y-3.5 text-xs text-slate-300">
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Stale data:</strong> Contacts who left companies 6-12 months ago.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Generic spray & pray:</strong> "Hope you're having a good week" templates that hit spam folders.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Zero timing:</strong> Reaching out with no trigger or reason why they should buy right now.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-rose-400 font-bold">✕</span>
                    <span><strong>Manual CRM entry:</strong> Tedious copy-pasting across browser tabs and CSV spreadsheets.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-rose-500/20 text-[11px] text-rose-300 font-medium">
                Average reply rate: <strong>0.5% - 1.2%</strong>
              </div>
            </div>

            {/* The TwinFlow Way */}
            <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between shadow-glow-emerald">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase tracking-wider mb-4">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>The TwinFlow Way (Live Catalyst Engine)</span>
                </div>
                <ul className="space-y-3.5 text-xs text-slate-200">
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>Real-time breaking triggers:</strong> Commercial expansions, office relocations, hiring surges, and funding events.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>Context-tailored pitches:</strong> High-converting drafts referencing the exact catalyst and executive milestone.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>Verified key executives:</strong> Direct emails and LinkedIn URLs auto-discovered for immediate outreach.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span><strong>1-swipe CRM synchronization:</strong> Seamlessly transfers contacts, notes, and custom fields to your CRM.</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-4 border-t border-emerald-500/30 text-[11px] text-emerald-300 font-medium">
                Average reply rate: <strong>14% - 28%</strong> (10x lift on trigger-based outreach)
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            HOW IT WORKS (3-STEP PIPELINE)
           ========================================================================= */}
        <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-white/10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-bold mb-3">
              <Layers className="w-3.5 h-3.5" />
              <span>Three-Step Workflow</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mb-3">
              How TwinFlow Works
            </h2>
            <p className="text-sm text-slate-400">
              From fresh news trigger to scheduled outbound in your CRM within 60 seconds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Step 1 */}
            <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center font-bold text-sm mb-4">
                  01
                </div>
                <h3 className="text-base font-bold text-white mb-2 font-display">Define Your Radar</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Select your target industries (Healthcare, Construction, SaaS, Manufacturing, etc.)
                  and specify your geographic target — local metro, state, or nationwide.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-cyan-300 font-mono">
                AI crafts calibrated 3-6 word semantic news queries.
              </div>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 flex items-center justify-center font-bold text-sm mb-4">
                  02
                </div>
                <h3 className="text-base font-bold text-white mb-2 font-display">Autonomous AI Scouting</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Our pipeline crawls local business journals and news outlets, extracts the company milestone,
                  finds the verified decision-maker, and drafts a customized outreach pitch.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-indigo-300 font-mono">
                Verified email, LinkedIn & bullet point dossier ready.
              </div>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-2xl glass-card border border-white/10 relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center font-bold text-sm mb-4">
                  03
                </div>
                <h3 className="text-base font-bold text-white mb-2 font-display">Swipe, Branch & Sync</h3>
                <p className="text-xs text-slate-400 leading-relaxed mb-4">
                  Triage cards in the gamified deck. Swipe right to automatically push the contact and pitch into
                  your CRM pipeline. One-click Branch Out exposes sister executives & market rivals.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-[11px] text-emerald-300 font-mono">
                100% automated CRM sync with custom tags.
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            FEATURE PILLARS GRID
           ========================================================================= */}
        <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-white/10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mb-3">
              Engineered for Modern Revenue Teams
            </h2>
            <p className="text-sm text-slate-400">
              Everything you need to turn raw public intelligence into warm, inbound-like sales conversations.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {/* Feature 1 */}
            <div className="p-5 rounded-2xl glass-card border border-white/5 hover:border-indigo-500/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Radio className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 font-display">Hyper-Local Market Radar</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Filter news signals down to specific cities, metropolitan areas, or regional economic zones.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-5 rounded-2xl glass-card border border-white/5 hover:border-purple-500/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 font-display">Bespoke Outbound Copy</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI produces contextual cold emails that cite the exact news event, reading like 30 minutes of human research.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-5 rounded-2xl glass-card border border-white/5 hover:border-cyan-500/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 font-display">Verified Contact Enrichment</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Auto-enriches decision-maker names, titles, direct emails, and LinkedIn links to ensure zero bounce rates.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-5 rounded-2xl glass-card border border-white/5 hover:border-emerald-500/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 font-display">Dedicated CRM Workspaces</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your CRM private token to push contacts, dossiers, and generated pitches directly into your pipelines.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-5 rounded-2xl glass-card border border-white/5 hover:border-amber-500/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Network className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 font-display">Branch Out Knowledge Graph</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Instantly discover peer competitors or additional internal stakeholders with one click from any card.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-5 rounded-2xl glass-card border border-white/5 hover:border-rose-500/30 transition-all group">
              <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1.5 font-display">Gamified Flow State</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Combos, streaks, XP milestones, and satisfying tactile audio transform lead triage into a high-energy routine.
              </p>
            </div>
          </div>
        </section>

        {/* =========================================================================
            TARGET SECTORS SHOWCASE
           ========================================================================= */}
        <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-white/10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mb-3">
              Broad Industry & Localized Coverage
            </h2>
            <p className="text-sm text-slate-400">
              TwinFlow works for any business hunting for local or national growth signals.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2.5 max-w-4xl mx-auto">
            {[
              'Commercial Real Estate',
              'General Contracting & Construction',
              'Healthcare & Medical Practices',
              'Legal & Law Firms',
              'Accounting & CPA Practices',
              'Advanced Manufacturing',
              'Logistics & Supply Chain',
              'B2B SaaS & Tech',
              'HVAC & Specialty Trades',
              'Wealth & Asset Management',
              'Franchise & Retail Expansion',
              'Biotech & Life Sciences',
            ].map((sector) => (
              <span
                key={sector}
                className="px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-xs text-slate-300 font-medium hover:bg-white/[0.08] hover:border-cyan-400/40 hover:text-white transition-all cursor-default"
              >
                {sector}
              </span>
            ))}
          </div>
        </section>

        {/* =========================================================================
            PRICING / CREDITS SECTION
           ========================================================================= */}
        <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-white/10">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold mb-3">
              <DollarSign className="w-3.5 h-3.5" />
              <span>Transparent Credit Pricing</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mb-3">
              Pay Only When You Find Signal
            </h2>
            <p className="text-sm text-slate-400">
              Start with 500 free credits upon registration. Only 10 credits per approved lead pushed to CRM.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {/* Starter Plan */}
            <div className="p-6 rounded-2xl glass-card border border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Starter Tier</h3>
                <p className="text-xs text-slate-400 mb-4">Ideal for individual SDRs or testing local signals.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-extrabold text-white font-display">$0</span>
                  <span className="text-xs text-slate-400">/ free on signup</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>500 Starter Credits included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Live AI news scouting</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Direct CRM subaccount sync</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Verified decision-maker dossiers</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="mt-6 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all active:scale-95"
              >
                Claim 500 Credits Free
              </button>
            </div>

            {/* Growth Plan (Popular) */}
            <div className="p-6 rounded-2xl glass-card border border-indigo-500/50 relative flex flex-col justify-between shadow-glow-brand">
              <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
                Most Popular
              </div>
              <div>
                <h3 className="text-base font-bold text-white mb-1">Growth Operator</h3>
                <p className="text-xs text-slate-400 mb-4">For active founders, agencies & outbound teams.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-extrabold text-white font-display">$49</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-200">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span><strong>2,500 Credits</strong> per month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Continuous automated background radar</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Unlimited Branch Out competitor graphs</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Custom CRM pipeline routing</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onOpenUpgrade}
                className="mt-6 w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-xs font-bold text-white shadow-glow-brand transition-all active:scale-95"
              >
                Upgrade to Growth
              </button>
            </div>

            {/* Agency / Enterprise */}
            <div className="p-6 rounded-2xl glass-card border border-white/10 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-white mb-1">Agency Scale</h3>
                <p className="text-xs text-slate-400 mb-4">Multi-client subaccount routing and custom webhooks.</p>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-3xl font-extrabold text-white font-display">$149</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span><strong>10,000 Credits</strong> per month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Multi-subaccount CRM routing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Dedicated priority intelligence feeds</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Team seats & shared signal decks</span>
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={onOpenUpgrade}
                className="mt-6 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-white transition-all active:scale-95"
              >
                Upgrade to Agency
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            FAQ ACCORDION
           ========================================================================= */}
        <section className="py-16 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-white/10">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white font-display mb-3">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-slate-400">
              Clear answers to how TwinFlow fits into your outbound sales workflow.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {[
              {
                q: 'What is a "Market Signal" or "Catalyst"?',
                a: 'A market signal is any public business event indicating growth, change, or capital availability — such as a company expanding into a new office, securing funding, winning a major contract, or hiring new executive leadership. Reaching out immediately after a catalyst yields 10x higher response rates than random cold outreach.',
              },
              {
                q: 'How does TwinFlow find these signals?',
                a: 'TwinFlow continuously scans thousands of regional and local news sources, business journals, industry periodicals, and press releases using advanced AI search calibration tailored to your exact industry and location.',
              },
              {
                q: 'What happens when I click "Approve" (swipe right)?',
                a: 'When you approve a card, TwinFlow pushes the company, the verified decision-maker (name, direct email, LinkedIn), and the customized AI outreach pitch straight into your CRM workspace as an active contact/opportunity. It deducts 10 credits and advances you to the next signal.',
              },
              {
                q: 'How do I connect my CRM?',
                a: 'You can connect your CRM in seconds by adding your Private Integration Token in the CRM Setup modal. Once added, every approved lead is immediately synced to your designated pipeline stage.',
              },
              {
                q: 'Can I target specific local cities or industries?',
                a: 'Yes! The setup wizard allows you to select your target sectors (from commercial real estate to healthcare and legal) and your target geography (from a specific metro area to nationwide).',
              },
              {
                q: 'What does the "Branch Out" feature do?',
                a: 'Branch Out uses our knowledge graph to discover sister decision-makers inside the same company or peer competitors in the same market, multiplying each signal into multiple warm pipeline opportunities.',
              },
            ].map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl glass-card border border-white/5 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 hover:bg-white/[0.02]"
                >
                  <span className="text-sm font-semibold text-white">{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      activeFaq === idx ? 'rotate-180 text-cyan-400' : ''
                    }`}
                  />
                </button>
                {activeFaq === idx && (
                  <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-white/5 bg-white/[0.01]">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* =========================================================================
            BOTTOM CALL TO ACTION
           ========================================================================= */}
        <section className="py-20 px-4 sm:px-6 max-w-7xl mx-auto w-full text-center border-t border-white/10">
          <div className="max-w-3xl mx-auto p-8 sm:p-12 rounded-3xl bg-gradient-to-b from-indigo-950/40 via-purple-950/30 to-[#0B0F17] border border-indigo-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-[-50%] left-[20%] w-[400px] h-[400px] rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

            <h2 className="text-2xl sm:text-4xl font-extrabold text-white font-display mb-4">
              Ready to Accelerate Your Outbound Pipeline?
            </h2>
            <p className="text-sm text-slate-300 max-w-xl mx-auto mb-8 leading-relaxed">
              Join founders, SDRs, and agencies using real-time market catalysts to book more meetings with less effort.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => onOpenAuth('signup')}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white font-bold text-sm shadow-glow-brand transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Create Free Account (+500 Credits)</span>
              </button>

              <button
                type="button"
                onClick={onLaunchDeck}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white font-semibold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Launch Lead Deck</span>
              </button>
            </div>
          </div>
        </section>

        {/* =========================================================================
            FOOTER
           ========================================================================= */}
        <footer className="py-8 px-4 sm:px-6 max-w-7xl mx-auto w-full border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-600 to-emerald-400 p-[1px] flex items-center justify-center">
              <div className="w-full h-full bg-[#0B0F17] rounded-[7px] flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
              </div>
            </div>
            <span className="font-bold text-white font-display">TwinFlow</span>
            <span className="text-slate-600">•</span>
            <span>Autonomous Market Signal Intelligence & CRM Orchestration</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={onLaunchDeck}
              className="hover:text-white transition-colors"
            >
              Lead Deck
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('demo-section')}
              className="hover:text-white transition-colors"
            >
              Live Demo
            </button>
            {onOpenCrmSettings && (
              <button
                type="button"
                onClick={onOpenCrmSettings}
                className="hover:text-white transition-colors"
              >
                CRM Setup
              </button>
            )}
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-white transition-colors"
            >
              Sign In
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
