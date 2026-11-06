import React, { useState, useEffect } from 'react';
import {
  Building2,
  Globe,
  Mail,
  User,
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
  Phone,
  MapPin,
  RefreshCw,
  Check,
} from 'lucide-react';
import type { UserProfile } from '../types/lead';
import { authFetch } from '../utils/api';
import { playSound } from '../utils/audio';
import { ExecutiveAvatar } from './ExecutiveAvatar';

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
  const [legalBusinessName, setLegalBusinessName] = useState(user?.legalBusinessName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [streetAddress, setStreetAddress] = useState(user?.streetAddress || '');
  const [city, setCity] = useState(user?.city || '');
  const [state, setState] = useState(user?.state || '');
  const [postalCode, setPostalCode] = useState(user?.postalCode || '');
  const [country, setCountry] = useState(user?.country || 'Canada');
  const [timezone, setTimezone] = useState(user?.timezone || 'America/Vancouver');
  const [companyDescription, setCompanyDescription] = useState(user?.companyDescription || '');
  const [website, setWebsite] = useState(user?.website || '');
  const [targetLocation, setTargetLocation] = useState(user?.targetLocation || 'Dallas-Fort Worth, TX');
  const [userIntent, setUserIntent] = useState(user?.userIntent || 'sales_client_acquisition');
  const [userMission, setUserMission] = useState(user?.userMission || '');
  const [valueProp, setValueProp] = useState(user?.valueProp || '');

  // CRM Sync State
  const [syncToCrm, setSyncToCrm] = useState(true);
  const [isSyncingCrm, setIsSyncingCrm] = useState(false);
  const [crmSyncMessage, setCrmSyncMessage] = useState<string | null>(null);

  // Offerings Tag State
  const [servicesOffered, setServicesOffered] = useState<string[]>(() =>
    ensureArray(user?.servicesOffered, ['Commercial Roofing', 'Facility Renovation'])
  );
  const [newServiceInput, setNewServiceInput] = useState('');

  const [productsOffered, setProductsOffered] = useState<string[]>(() =>
    ensureArray(user?.productsOffered, ['TPO Roofing Membranes', 'Commercial Chillers'])
  );
  const [newProductInput, setNewProductInput] = useState('');

  // Target Roles Tag State
  const [targetRoles, setTargetRoles] = useState<string[]>(() =>
    ensureArray(user?.targetRoles, ['CEO', 'VP Operations', 'Procurement Director'])
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
      setLegalBusinessName(user.legalBusinessName || '');
      setPhone(user.phone || '');
      setStreetAddress(user.streetAddress || '');
      setCity(user.city || '');
      setState(user.state || '');
      setPostalCode(user.postalCode || '');
      setCountry(user.country || 'Canada');
      setTimezone(user.timezone || 'America/Vancouver');
      setCompanyDescription(user.companyDescription || '');
      setWebsite(user.website || '');
      setTargetLocation(user.targetLocation || '');
      setUserIntent(user.userIntent || 'sales_client_acquisition');
      setUserMission(user.userMission || '');
      setValueProp(user.valueProp || '');
      setServicesOffered(ensureArray(user.servicesOffered, []));
      setProductsOffered(ensureArray(user.productsOffered, []));
      setTargetRoles(ensureArray(user.targetRoles, ['CEO', 'Owner', 'Managing Partner']));
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

  // Direct CRM Sync Handler
  const handleSyncCrmDirectly = async () => {
    if (!user?.isGhlConnected) {
      onOpenCrmSettings();
      return;
    }
    setIsSyncingCrm(true);
    setCrmSyncMessage(null);
    try {
      const res = await authFetch('/api/user/sync-crm', {
        method: 'POST',
      });
      const data = (await res.json()) as {
        success: boolean;
        result?: {
          message: string;
          customValuesCount: number;
          tagsCount: number;
          locationUpdated: boolean;
          locationError?: string;
        };
        error?: string;
      };
      if (res.ok && data.success && data.result) {
        playSound('success');
        setCrmSyncMessage(data.result.message);
      } else {
        playSound('error');
        setCrmSyncMessage(data.error || 'Failed to sync with CRM.');
      }
    } catch (err) {
      playSound('error');
      setCrmSyncMessage(`Sync error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsSyncingCrm(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload = {
        name,
        organization,
        legalBusinessName,
        phone,
        streetAddress,
        city,
        state,
        postalCode,
        country,
        timezone,
        companyDescription,
        website,
        servicesOffered,
        productsOffered,
        targetLocation,
        userIntent,
        userMission,
        valueProp,
        targetRoles,
        syncToCrm,
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
        crmSyncResult?: { message: string };
        error?: string;
      };

      if (res.ok && data.success && data.user) {
        playSound('success');
        onProfileUpdated(data.user);
        if (data.queryPlan?.primaryQuery) {
          setCalibratedQuery(data.queryPlan.primaryQuery);
        }
        const syncMsg = data.crmSyncResult?.message ? ` • ${data.crmSyncResult.message}` : '';
        const rawQuery = data.queryPlan?.primaryQuery || calibratedQuery;
        const cleanQuery = rawQuery.split(/\s+/).filter((t: string) => !t.startsWith('-')).join(' ');
        setStatusMessage({
          type: 'success',
          text: `Profile saved successfully! Market radar recalibrated to: "${cleanQuery || rawQuery}"${syncMsg}`,
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
              {(() => {
                const tokens = (calibratedQuery || '').split(/\s+/).filter(Boolean);
                const searchKeywords = tokens.filter((t) => !t.startsWith('-')).join(' ');
                const negativeExclusions = tokens.filter((t) => t.startsWith('-')).join(' ');

                return (
                  <div className="flex flex-col gap-1.5 self-start md:self-end text-left md:text-right">
                    <div className="flex items-center gap-2 md:justify-end">
                      <span className="text-[11px] font-semibold text-slate-500">Target Keywords:</span>
                      <span className="font-mono text-xs px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 font-bold shadow-xs">
                        "{searchKeywords || calibratedQuery}"
                      </span>
                    </div>
                    {negativeExclusions && (
                      <div className="flex items-center gap-1.5 md:justify-end text-[10px] text-slate-500">
                        <span className="text-slate-400">Excluding sports & noise:</span>
                        <span
                          className="font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 text-[10px]"
                          title="Negative keywords (-token) tell Google News to exclude sports trades, rosters, and non-commercial articles"
                        >
                          {negativeExclusions}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
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
                    <label className="text-xs font-semibold text-slate-700">Legal Business Name (EIN / Registered)</label>
                    <input
                      type="text"
                      value={legalBusinessName}
                      onChange={(e) => setLegalBusinessName(e.target.value)}
                      placeholder="e.g. TwinFlow Solutions Inc."
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

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>Business Phone</span>
                    </label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. +1 (604) 555-0192"
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

              {/* Card 2: Business Physical Address (CRM Sync) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Business Physical Address</h2>
                      <p className="text-[11px] text-slate-500">
                        Synchronizes directly into your CRM Business Profile settings.
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400">CRM Field</span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Street Address</label>
                    <input
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="e.g. 1055 West Georgia Street, Suite 2100"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">City</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Vancouver"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">State / Prov / Region</label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="e.g. BC or TX"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Postal / Zip Code</label>
                      <input
                        type="text"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="e.g. V6E 3P3"
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Country</label>
                      <select
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="Canada">Canada (CA)</option>
                        <option value="United States">United States (US)</option>
                        <option value="United Kingdom">United Kingdom (UK)</option>
                        <option value="Australia">Australia (AU)</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Time Zone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        <option value="America/Vancouver">(GMT-07:00) America/Vancouver (Pacific)</option>
                        <option value="America/Edmonton">(GMT-06:00) America/Edmonton (Mountain)</option>
                        <option value="America/Chicago">(GMT-05:00) America/Chicago (Central)</option>
                        <option value="America/Toronto">(GMT-04:00) America/Toronto (Eastern)</option>
                        <option value="America/New_York">(GMT-04:00) America/New_York (Eastern)</option>
                        <option value="America/Denver">(GMT-06:00) America/Denver (Mountain)</option>
                        <option value="America/Los_Angeles">(GMT-07:00) America/Los_Angeles (Pacific)</option>
                      </select>
                    </div>
                  </div>
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
                      <span className="text-slate-500">Connection Method:</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {user?.ghlAuthMethod === 'oauth'
                          ? 'OAuth 2.0 (Active)'
                          : user?.hasCustomGhlKey
                          ? 'Private Token (Active)'
                          : user?.isGhlConnected
                          ? 'Connected'
                          : 'Not Connected'}
                      </span>
                    </div>
                  </div>

                  {/* Two-Way CRM Synchronization Hub */}
                  <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/90 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs">
                        <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isSyncingCrm ? 'animate-spin' : ''}`} />
                        <span>CRM Two-Way Synchronization</span>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full border border-emerald-200">
                        API Active
                      </span>
                    </div>

                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Syncs Friendly Name, Legal Business Name, Website, Phone, Physical Address, Offerings, and 7 Global Custom Values directly into your CRM workspace.
                    </p>

                    {crmSyncMessage && (
                      <div className="p-2.5 rounded-lg bg-white border border-blue-200 text-[11px] font-medium text-slate-800 space-y-1">
                        <div className="flex items-center gap-1.5 text-blue-700 font-semibold">
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Sync Status</span>
                        </div>
                        <div className="text-slate-600 leading-relaxed">{crmSyncMessage}</div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleSyncCrmDirectly}
                      disabled={isSyncingCrm || !user?.isGhlConnected}
                      className={`w-full flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer ${
                        isSyncingCrm
                          ? 'bg-blue-400 text-white cursor-wait'
                          : user?.isGhlConnected
                          ? 'bg-blue-600 hover:bg-blue-700 text-white active:scale-98'
                          : 'bg-slate-200 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCrm ? 'animate-spin' : ''}`} />
                      <span>{isSyncingCrm ? 'Syncing with CRM...' : 'Sync to CRM Business Profile & Custom Values'}</span>
                    </button>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      * Synced attributes are stored in your CRM under <strong>Settings → Custom Values</strong>. To update the core Business Profile page (/settings/company) directly, your token must be generated at the <strong>Agency level</strong> with <code className="text-blue-600 font-mono">locations.write</code>.
                    </p>
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
                      <span>Configure HighLevel Integration</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Bottom Actions Bar */}
          <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-600">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncToCrm}
                  onChange={(e) => setSyncToCrm(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span className="font-semibold text-slate-800">Auto-sync with CRM on Save</span>
              </label>
              <span className="text-slate-400 hidden md:inline">• Recalibrates AI search radar & syncs Custom Values</span>
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
