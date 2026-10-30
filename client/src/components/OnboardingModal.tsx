import React, { useState } from 'react';
import {
  Compass,
  Target,
  Sparkles,
  Zap,
  ArrowRight,
  Check,
  Plus,
  Radio,
  Briefcase,
  ChevronRight,
  MapPin,
  Flame,
  Search,
  X,
} from 'lucide-react';
import type { UserProfile } from '../types/lead';
import { playSound } from '../utils/audio';

interface OnboardingModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  onComplete: (updatedUser: UserProfile) => void;
  onClose?: () => void;
}

export interface IndustrySector {
  id: string;
  name: string;
  emoji: string;
  items: string[];
}

export const INDUSTRY_SECTORS: IndustrySector[] = [
  {
    id: 'popular',
    name: 'Popular Across Sectors',
    emoji: '⭐',
    items: [
      'Commercial Real Estate',
      'Healthcare & Medical Practices',
      'Legal & Law Firms',
      'Accounting & CPA Practices',
      'General Contracting & Construction',
      'Advanced Manufacturing',
      'B2B SaaS & Enterprise Software',
      'Logistics & Supply Chain',
    ],
  },
  {
    id: 'services',
    name: 'Professional & Financial',
    emoji: '⚖️',
    items: [
      'Legal & Law Firms',
      'Accounting & CPA Practices',
      'Wealth & Asset Management',
      'Commercial Banking & Lending',
      'Insurance & Risk Brokerages',
      'Management Consulting',
      'Executive Staffing & Recruiting',
      'Marketing & Digital Agencies',
    ],
  },
  {
    id: 'healthcare',
    name: 'Healthcare & Medical',
    emoji: '🏥',
    items: [
      'Hospitals & Health Networks',
      'Private Medical Clinics',
      'Dental & Orthodontic Practices',
      'Biotech & Pharmaceuticals',
      'Mental & Behavioral Health',
      'Medical Device Manufacturers',
      'Senior Care & Assisted Living',
      'Veterinary Hospitals',
    ],
  },
  {
    id: 'realestate',
    name: 'Real Estate & Construction',
    emoji: '🏗️',
    items: [
      'Commercial Real Estate Brokerages',
      'Residential & Multifamily Developers',
      'General Contractors & Builders',
      'Architecture & Engineering (AEC)',
      'Commercial Property Management',
      'Specialty Trade Contractors (HVAC/Electrical)',
      'Civil & Public Infrastructure',
      'Building Material Suppliers',
    ],
  },
  {
    id: 'industrial',
    name: 'Manufacturing & Industrial',
    emoji: '🏭',
    items: [
      'Industrial Machinery & Equipment',
      'Automotive & Aerospace Parts',
      'Food & Beverage Production',
      'Packaging & Container Manufacturing',
      'Chemicals & Plastics',
      'Metals & Fabrication',
      'Electronics & Hardware Assembly',
    ],
  },
  {
    id: 'logistics',
    name: 'Logistics & Supply Chain',
    emoji: '🚚',
    items: [
      'Freight & Trucking Carriers',
      'Third-Party Logistics (3PL)',
      'Warehousing & Cold Storage',
      'Maritime & Air Cargo',
      'Fleet Management Solutions',
      'Last-Mile Delivery Services',
    ],
  },
  {
    id: 'consumer',
    name: 'Retail, Franchise & Hospitality',
    emoji: '🛍️',
    items: [
      'Restaurant Chains & Food Service',
      'Franchise Operator Networks',
      'Hotels, Resorts & Hospitality',
      'Retail Stores & E-commerce Brands',
      'Consumer Packaged Goods (CPG)',
      'Fitness, Health Clubs & Wellness',
    ],
  },
  {
    id: 'energy',
    name: 'Energy & Environmental',
    emoji: '⚡',
    items: [
      'Solar & Renewable Energy',
      'Commercial Utilities & Power',
      'Environmental & Remediation Services',
      'Waste Management & Recycling',
      'Oil, Gas & Energy Infrastructure',
    ],
  },
  {
    id: 'technology',
    name: 'Technology & Software',
    emoji: '💻',
    items: [
      'B2B SaaS & Enterprise Software',
      'Artificial Intelligence & ML',
      'Cybersecurity & Network Defense',
      'Cloud & IT Managed Services (MSPs)',
      'Fintech & Payment Systems',
      'Healthtech & Telehealth',
      'Defense & Aerospace Tech',
    ],
  },
];

export const INTENT_OPTIONS = [
  {
    id: 'sales_client_acquisition',
    title: 'B2B Client Acquisition',
    emoji: '💼',
    desc: 'Selling a product, service, software, or agency offer to expanding businesses.',
  },
  {
    id: 'subcontractor_partners',
    title: 'Subcontracting & Bidding',
    emoji: '🤝',
    desc: 'Securing trade bids, RFPs, commercial buildouts, and project partnerships.',
  },
  {
    id: 'job_seeking',
    title: 'Executive Career / Job Hunt',
    emoji: '🎯',
    desc: 'Finding leadership, VP, or C-suite opportunities at rapidly growing companies.',
  },
  {
    id: 'investing',
    title: 'Investing & Deal Sourcing',
    emoji: '💰',
    desc: 'Discovering acquisitions, succession buyouts, and private funding rounds.',
  },
];

export const LOCATION_PRESETS = [
  'Dallas-Fort Worth, TX',
  'Austin, TX',
  'Houston, TX',
  'Greater Vancouver, BC',
  'Toronto Metro, ON',
  'Los Angeles, CA',
  'New York Metro',
  'Chicago, IL',
  'Miami / South Florida',
  'London, UK',
  'Nationwide US',
];

export const BROAD_TRIGGERS = [
  { name: 'New Location or Facility Opening', tag: 'Facility', icon: '🏢' },
  { name: 'Major Contract or RFP Awarded', tag: 'Contract', icon: '📜' },
  { name: 'New Managing Partner / Executive Hire', tag: 'Leadership', icon: '👤' },
  { name: 'Mergers, Acquisitions or Succession', tag: 'M&A', icon: '🤝' },
  { name: 'Rapid Hiring & Team Scaling', tag: 'Growth', icon: '📈' },
  { name: 'Capital Investment & Facility Upgrade', tag: 'Expansion', icon: '🏗️' },
  { name: 'Private Equity Backing or Growth Capital', tag: 'Capital', icon: '💰' },
  { name: 'Commercial Debt / Refinancing', tag: 'Finance', icon: '🏦' },
  { name: 'Regulatory, Licensing or Compliance Shift', tag: 'Compliance', icon: '⚖️' },
  { name: 'Series A / Venture Funding', tag: 'Venture', icon: '🚀' },
  { name: 'Rebranding or New Service Line Launch', tag: 'Launch', icon: '✨' },
];

export const BROAD_ROLES = [
  { name: 'Owner / Founder / Principal', category: 'Executive' },
  { name: 'Managing Partner / Practice Director', category: 'Leadership' },
  { name: 'Chief Executive Officer (CEO)', category: 'Executive' },
  { name: 'President / General Manager (GM)', category: 'Executive' },
  { name: 'Chief Operating Officer (COO)', category: 'Operations' },
  { name: 'VP / Director of Operations', category: 'Operations' },
  { name: 'Chief Financial Officer (CFO) / Controller', category: 'Finance' },
  { name: 'Director of Procurement / Purchasing', category: 'Procurement' },
  { name: 'VP of Sales / Business Development', category: 'Commercial' },
  { name: 'Chief Marketing Officer (CMO)', category: 'Commercial' },
  { name: 'Chief Technology Officer (CTO) / IT Director', category: 'Technology' },
  { name: 'Head of Human Resources / Talent', category: 'People' },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  user: _user,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [targetLocation, setTargetLocation] = useState('Dallas-Fort Worth, TX');
  const [userIntent, setUserIntent] = useState('sales_client_acquisition');
  const [userMission, setUserMission] = useState(
    'I help commercial general contractors and developers streamline subcontractor bidding and reduce procurement costs.'
  );

  const [activeSectorTab, setActiveSectorTab] = useState<string>('popular');
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([
    'Commercial Real Estate',
    'General Contracting & Construction',
  ]);
  const [customIndustry, setCustomIndustry] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([
    'New Location or Facility Opening',
    'Major Contract or RFP Awarded',
    'New Managing Partner / Executive Hire',
  ]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([
    'Owner / Founder / Principal',
    'President / General Manager (GM)',
    'VP of Sales / Business Development',
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressStatus, setProgressStatus] = useState<string>('');

  if (!isOpen) return null;

  const toggleItem = (list: string[], setList: (items: string[]) => void, item: string) => {
    if (list.includes(item)) {
      if (list.length > 1) {
        setList(list.filter((i) => i !== item));
      }
    } else {
      setList([...list, item]);
    }
  };

  const handleAddCustomIndustry = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customIndustry.trim();
    if (clean && !selectedIndustries.includes(clean)) {
      setSelectedIndustries([...selectedIndustries, clean]);
      setCustomIndustry('');
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    setProgressStatus('AI analyzing your mission, intent, and target location...');
    playSound('approve');

    try {
      const res = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLocation,
          userIntent,
          userMission,
          targetIndustries: selectedIndustries,
          targetTriggers: selectedTriggers,
          targetRoles: selectedRoles,
          valueProp: userMission,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.user) {
        setProgressStatus('Synthesizing calibrated Google News query & seeding deck...');
        playSound('streak');
        setTimeout(() => {
          onComplete(data.user);
        }, 1200);
      } else {
        setIsSubmitting(false);
        alert(data.error || 'Failed to complete onboarding. Please try again.');
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      alert(err instanceof Error ? err.message : 'Network error during setup.');
    }
  };

  const currentSector =
    INDUSTRY_SECTORS.find((s) => s.id === activeSectorTab) || INDUSTRY_SECTORS[0];

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-2xl rounded-2xl glass-card border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-cyan-950/40 via-indigo-950/40 to-purple-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-indigo-500 to-purple-500 p-[1px] shadow-glow-brand flex-shrink-0">
              <div className="w-full h-full bg-[#0B0F17] rounded-[11px] flex items-center justify-center">
                <Compass className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">
                  Market Signal Intelligence Setup
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
                  Step {step} of 4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                AI-Calibrated for local & industry-specific opportunity discovery
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-white/5 h-1">
          <div
            className="bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 h-1 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Wizard Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {isSubmitting ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-glow-brand">
                  <Radio className="w-8 h-8 text-indigo-400 animate-spin" />
                </div>
                <Sparkles className="w-5 h-5 text-amber-300 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display mb-1">
                  Synthesizing Market Intelligence with AI
                </h3>
                <p className="text-xs text-slate-400 max-w-sm">
                  {progressStatus || 'Generating optimal 3-6 word targeted query and matching local decision-makers...'}
                </p>
              </div>
              <div className="space-y-2 pt-3 text-left w-full max-w-xs text-xs text-slate-300">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span>CRM Sub-Account Provisioned</span>
                </div>
                <div className="flex items-center gap-2 text-cyan-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>AI Search Calibration active</span>
                </div>
                <div className="flex items-center gap-2 text-indigo-300 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>Localizing catalysts for {targetLocation}</span>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* STEP 1: Mission, Intent & Location */}
              {step === 1 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-400" />
                      What opportunity are you hunting for?
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Tell us what you sell or seek so our AI can formulate the perfect targeted news search.
                    </p>
                  </div>

                  {/* Intent Selection Cards */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                      Your Primary Goal
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {INTENT_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => setUserIntent(opt.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                            userIntent === opt.id
                              ? 'bg-cyan-500/15 border-cyan-400/50 text-cyan-200 shadow-glow-brand'
                              : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-semibold text-xs mb-0.5">
                            <span>{opt.emoji}</span>
                            <span className="text-white">{opt.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            {opt.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Location Intake */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-amber-400" />
                        Target Location / Geography *
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dallas-Fort Worth, TX or Greater Vancouver, BC"
                        value={targetLocation}
                        onChange={(e) => setTargetLocation(e.target.value)}
                        className="w-full bg-[#090D14] text-slate-200 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
                      />
                    </div>
                    {/* Quick location presets */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[10px] text-slate-500 py-0.5">Quick pick:</span>
                      {LOCATION_PRESETS.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setTargetLocation(loc)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                            targetLocation === loc
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-200 font-semibold'
                              : 'bg-white/5 border-white/5 text-slate-400 hover:text-white'
                          }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Free-form Mission Description */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Describe What You Offer or What You Seek *
                      </label>
                      <span className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        Analyzed by Market AI
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={userMission}
                      onChange={(e) => setUserMission(e.target.value)}
                      placeholder="e.g. I run a commercial roofing and waterproofing company looking for new construction projects and facility expansions in North Texas... OR I am an executive looking for VP Operations or COO roles at rapidly growing regional logistics firms..."
                      className="w-full bg-[#090D14] text-slate-200 border border-white/10 rounded-xl p-3 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-600 leading-relaxed resize-none"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Be natural. Our AI will dissect this to find the high-intent keywords that return active opportunities.
                    </p>
                  </div>
                </div>
              )}

              {/* STEP 2: Target Industries & Sectors */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Target className="w-4 h-4 text-cyan-400" />
                      What industries or market sectors do you target?
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Explore presets across major economic sectors, or add your specific niche below.
                    </p>
                  </div>

                  {/* Active Selected Badge Counter */}
                  {selectedIndustries.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-cyan-950/20 border border-cyan-500/20">
                      <div className="flex items-center justify-between text-[11px] text-cyan-300 font-semibold mb-1.5">
                        <span>Selected Sectors ({selectedIndustries.length}):</span>
                        <span className="text-[10px] text-slate-400 font-normal">Click any tag to remove</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {selectedIndustries.map((ind) => (
                          <button
                            key={ind}
                            type="button"
                            onClick={() => toggleItem(selectedIndustries, setSelectedIndustries, ind)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs hover:bg-rose-500/20 hover:border-rose-500/40 hover:text-rose-200 transition-colors group"
                            title="Click to remove"
                          >
                            <span>{ind}</span>
                            <span className="text-[10px] opacity-60 group-hover:opacity-100">×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sector Category Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
                    {INDUSTRY_SECTORS.map((sec) => (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => setActiveSectorTab(sec.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                          activeSectorTab === sec.id
                            ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-glow-brand'
                            : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        <span>{sec.emoji}</span>
                        <span>{sec.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Sector Pills Grid */}
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      {currentSector.emoji} {currentSector.name}
                    </span>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {currentSector.items.map((ind) => {
                        const isSelected = selectedIndustries.includes(ind);
                        return (
                          <button
                            key={ind}
                            type="button"
                            onClick={() => toggleItem(selectedIndustries, setSelectedIndustries, ind)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-glow-brand'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                            <span>{ind}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Sector Write-In Form */}
                  <form onSubmit={handleAddCustomIndustry} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Add custom vertical (e.g. Commercial Roofing, Veterinary, PropTech)..."
                      value={customIndustry}
                      onChange={(e) => setCustomIndustry(e.target.value)}
                      className="flex-1 bg-[#090D14] text-slate-200 border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-cyan-500 placeholder:text-slate-600"
                    />
                    <button
                      type="submit"
                      disabled={!customIndustry.trim()}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </form>
                </div>
              )}

              {/* STEP 3: Buying Catalysts */}
              {step === 3 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400" />
                      What buying catalysts indicate intent for you?
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      We scan business news and announcements for these exact operational events.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[48vh] overflow-y-auto pr-1">
                    {BROAD_TRIGGERS.map((trigger) => {
                      const isSelected = selectedTriggers.includes(trigger.name);
                      return (
                        <div
                          key={trigger.name}
                          onClick={() => toggleItem(selectedTriggers, setSelectedTriggers, trigger.name)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-200'
                              : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-indigo-500 border-indigo-400 text-white'
                                  : 'border-white/20 bg-black/30'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </span>
                            <span className="text-xs font-medium truncate">{trigger.name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 shrink-0 ml-1">
                            {trigger.tag}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 4: Target Roles & AI Query Calibration Preview */}
              {step === 4 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-purple-400" />
                      Which decision-maker titles do you pitch?
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Verified corporate emails and LinkedIn profiles will prioritize these roles.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[30vh] overflow-y-auto pr-1">
                    {BROAD_ROLES.map((role) => {
                      const isSelected = selectedRoles.includes(role.name);
                      return (
                        <div
                          key={role.name}
                          onClick={() => toggleItem(selectedRoles, setSelectedRoles, role.name)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-purple-500/15 border-purple-500/40 text-purple-200'
                              : 'bg-white/[0.02] border-white/10 text-slate-300 hover:bg-white/[0.05]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-purple-500 border-purple-400 text-white'
                                  : 'border-white/20 bg-black/30'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3" />}
                            </span>
                            <span className="text-xs font-medium truncate">{role.name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400 shrink-0 ml-1">
                            {role.category}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Search Strategy & Goldilocks Rule Explainer */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-indigo-950/30 to-purple-950/20 border border-indigo-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-amber-400" />
                        AI Search Calibration (The Goldilocks Rule)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                        3 to 6 words
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Single words are too broad; full sentences return 0 news results. Our AI synthesizes the optimal query:
                    </p>
                    <div className="p-2 rounded-lg bg-black/40 border border-white/10 font-mono text-[11px] text-cyan-300 flex items-center gap-2 overflow-x-auto">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-amber-300 font-semibold">{targetLocation.split(',')[0]}</span>
                      <span className="text-slate-500">+</span>
                      <span className="text-cyan-300 font-semibold">{selectedIndustries[0] || 'Commercial'}</span>
                      <span className="text-slate-500">+</span>
                      <span className="text-indigo-300">"{selectedTriggers[0]?.split(' ')[0] || 'Expansion'}"</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                      <span>Targeting: <strong className="text-slate-200">{targetLocation}</strong></span>
                      <span>Intent: <strong className="text-slate-200">{userIntent.replace(/_/g, ' ')}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Wizard Footer Controls */}
        {!isSubmitting && (
          <div className="p-4 sm:p-5 border-t border-white/10 bg-gradient-to-t from-white/[0.03] to-transparent flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold transition-colors"
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 4 ? (
              <button
                type="button"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => setStep((prev) => (prev + 1) as any)}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-bold shadow-glow-brand transition-all active:scale-95"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white text-xs font-bold tracking-wider uppercase shadow-glow-emerald transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Launch My Deck</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
