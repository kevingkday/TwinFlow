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
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Unlink,
  Lock,
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
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [showManualSection, setShowManualSection] = useState(false);

  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedScope, setCopiedScope] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);

  const [agencySubaccounts, setAgencySubaccounts] = useState<GhlSubaccountOption[]>([]);
  const [isLoadingSubaccounts, setIsLoadingSubaccounts] = useState(false);

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

  const handleCopyEmail = (emailText: string) => {
    navigator.clipboard.writeText(emailText);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyPassword = (passText: string) => {
    navigator.clipboard.writeText(passText);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  const handleCopyScopes = () => {
    navigator.clipboard.writeText(
      'chat-widget.readonly chat-widget.write contacts.readonly contacts.write conversations.readonly conversations.write conversations/message.readonly conversations/message.write locations.readonly'
    );
    setCopiedScope(true);
    setTimeout(() => setCopiedScope(false), 2000);
  };

  const handleConnectOAuth = () => {
    window.location.href = '/api/oauth/ghl/start';
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your GoHighLevel integration?')) return;
    setIsDisconnecting(true);
    setStatusMessage(null);
    try {
      const res = await authFetch('/api/oauth/ghl/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearPit: false }),
      });
      const data = (await res.json()) as { success: boolean; message?: string; error?: string };
      if (res.ok && data.success) {
        setStatusMessage({ type: 'info', text: data.message || 'HighLevel disconnected.' });
        if (userProfile) {
          onProfileUpdated({
            ...userProfile,
            isGhlConnected: false,
            ghlAuthMethod: 'none',
          });
        }
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to disconnect.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: String(err) });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleProvisionSubaccount = async () => {
    setIsProvisioning(true);
    setStatusMessage(null);
    try {
      const res = await authFetch('/api/oauth/ghl/provision-subaccount', {
        method: 'POST',
      });
      const data = (await res.json()) as {
        success: boolean;
        locationId?: string;
        subaccountLoginEmail?: string;
        subaccountTempPassword?: string;
        message?: string;
        error?: string;
      };
      if (res.ok && data.success) {
        setStatusMessage({
          type: 'success',
          text: data.message || 'Sub-Account & login credentials provisioned successfully!',
        });
        if (userProfile) {
          onProfileUpdated({
            ...userProfile,
            ghlSubaccountId: data.locationId || userProfile.ghlSubaccountId,
            subaccountLoginEmail: data.subaccountLoginEmail || userProfile.subaccountLoginEmail,
            subaccountTempPassword: data.subaccountTempPassword || userProfile.subaccountTempPassword,
          });
        }
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Failed to provision subaccount credentials.' });
      }
    } catch (err) {
      setStatusMessage({ type: 'error', text: String(err) });
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleManualSave = async (e: React.FormEvent) => {
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

  const isConnected = Boolean(userProfile?.isGhlConnected);
  const isOAuthConnected = isConnected && userProfile?.ghlAuthMethod === 'oauth';
  const loginEmail = userProfile?.subaccountLoginEmail || userProfile?.email || '';
  const tempPassword = userProfile?.subaccountTempPassword || '';

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
            <h2 className="text-xl font-bold font-display text-slate-900">HighLevel CRM Integration</h2>
            <p className="text-xs text-slate-500">
              Authorize TwinFlow with 1 click or use your auto-provisioned Sub-Account
            </p>
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
                {isOAuthConnected
                  ? 'HighLevel OAuth 2.0 Connected'
                  : isConnected
                  ? 'CRM Private Token Connected'
                  : 'HighLevel Connection Required to Push Leads'}
              </p>
              <p className="text-[11px] text-slate-600">
                {isConnected
                  ? `Active Location: ${userProfile?.ghlSubaccountId || 'Default'} ${
                      userProfile?.ghlApiKeyMasked ? `• Key: ${userProfile.ghlApiKeyMasked}` : ''
                    }`
                  : 'Connect your HighLevel account to auto-push approved leads and executive pitch drafts.'}
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
            {isOAuthConnected ? 'OAUTH ACTIVE' : isConnected ? 'TOKEN ACTIVE' : 'ACTION REQUIRED'}
          </span>
        </div>

        {/* Primary 1-Click OAuth Action Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-slate-50 border border-blue-200/80 mb-5 shadow-xs">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>1-Click HighLevel Authorization</span>
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Connect via HighLevel's Marketplace OAuth flow. Authorizes contact syncing, conversations, and location access securely without manual keys.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              type="button"
              onClick={handleConnectOAuth}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs tracking-wide shadow-xs transition-all cursor-pointer"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{isOAuthConnected ? 'Reconnect / Switch Location' : 'Connect HighLevel (OAuth)'}</span>
            </button>

            {isOAuthConnected && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-slate-700 hover:text-rose-700 font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
              >
                {isDisconnecting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlink className="w-3.5 h-3.5" />
                )}
                <span>Disconnect</span>
              </button>
            )}
          </div>
        </div>

        {/* Auto-Provisioned Sub-Account Login Credentials */}
        {(loginEmail || tempPassword) && (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 mb-5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Sub-Account Login Credentials
                </span>
              </div>
              <span className="text-[10px] text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full font-medium">
                Auto-Provisioned
              </span>
            </div>
            <p className="text-xs text-slate-600 mb-3 leading-relaxed">
              Use these credentials if HighLevel prompts you to sign in when authorizing your sub-account:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Login Email */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>Login Email</span>
                  <button
                    type="button"
                    onClick={() => handleCopyEmail(loginEmail)}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                  >
                    {copiedEmail ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedEmail ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <div className="text-xs font-mono font-medium text-slate-900 truncate" title={loginEmail}>
                  {loginEmail}
                </div>
              </div>

              {/* Temp Password */}
              <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span>Initial Password</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowTempPassword(!showTempPassword)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showTempPassword ? 'Hide' : 'Show'}
                    >
                      {showTempPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </button>
                    {tempPassword && (
                      <button
                        type="button"
                        onClick={() => handleCopyPassword(tempPassword)}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium cursor-pointer"
                      >
                        {copiedPassword ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedPassword ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-xs font-mono font-medium text-slate-900 truncate">
                  {tempPassword
                    ? showTempPassword
                      ? tempPassword
                      : '••••••••••••••••'
                    : 'Configured in HighLevel'}
                </div>
              </div>
            </div>
          </div>
        )}

        {!tempPassword && !loginEmail && (
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-5">
            <div>
              <p className="text-xs font-semibold text-slate-800">Need a dedicated Sub-Account & login?</p>
              <p className="text-[11px] text-slate-500">
                Auto-generate a HighLevel workspace and admin credentials in 1 click.
              </p>
            </div>
            <button
              type="button"
              onClick={handleProvisionSubaccount}
              disabled={isProvisioning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isProvisioning && <RefreshCw className="w-3 h-3 animate-spin" />}
              <span>{isProvisioning ? 'Provisioning...' : 'Provision Sub-Account'}</span>
            </button>
          </div>
        )}

        {/* Feedback Status */}
        {statusMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 mb-5 ${
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

        {/* Collapsible Manual Private Integration Token Fallback */}
        <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
          <button
            type="button"
            onClick={() => setShowManualSection(!showManualSection)}
            className="w-full flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/80 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-slate-600" />
              <span className="text-xs font-semibold text-slate-800">
                Advanced: Manual Private Integration Token (Fallback)
              </span>
            </div>
            {showManualSection ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
          </button>

          {showManualSection && (
            <div className="p-4 bg-white border-t border-slate-200 space-y-4">
              {/* Setup Instructions Box */}
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Manual Token Instructions</span>
                  <button
                    type="button"
                    onClick={handleCopyScopes}
                    className="flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    {copiedScope ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScope ? 'Scopes Copied!' : 'Copy Scopes'}</span>
                  </button>
                </div>
                <p>
                  In your Sub-Account, go to <strong>Settings → Private Integrations</strong> and create a token with contacts and conversation scopes.
                </p>
              </div>

              {/* Manual Form */}
              <form onSubmit={handleManualSave} className="space-y-4">
                {/* Subaccount Location ID */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="ghl-location-id" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Sub-Account Location ID</span>
                    </label>
                    {isLoadingSubaccounts ? (
                      <span className="text-[11px] text-slate-500 animate-pulse">Loading accounts...</span>
                    ) : agencySubaccounts.length > 0 ? (
                      <span className="text-[11px] text-slate-500">Pick from Agency:</span>
                    ) : null}
                  </div>

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
                    className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs transition-all"
                  />
                </div>

                {/* Subaccount Private Integration Token */}
                <div>
                  <label htmlFor="ghl-api-key" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 mb-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-500" />
                    <span>Private Integration Token</span>
                    {userProfile?.hasCustomGhlKey && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                        Active PIT
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
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-white border border-slate-300 text-xs font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                      title={showApiKey ? 'Hide Token' : 'Show Token'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSaving || !subaccountId.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs tracking-wide shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-blue-200" />
                        <span>Save & Test Token</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
