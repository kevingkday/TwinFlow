import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  Mail,
  User,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  Compass,
  Radio,
  Share2,
  ChevronRight,
  Package,
  Wrench,
  HelpCircle,
} from 'lucide-react';
import type { UserProfile } from '../types/lead';
import { authFetch } from '../utils/api';
import { playSound } from '../utils/audio';
import { ExecutiveAvatar } from './ExecutiveAvatar';

interface ProfilePageProps {
  user: UserProfile | null;
  onProfileUpdated: (updatedUser: UserProfile) => void;
  onOpenCrmSettings: () => void;
  onOpenMakeNews: () => void;
  onNavigateDeck: () => void;
}

const COMMON_SERVICES_SUGGESTIONS = [
  'Commercial Roofing',
  'HVAC Contracting',
  'Logistics Fleet Operations',
  'Industrial Renovation',
  'Commercial Construction',
  'B2B SaaS Consulting',
  'Cold Storage Infrastructure',
  'Warehouse Automation',
  'Supply Chain Management',
  'Electrical Subcontracting',
];

const COMMON_PRODUCTS_SUGGESTIONS = [
  'TPO Roofing Membranes',
  'Commercial Chillers & Compressors',
  'Warehouse Telematics Units',
  'Industrial Storage Racks',
  'Fleet Management Software',
  'Prefabricated Steel Structures',
  'EV Commercial Chargers',
  'Industrial Safety Gear',
];

const COMMON_ROLES_SUGGESTIONS = [
  'CEO & Founder',
  'VP of Operations',
  'Procurement Director',
  'General Contractor',
  'Director of Facilities',
  'Chief Commercial Officer',
  'Head of Supply Chain',
];

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  onProfileUpdated,
  onOpenCrmSettings,
  onOpenMakeNews,
  onNavigateDeck,
}) => {
  // Form State
  const [name, setName] = useState(user?.name || '');
  const [organization, setOrganization] = useState(user?.organization || '');
  const [companyDescription, setCompanyDescription] = useState(user?.companyDescription || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [targetLocation, setTargetLocation] = useState(user?.targetLocation || 'Dallas-Fort Worth, TX');
  const [userIntent, setUserIntent] = useState(user?.userIntent || 'sales_client_acquisition');
  const [userMission, setUserMission] = useState(user?.userMission || '');
  const [valueProp, setValueProp] = useState(user?.valueProp || '');

  // Offerings Tag State
  const [servicesOffered, setServicesOffered] = useState<string[]>(
    user?.servicesOffered && user.servicesOffered.length > 0
      ? user.servicesOffered
      : ['Commercial Roofing', 'Facility Renovation']
  );
  const [newServiceInput, setNewServiceInput] = useState('');

  const [productsOffered, setProductsOffered] = useState<string[]>(
    user?.productsOffered && user.productsOffered.length > 0
      ? user.productsOffered
      : ['TPO Roofing Membranes', 'Commercial Chillers']
  );
  const [newProductInput, setNewProductInput] = useState('');

  // Target Roles Tag State
  const [targetRoles, setTargetRoles] = useState<string[]>(
    user?.targetRoles && user.targetRoles.length > 0
      ? user.targetRoles
      : ['CEO', 'VP Operations', 'Procurement Director']
  );
  const [newRoleInput, setNewRoleInput] = useState('');

  // Submission & Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [calibratedQuery, setCalibratedQuery] = useState(
    user?.icpQuery || `${targetLocation} commercial expansion groundbreak`
  );

  // Sync state if user changes
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setOrganization(user.organization || '');
      setCompanyDescription(user.companyDescription || '');
      setWebsite(user.website || '');
      setTargetLocation(user.targetLocation || 'Dallas-Fort Worth, TX');
      setUserIntent(user.userIntent || 'sales_client_acquisition');
      setUserMission(user.userMission || '');
      setValueProp(user.valueProp || '');
      if (user.servicesOffered && user.servicesOffered.length > 0) {
        setServicesOffered(user.servicesOffered);
      }
      if (user.productsOffered && user.productsOffered.length > 0) {
        setProductsOffered(user.productsOffered);
      }
      if (user.targetRoles && user.targetRoles.length > 0) {
        setTargetRoles(user.targetRoles);
      }
      if (user.icpQuery) {
        setCalibratedQuery(user.icpQuery);
      }
    }
  }, [user]);

  // Tag Handlers
  const handleAddService = (service: string) => {
    const trimmed = service.trim();
    if (trimmed && !servicesOffered.includes(trimmed)) {
      setServicesOffered((prev) => [...prev, trimmed]);
      setNewServiceInput('');
    }
  };

  const handleRemoveService = (serviceToRemove: string) => {
    setServicesOffered((prev) => prev.filter((s) => s !== serviceToRemove));
  };

  const handleAddProduct = (product: string) => {
    const trimmed = product.trim();
    if (trimmed && !productsOffered.includes(trimmed)) {
      setProductsOffered((prev) => [...prev, trimmed]);
      setNewProductInput('');
    }
  };

  const handleRemoveProduct = (productToRemove: string) => {
    setProductsOffered((prev) => prev.filter((p) => p !== productToRemove));
  };

  const handleAddRole = (role: string) => {
    const trimmed = role.trim();
    if (trimmed && !targetRoles.includes(trimmed)) {
      setTargetRoles((prev) => [...prev, trimmed]);
      setNewRoleInput('');
    }
  };

  const handleRemoveRole = (roleToRemove: string) => {
    setTargetRoles((prev) => prev.filter((r) => r !== roleToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        name,
        organization,
        companyDescription,
        website,
        servicesOffered,
        productsOffered,
        targetLocation,
        userIntent,
        userMission,
        valueProp,
        targetRoles,
      };

      const res = await authFetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        success: boolean;
        user?: UserProfile;
        queryPlan?: { primaryQuery: string; strategicFocus?: string };
        error?: string;
      };

      if (res.ok && data.success && data.user) {
        playSound('success');
        onProfileUpdated(data.user);
        if (data.queryPlan?.primaryQuery) {
          setCalibratedQuery(data.queryPlan.primaryQuery);
        }
        setStatusMessage({
          type: 'success',
          text: `Profile saved successfully! Market radar recalibrated to: "${data.queryPlan?.primaryQuery || calibratedQuery}"`,
        });
      } else {
        playSound('error');
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to update profile.',
        });
      }
    } catch (err) {
      playSound('error');
      setStatusMessage({
        type: 'error',
        text: `Error saving profile: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-65px)] bg-slate-50 text-slate-800 pb-20">
      {/* Top Banner / Breadcrumb */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <ExecutiveAvatar
                  name={name || user?.email || 'Executive'}
                  avatarUrl={user?.avatarUrl}
                  size="lg"
                  className="w-16 h-16 sm:w-20 sm:h-20 text-xl font-bold border-2 border-white shadow-md"
                />
                <span
                  className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                    user?.isGhlConnected ? 'bg-emerald-500' : 'bg-slate-300'
                  }`}
                  title={user?.isGhlConnected ? 'CRM Connected' : 'CRM Not Connected'}
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                    {name || 'Executive Profile'}
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {user?.isAdmin ? 'Agency Admin' : 'Lead Operator'}
                  </span>
                  {user?.isGhlConnected && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      CRM Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {user?.email}
                  </span>
                  {organization && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      {organization}
                    </span>
                  )}
                  {website && (
                    <a
                      href={website.startsWith('http') ? website : `https://${website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {website.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Top Quick Actions */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onOpenMakeNews}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-sm transition-all cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Make News (Push Social)</span>
              </button>
              <button
                type="button"
                onClick={onNavigateDeck}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-blue-600" />
                <span>Open Lead Deck</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        {/* Status Toast */}
        {statusMessage && (
          <div
            className={`mb-6 p-4 rounded-xl border flex items-start gap-3 transition-all ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="text-sm font-medium">{statusMessage.text}</div>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1: AI Search Radar Live Calibration Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/40 to-white border border-blue-200/80 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Radio className="w-4 h-4 text-blue-600 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    Live Market Signal Radar Calibration
                  </span>
                </div>
                <p className="text-xs text-slate-600 max-w-2xl">
                  Your company bio, services, products, and target location automatically synthesize Google News RSS
                  queries. Updates here recalibrate your live intelligence deck in real time.
                </p>
              </div>
              <div className="flex items-center gap-2 self-start md:self-center">
                <span className="text-[11px] font-semibold text-slate-500">Active Query:</span>
                <span className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                  "{calibratedQuery}"
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Identity, Offerings, and Company Bio */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Identity & Organization */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <User className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">Operator Identity & Company</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Full Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Kevin Day"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Email Address</label>
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-500 cursor-not-allowed"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Company / Organization</label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. TwinFlow Commercial Solutions"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Company Website</label>
                    <input
                      type="text"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="e.g. https://twinflow.co"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Company Description & Strategic Bio</span>
                    <span className="text-[11px] font-normal text-slate-400">Used by AI to craft outbound pitches</span>
                  </label>
                  <textarea
                    rows={3}
                    value={companyDescription}
                    onChange={(e) => setCompanyDescription(e.target.value)}
                    placeholder="Describe your company, core focus, specialty sectors, and regional reach. Example: 'We are a premier commercial roofing and building envelope subcontractor specializing in high-performance TPO membranes for expanding logistics and manufacturing facilities across Texas.'"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Unique Value Proposition</label>
                  <input
                    type="text"
                    value={valueProp}
                    onChange={(e) => setValueProp(e.target.value)}
                    placeholder="e.g. Guaranteed 48-hour bid turnaround with zero subcontracting markups and certified 20-year NDL warranties."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
              </div>

              {/* Card 2: Services Offered (Tag Manager) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-indigo-600" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Services Offered</h2>
                      <p className="text-[11px] text-slate-500">
                        Capabilities you sell. AI matches these against breaking company needs.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500">{servicesOffered.length} services</span>
                </div>

                {/* Tag Container */}
                <div className="flex flex-wrap gap-2 min-h-[44px] p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  {servicesOffered.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No services listed yet. Add one below.</span>
                  ) : (
                    servicesOffered.map((svc) => (
                      <span
                        key={svc}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-semibold text-indigo-900 shadow-2xs group"
                      >
                        <span>{svc}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveService(svc)}
                          className="text-indigo-400 hover:text-indigo-700 transition-colors cursor-pointer"
                          title={`Remove ${svc}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add Service Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newServiceInput}
                    onChange={(e) => setNewServiceInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddService(newServiceInput);
                      }
                    }}
                    placeholder="Type a service and press Enter (e.g. Commercial Roofing)"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddService(newServiceInput)}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Quick Add Suggestions */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Quick Suggestions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_SERVICES_SUGGESTIONS.filter((s) => !servicesOffered.includes(s)).slice(0, 6).map((suggested) => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => handleAddService(suggested)}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-slate-400" />
                        <span>{suggested}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card 3: Products Offered (Tag Manager) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-emerald-600" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Products Offered</h2>
                      <p className="text-[11px] text-slate-500">
                        Tangible goods, equipment, or materials you supply to commercial buyers.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-slate-500">{productsOffered.length} products</span>
                </div>

                {/* Tag Container */}
                <div className="flex flex-wrap gap-2 min-h-[44px] p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  {productsOffered.length === 0 ? (
                    <span className="text-xs text-slate-400 italic">No products listed yet. Add one below.</span>
                  ) : (
                    productsOffered.map((prod) => (
                      <span
                        key={prod}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900 shadow-2xs group"
                      >
                        <span>{prod}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveProduct(prod)}
                          className="text-emerald-400 hover:text-emerald-700 transition-colors cursor-pointer"
                          title={`Remove ${prod}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Add Product Input */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newProductInput}
                    onChange={(e) => setNewProductInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddProduct(newProductInput);
                      }
                    }}
                    placeholder="Type a product line and press Enter (e.g. TPO Roofing Membranes)"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddProduct(newProductInput)}
                    className="flex items-center gap-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Quick Add Suggestions */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                    Quick Suggestions
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_PRODUCTS_SUGGESTIONS.filter((p) => !productsOffered.includes(p)).slice(0, 6).map((suggested) => (
                      <button
                        key={suggested}
                        type="button"
                        onClick={() => handleAddProduct(suggested)}
                        className="text-[11px] px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-600 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50/50 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3 text-slate-400" />
                        <span>{suggested}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Market Geometry, Targeting & CRM Hub */}
            <div className="space-y-6">
              {/* Card 4: Targeting Radar Calibration */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                  <Compass className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">Targeting Radar Geometry</h2>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Target Geography / Region</label>
                    <input
                      type="text"
                      value={targetLocation}
                      onChange={(e) => setTargetLocation(e.target.value)}
                      placeholder="e.g. Dallas-Fort Worth, TX or Pacific Northwest"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Primary Commercial Intent</label>
                    <select
                      value={userIntent}
                      onChange={(e) => setUserIntent(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    >
                      <option value="sales_client_acquisition">Client Acquisition & Contract Bidding</option>
                      <option value="subcontractor_partners">Subcontractor & Vendor Partnerships</option>
                      <option value="investing">Strategic Capital & Real Estate Deals</option>
                      <option value="job_seeking">Executive Role & Board Opportunities</option>
                      <option value="general">General Commercial Intelligence</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Mission Statement / Focus</label>
                    <input
                      type="text"
                      value={userMission}
                      onChange={(e) => setUserMission(e.target.value)}
                      placeholder="e.g. Expand our subcontracting footprint for commercial logistics developments"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Target Decision-Maker Roles */}
                  <div className="space-y-2 pt-1">
                    <label className="text-xs font-semibold text-slate-700">Target Decision-Maker Titles</label>
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200">
                      {targetRoles.map((role) => (
                        <span
                          key={role}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white border border-slate-200 text-[11px] font-semibold text-slate-700"
                        >
                          <span>{role}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRole(role)}
                            className="text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={newRoleInput}
                        onChange={(e) => setNewRoleInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddRole(newRoleInput);
                          }
                        }}
                        placeholder="Add title (e.g. VP Operations)"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddRole(newRoleInput)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 cursor-pointer"
                      >
                        Add
                      </button>
                    </div>

                    {/* Quick Add Role Suggestions */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {COMMON_ROLES_SUGGESTIONS.filter((r) => !targetRoles.includes(r)).slice(0, 4).map((role) => (
                        <button
                          key={role}
                          type="button"
                          onClick={() => handleAddRole(role)}
                          className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all cursor-pointer flex items-center gap-1"
                        >
                          <Plus className="w-2.5 h-2.5 text-slate-400" />
                          <span>{role}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card 5: CRM Integration & Social Broadcasting Hub */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-bold text-slate-900">CRM & Social Publishing</h2>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                      user?.isGhlConnected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        user?.isGhlConnected ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                    {user?.isGhlConnected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>

                <div className="space-y-3 text-xs text-slate-600">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Sub-Account Location:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {user?.ghlSubaccountId || 'Not Configured'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Private Integration Token:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {user?.hasCustomGhlKey ? 'Active (pit-••••••••)' : 'Agency Default'}
                      </span>
                    </div>
                  </div>

                  {/* Clarification on Social API Authorization */}
                  <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/70 space-y-2">
                    <div className="flex items-center gap-1.5 text-blue-900 font-semibold text-xs">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span>Social Media Channel Authorization</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-blue-800/90">
                      <strong>Yes, social media channels are authorized via API.</strong> Your CRM provides dedicated
                      OAuth endpoints for LinkedIn, Twitter/X, Facebook, Instagram, and Google Business Profile.
                      Channels connected in your CRM workspace are immediately accessible to broadcast company news
                      directly from TwinFlow.
                    </p>
                  </div>

                  <div className="pt-1 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={onOpenMakeNews}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>Make News & Push to Social Channels</span>
                    </button>
                    <button
                      type="button"
                      onClick={onOpenCrmSettings}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
                    >
                      <span>Configure CRM Tokens & Scopes</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-500 hidden sm:flex">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Saving will recalibrate your AI news query to match your updated services and geography.</span>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onNavigateDeck}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                  isSaving ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                }`}
              >
                {isSaving ? (
                  <>
                    <Radio className="w-4 h-4 animate-spin" />
                    <span>Recalibrating Radar...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Profile & Recalibrate Radar</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
