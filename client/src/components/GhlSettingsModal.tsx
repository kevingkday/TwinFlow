import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Copy,
  KeyRound,
  Building2,
  ShieldCheck,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { UserProfile, GhlSubaccountOption } from '../types/lead';
import { authFetch } from '../utils/api';

interface GhlSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userProfile: UserProfile | null;
  onProfileUpdated: (updated: UserProfile) => void;
}

export const GhlSettingsModal: React.FC<GhlSettingsModalProps> = ({
  isOpen,
  onClose,
  userProfile,
  onProfileUpdated,
}) => {
  const [subaccountId, setSubaccountId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [agencySubaccounts, setAgencySubaccounts] = useState<GhlSubaccountOption[]>([]);
  const [isLoadingSubaccounts, setIsLoadingSubaccounts] = useState(false);
  const [copiedScope, setCopiedScope] = useState(false);

  // Sync state when modal opens or profile changes
  useEffect(() => {
    if (isOpen && userProfile) {
      setSubaccountId(userProfile.ghlSubaccountId || '');
      setApiKey('');
      setStatusMessage(null);
      fetchAgencySubaccounts();
    }
  }, [isOpen, userProfile]);

  const fetchAgencySubaccounts = async () => {
    setIsLoadingSubaccounts(true);
    try {
      const res = await authFetch('/api/signals/ghl/subaccounts');
      if (res.ok) {
        const data = (await res.json()) as { success: boolean; subaccounts?: GhlSubaccountOption[] };
        if (data.success && data.subaccounts) {
          setAgencySubaccounts(data.subaccounts);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingSubaccounts(false);
    }
  };

  if (!isOpen) return null;

  const handleCopyScopes = () => {
    navigator.clipboard.writeText(
      'contacts.readonly contacts.write opportunities.readonly opportunities.write locations.readonly locations.write custom-values.readonly custom-values.write tags.readonly tags.write'
    );
    setCopiedScope(true);
    setTimeout(() => setCopiedScope(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const payload: { ghlSubaccountId: string; ghlApiKey?: string } = {
        ghlSubaccountId: subaccountId.trim(),
      };
      if (apiKey.trim()) {
        payload.ghlApiKey = apiKey.trim();
      }

      const res = await authFetch('/api/user/ghl-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as {
        success: boolean;
        user: UserProfile;
        verification?: { valid: boolean; mock: boolean; message: string };
        message?: string;
        error?: string;
      };

      if (res.ok && data.success) {
        onProfileUpdated(data.user);
        setStatusMessage({
          type: data.verification?.valid ? 'success' : 'info',
          text: data.message || 'CRM credentials saved successfully!',
        });
        if (apiKey) setApiKey('');
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || data.message || 'Failed to update CRM settings.',
        });
      }
    } catch (err: unknown) {
      setStatusMessage({
        type: 'error',
        text: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const isConnected = userProfile?.isGhlConnected;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-2xl text-slate-800"
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

        {/* Header */}
        <div className="flex items-center gap-3.5 mb-5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shadow-xs">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-display text-slate-900">CRM Integration Setup</h2>
            <p className="text-xs text-slate-500">Connect your private integration token to auto-push approved leads and email drafts</p>
          </div>
        </div>

        {/* Connection Status Pill */}
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border mb-5 ${
            isConnected
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-amber-50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            )}
            <div>
              <p className="text-xs font-semibold">
                {isConnected ? 'CRM Workspace Connected' : 'CRM Private Key Required to Push Leads'}
              </p>
              <p className="text-[11px] text-slate-600">
                {isConnected
                  ? `Active Workspace: ${userProfile?.ghlSubaccountId || 'Default'} ${
                      userProfile?.ghlApiKeyMasked ? `• Key: ${userProfile.ghlApiKeyMasked}` : ''
                    }`
                  : 'Add your Sub-Account Private Integration Token below to enable pushing contacts.'}
              </p>
            </div>
          </div>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isConnected
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            {isConnected ? 'CONNECTED' : 'ACTION REQUIRED'}
          </span>
        </div>

        {/* Setup Instructions Box */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                How to get your Sub-Account Token
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyScopes}
              className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
              title="Copy required permission scopes"
            >
              {copiedScope ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedScope ? 'Scopes Copied!' : 'Copy Scopes'}</span>
            </button>
          </div>
          <ol className="text-xs text-slate-600 space-y-1.5 list-decimal list-inside leading-relaxed">
            <li>
              Log into your CRM and navigate to your assigned sub-account / workspace.
            </li>
            <li>
              Go to <span className="font-semibold text-slate-900">Settings</span> →{' '}
              <span className="font-semibold text-slate-900">Developers</span> (or <span className="font-semibold text-slate-900">Private Integrations</span>).
            </li>
            <li>
              Click <span className="text-blue-600 font-semibold">Create Private Integration Token</span> (e.g. "TwinFlow Sync").
            </li>
            <li>
              Grant scopes: <code className="text-slate-800 font-mono text-[11px] bg-slate-200 px-1 py-0.5 rounded">contacts (read/write)</code>,{' '}
              <code className="text-slate-800 font-mono text-[11px] bg-slate-200 px-1 py-0.5 rounded">opportunities (read/write)</code>, and{' '}
              <code className="text-slate-800 font-mono text-[11px] bg-slate-200 px-1 py-0.5 rounded">custom-values (read/write)</code>.
              <span className="block mt-1 text-[11px] text-slate-500">
                <strong>Tip for Business Profile Settings:</strong> To allow TwinFlow to update the core Business Profile page (/settings/company) directly via API, generate your token at the <strong>Agency level</strong> (Agency Settings → Private Integrations) with <code className="text-blue-700 font-mono">locations.write</code> enabled.
              </span>
            </li>
            <li>Copy your Sub-Account Location ID and the generated token (<code className="text-blue-600 font-mono">pit-...</code>) and paste them below.</li>
          </ol>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* Subaccount Location ID */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="ghl-location-id" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Sub-Account Location ID</span>
              </label>
              {isLoadingSubaccounts ? (
                <span className="text-[11px] text-slate-500 animate-pulse">Loading agency accounts...</span>
              ) : agencySubaccounts.length > 0 ? (
                <span className="text-[11px] text-slate-500">Quick-pick from your Agency:</span>
              ) : null}
            </div>

            {/* Quick Pick buttons from user's live agency subaccounts */}
            {agencySubaccounts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {agencySubaccounts.slice(0, 5).map((loc) => (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => setSubaccountId(loc.id)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                      subaccountId === loc.id
                        ? 'bg-blue-600 text-white border-blue-600 font-semibold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                    }`}
                  >
                    {loc.name}
                  </button>
                ))}
              </div>
            )}

            <input
              id="ghl-location-id"
              type="text"
              value={subaccountId}
              onChange={(e) => setSubaccountId(e.target.value)}
              placeholder="e.g. y3KLRBUZzf2t45o7rzp9"
              required
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs transition-all"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Found in your CRM under <span className="text-slate-700 font-medium">Settings → Business Profile → General Info</span>.
            </p>
          </div>

          {/* Subaccount Private Integration Token */}
          <div>
            <label htmlFor="ghl-api-key" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <KeyRound className="w-3.5 h-3.5 text-slate-500" />
              <span>Sub-Account Private Integration Token</span>
              {userProfile?.hasCustomGhlKey && (
                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                  Active
                </span>
              )}
            </label>
            <div className="relative">
              <input
                id="ghl-api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  userProfile?.ghlApiKeyMasked
                    ? `Saved: ${userProfile.ghlApiKeyMasked} (enter new to update)`
                    : 'pit-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
                }
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-white border border-slate-300 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs transition-all"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                title={showApiKey ? 'Hide Token' : 'Show Token'}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Must be created inside this specific Sub-Account with contact permissions.
            </p>
          </div>

          {/* Feedback Status */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                  : statusMessage.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-blue-50 border border-blue-200 text-blue-800'
              }`}
            >
              {statusMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              {statusMessage.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              {statusMessage.type === 'info' && <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={isSaving || !subaccountId.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs tracking-wide shadow-xs transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying & Saving...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                  <span>Save & Test Connection</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
