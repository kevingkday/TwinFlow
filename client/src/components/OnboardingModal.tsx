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
import type { Campaign } from '../types/campaign';
import { playSound } from '../utils/audio';
import { deriveBuyerProfile } from '../utils/buyerProfile';

function ensureArray(val: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return fallback;
}

interface OnboardingModalProps {
  isOpen: boolean;
  user: UserProfile | null;
  campaign?: Campaign | null;
  mode?: 'create' | 'edit';
  onComplete: (updatedUser: UserProfile, campaign?: Campaign) => void;
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
  user,
  campaign,
  mode = 'create',
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [campaignName, setCampaignName] = useState(campaign?.name || '');
  const [targetLocation, setTargetLocation] = useState(campaign?.targetLocation || user?.targetLocation || 'Vancouver, BC');
  const [userIntent, setUserIntent] = useState(campaign?.userIntent || user?.userIntent || 'sales_client_acquisition');
  const [userMission, setUserMission] = useState(
    campaign?.userMission || user?.userMission || ''
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
  const suggestedBuyers = deriveBuyerProfile({ userMission, userIntent, targetIndustries: selectedIndustries });
  const [buyerIndustriesText, setBuyerIndustriesText] = useState(suggestedBuyers.buyerIndustries.join(', '));
  const [buyerRolesText, setBuyerRolesText] = useState(suggestedBuyers.buyerRoles.join(', '));
  const [buyerCompanySize, setBuyerCompanySize] = useState<'smb' | 'midmarket' | 'enterprise' | 'any'>(suggestedBuyers.buyerCompanySize);
  const [serviceArea, setServiceArea] = useState<'local' | 'national'>(suggestedBuyers.serviceArea);

  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
    }
    if (campaign) {
      setCampaignName(campaign.name || '');
      if (campaign.targetLocation) setTargetLocation(campaign.targetLocation);
      if (campaign.userIntent) setUserIntent(campaign.userIntent);
      if (campaign.userMission) setUserMission(campaign.userMission);
      if (campaign.targetIndustries) {
        const arr = ensureArray(campaign.targetIndustries);
        if (arr.length > 0) setSelectedIndustries(arr);
      }
      if (campaign.targetTriggers) {
        const arr = ensureArray(campaign.targetTriggers);
        if (arr.length > 0) setSelectedTriggers(arr);
      }
      if (campaign.targetRoles) {
        const arr = ensureArray(campaign.targetRoles);
        if (arr.length > 0) setSelectedRoles(arr);
      }
      if (campaign.buyerIndustries?.length) setBuyerIndustriesText(ensureArray(campaign.buyerIndustries).join(', '));
      if (campaign.buyerRoles?.length) setBuyerRolesText(ensureArray(campaign.buyerRoles).join(', '));
      if (campaign.buyerCompanySize) setBuyerCompanySize(campaign.buyerCompanySize);
      if (campaign.serviceArea) setServiceArea(campaign.serviceArea);
    } else if (user) {
      setCampaignName('');
      if (user.targetLocation) setTargetLocation(user.targetLocation);
      if (user.userIntent) setUserIntent(user.userIntent);
      setUserMission(user.userMission || '');
      if (user.targetIndustries) {
        const arr = ensureArray(user.targetIndustries);
        if (arr.length > 0) setSelectedIndustries(arr);
      }
    }
  }, [campaign, user, isOpen]);

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

    const token = typeof window !== 'undefined' ? localStorage.getItem('twinflow_session_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const finalCampaignName = campaignName.trim() || `${targetLocation.split(',')[0] || 'Regional'} Market Growth`;

    try {
      let res: Response;
      if (mode === 'edit' && campaign?.id) {
        res = await fetch(`/api/campaigns/${campaign.id}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({
            name: finalCampaignName,
            targetLocation,
            userIntent,
            userMission,
            targetIndustries: selectedIndustries,
            targetTriggers: selectedTriggers,
            targetRoles: selectedRoles,
            valueProp: userMission,
            buyerIndustries: buyerIndustriesText.split(',').map((item) => item.trim()).filter(Boolean),
            buyerRoles: buyerRolesText.split(',').map((item) => item.trim()).filter(Boolean),
            buyerCompanySize,
            serviceArea,
          }),
        });
      } else {
        res = await fetch('/api/campaigns', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: finalCampaignName,
            targetLocation,
            userIntent,
            userMission,
            targetIndustries: selectedIndustries,
            targetTriggers: selectedTriggers,
            targetRoles: selectedRoles,
            valueProp: userMission,
            buyerIndustries: buyerIndustriesText.split(',').map((item) => item.trim()).filter(Boolean),
            buyerRoles: buyerRolesText.split(',').map((item) => item.trim()).filter(Boolean),
            buyerCompanySize,
            serviceArea,
            makeActive: true,
          }),
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        setProgressStatus('Calibrated query & seeded campaign signals...');
        playSound('streak');
        setTimeout(() => {
          onComplete(data.user || user, data.campaign);
        }, 1000);
      } else {
        setIsSubmitting(false);
        alert(data.error || 'Failed to save campaign. Please try again.');
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-slate-800">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs flex-shrink-0">
              <Compass className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 font-display">
                  {mode === 'edit'
                    ? (campaign?.name ? `Edit: ${campaign.name}` : 'Edit Campaign')
                    : (!user?.onboardingCompleted ? 'Welcome to TwinFlow: Campaign Setup' : 'New Market Campaign Setup')}
                </h2>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  Step {step} of 4
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {mode === 'edit'
                  ? 'Update your market signals and targeting criteria'
                  : 'Complete these quick steps to calibrate your targeting and launch your live lead deck'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 h-1.5">
          <div
            className="bg-blue-600 h-1.5 transition-all duration-300"
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </div>

        {/* Wizard Content Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {isSubmitting ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center shadow-xs">
                  <Radio className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
                <Sparkles className="w-5 h-5 text-amber-500 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 font-display mb-1">
                  Synthesizing Market Intelligence with AI
                </h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  {progressStatus || 'Generating optimal 3-6 word targeted query and matching local decision-makers...'}
                </p>
              </div>
              <div className="space-y-2 pt-3 text-left w-full max-w-xs text-xs text-slate-600">
                <div className="flex items-center gap-2 text-emerald-700">
                  <Check className="w-4 h-4" />
                  <span>CRM Sub-Account Provisioned</span>
                </div>
                <div className="flex items-center gap-2 text-blue-700">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span>AI Search Calibration active</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
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
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      What opportunity are you hunting for?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tell us what you sell or seek so our AI can formulate the perfect targeted news search.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Campaign Name
                    </label>
                    <input
                      type="text"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      placeholder="e.g. Pacific Northwest Commercial Expansion"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs transition-colors"
                    />
                  </div>

                  {/* Intent Selection Cards */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Your Primary Goal
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {INTENT_OPTIONS.map((opt) => (
                        <div
                          key={opt.id}
                          onClick={() => setUserIntent(opt.id)}
                          className={`p-3 rounded-xl border cursor-pointer transition-all ${
                            userIntent === opt.id
                              ? 'bg-blue-50/70 border-blue-600 text-blue-900 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-semibold text-xs mb-0.5">
                            <span>{opt.emoji}</span>
                            <span className="text-slate-900">{opt.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-tight">
                            {opt.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Location Intake */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
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
                        className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 shadow-xs"
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
                          className={`text-[10px] px-2.5 py-0.5 rounded-md border transition-colors ${
                            targetLocation === loc
                              ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                              : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
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
                      <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Describe What You Offer or What You Seek *
                      </label>
                      <span className="text-[10px] font-mono text-blue-600 flex items-center gap-1 font-semibold">
                        <Sparkles className="w-3 h-3 text-blue-600" />
                        Analyzed by Market AI
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      value={userMission}
                      onChange={(e) => setUserMission(e.target.value)}
                      placeholder="e.g. I run a commercial roofing and waterproofing company looking for new construction projects and facility expansions in North Texas... OR I am an executive looking for VP Operations or COO roles at rapidly growing regional logistics firms..."
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl p-3 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 leading-relaxed resize-none shadow-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Be natural. Our AI will dissect this to find the high-intent keywords that return active opportunities.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Where you can sell
                    </label>
                    <select
                      value={serviceArea}
                      onChange={(e) => setServiceArea(e.target.value === 'national' ? 'national' : 'local')}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl p-2.5 text-xs"
                    >
                      <option value="local">Licensed locally — city, then state or province only</option>
                      <option value="national">Anywhere — software, SaaS, and agencies</option>
                    </select>
                    <p className="text-[10px] text-slate-500">
                      Suggested buyers: {suggestedBuyers.buyerIndustries.join(', ')}. Edit if that is wrong.
                    </p>
                    <input
                      value={buyerIndustriesText}
                      onChange={(e) => setBuyerIndustriesText(e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl p-2.5 text-xs"
                      placeholder="Buyer industries, comma separated"
                    />
                    <input
                      value={buyerRolesText}
                      onChange={(e) => setBuyerRolesText(e.target.value)}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl p-2.5 text-xs"
                      placeholder="Buyer roles, comma separated"
                    />
                    <select
                      value={buyerCompanySize}
                      onChange={(e) => setBuyerCompanySize(e.target.value as 'smb' | 'midmarket' | 'enterprise' | 'any')}
                      className="w-full bg-white text-slate-900 border border-slate-300 rounded-xl p-2.5 text-xs"
                    >
                      <option value="smb">Buyer size: small business</option>
                      <option value="midmarket">Buyer size: mid-market</option>
                      <option value="enterprise">Buyer size: enterprise</option>
                      <option value="any">Buyer size: any</option>
                    </select>
                  </div>
                </div>
              )}

              {/* STEP 2: Target Industries & Sectors */}
              {step === 2 && (
                <div className="space-y-4 animate-fade-in">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-600" />
                      What industries or market sectors do you target?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Explore presets across major economic sectors, or add your specific niche below.
                    </p>
                  </div>

                  {/* Active Selected Badge Counter */}
                  {selectedIndustries.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                      <div className="flex items-center justify-between text-[11px] text-blue-800 font-semibold mb-1.5">
                        <span>Selected Sectors ({selectedIndustries.length}):</span>
                        <span className="text-[10px] text-slate-500 font-normal">Click any tag to remove</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {selectedIndustries.map((ind) => (
                          <button
                            key={ind}
                            type="button"
                            onClick={() => toggleItem(selectedIndustries, setSelectedIndustries, ind)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs hover:bg-rose-600 transition-colors group shadow-xs"
                            title="Click to remove"
                          >
                            <span>{ind}</span>
                            <span className="text-[10px] opacity-75 group-hover:opacity-100">×</span>
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
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                        }`}
                      >
                        <span>{sec.emoji}</span>
                        <span>{sec.name}</span>
                      </button>
                    ))}
                  </div>

                  {/* Sector Pills Grid */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
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
                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
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
                      className="flex-1 bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 placeholder:text-slate-400 shadow-xs"
                    />
                    <button
                      type="submit"
                      disabled={!customIndustry.trim()}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 transition-colors shadow-xs"
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
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-600" />
                      What buying catalysts indicate intent for you?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
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
                              ? 'bg-blue-50/70 border-blue-600 text-blue-900 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <span className="text-xs font-medium truncate text-slate-900">{trigger.name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 ml-1">
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
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-blue-600" />
                      Which decision-maker titles do you pitch?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
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
                              ? 'bg-blue-50/70 border-blue-600 text-blue-900 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </span>
                            <span className="text-xs font-medium truncate text-slate-900">{role.name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 ml-1">
                            {role.category}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Search Strategy & Goldilocks Rule Explainer */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5 text-blue-600" />
                        AI Search Calibration (The Goldilocks Rule)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-mono font-medium">
                        3 to 6 words
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Single words are too broad; full sentences return 0 news results. Our AI synthesizes the optimal query:
                    </p>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-800 flex items-center gap-2 overflow-x-auto shadow-2xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-blue-700 font-semibold">{targetLocation.split(',')[0]}</span>
                      <span className="text-slate-400">+</span>
                      <span className="text-slate-900 font-semibold">{selectedIndustries[0] || 'Commercial'}</span>
                      <span className="text-slate-400">+</span>
                      <span className="text-slate-700">"{selectedTriggers[0]?.split(' ')[0] || 'Expansion'}"</span>
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                      <span>Targeting: <strong className="text-slate-800">{targetLocation}</strong></span>
                      <span>Intent: <strong className="text-slate-800">{userIntent.replace(/_/g, ' ')}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Wizard Footer Controls */}
        {!isSubmitting && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onClick={() => setStep((prev) => (prev - 1) as any)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
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
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
              >
                <span>Continue</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold tracking-wide shadow-xs transition-all active:scale-95"
              >
                <Sparkles className="w-4 h-4 text-blue-200" />
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
