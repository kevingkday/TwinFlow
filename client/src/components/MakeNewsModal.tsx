import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Sparkles,
  Send,
  CheckCircle2,
  AlertCircle,
  Globe,
  HelpCircle,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import type { UserProfile, SocialAccount, SocialAiDraft } from '../types/lead';
import { authFetch } from '../utils/api';
import { playSound } from '../utils/audio';

const LinkedInIcon = ({ className = 'w-4 h-4 text-sky-600' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.3a1.63 1.63 0 0 0-1.63 1.63c0 .9.73 1.63 1.63 1.63.9 0 1.63-.73 1.63-1.63 0-.9-.73-1.63-1.63-1.63Z" />
  </svg>
);

const XTwitterIcon = ({ className = 'w-4 h-4 text-slate-800' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const FacebookIcon = ({ className = 'w-4 h-4 text-blue-600' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3v3h-3v6.95c5.05-.5 9-4.76 9-9.95z" />
  </svg>
);

interface MakeNewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onNewsPublished?: (signalId?: string) => void;
}

export const MakeNewsModal: React.FC<MakeNewsModalProps> = ({
  isOpen,
  onClose,
  user,
  onNewsPublished,
}) => {
  // Input State
  const [topic, setTopic] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [companyName, setCompanyName] = useState(user?.organization || user?.name || 'Our Company');
  const [tone, setTone] = useState<'executive' | 'exciting' | 'educational'>('executive');

  // AI Draft State
  const [isDrafting, setIsDrafting] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'linkedin' | 'twitter' | 'facebook'>('summary');
  const [draft, setDraft] = useState<SocialAiDraft>({
    headline: '',
    summary: '',
    linkedinPost: '',
    twitterPost: '',
    facebookPost: '',
  });

  // Channel Selection State
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [isCrmConnected, setIsCrmConnected] = useState(false);

  // Publishing State
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<{
    channelsCount: number;
    message: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCompanyName(user?.organization || user?.name || 'Our Company');
      setErrorMessage(null);
      setPublishSuccess(null);
      fetchAccounts();

      if (!topic && user?.servicesOffered && user.servicesOffered.length > 0) {
        setTopic(`Expanding our ${user.servicesOffered[0]} operations`);
      }
    }
  }, [isOpen, user]);

  const fetchAccounts = async () => {
    setIsLoadingAccounts(true);
    try {
      const res = await authFetch('/api/social/accounts');
      if (res.ok) {
        const data = (await res.json()) as {
          success: boolean;
          accounts: SocialAccount[];
          isCrmConnected?: boolean;
        };
        if (data.success && data.accounts) {
          setAccounts(data.accounts);
          setIsCrmConnected(Boolean(data.isCrmConnected));
          // Default select all connected accounts
          setSelectedAccountIds(data.accounts.map((a) => a.id));
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingAccounts(false);
    }
  };

  const handleToggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGenerateAiDraft = async () => {
    if (!topic.trim()) {
      setErrorMessage('Please enter an announcement topic or rough notes first.');
      return;
    }

    setIsDrafting(true);
    setErrorMessage(null);

    try {
      const res = await authFetch('/api/social/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          keyPoints,
          companyName,
          tone,
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        draft?: SocialAiDraft;
        error?: string;
      };

      if (res.ok && data.success && data.draft) {
        playSound('success');
        setDraft(data.draft);
      } else {
        playSound('error');
        setErrorMessage(data.error || 'Failed to generate announcement copy.');
      }
    } catch (err) {
      playSound('error');
      setErrorMessage(`Error drafting: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDrafting(false);
    }
  };

  const handlePublish = async () => {
    const headline = draft.headline.trim() || topic.trim();
    const summary = draft.summary.trim() || keyPoints.trim();

    if (!headline || !summary) {
      setErrorMessage('Please generate or write a headline and summary before broadcasting.');
      return;
    }

    if (selectedAccountIds.length === 0) {
      setErrorMessage('Please select at least one social media channel.');
      return;
    }

    setIsPublishing(true);
    setErrorMessage(null);

    try {
      const res = await authFetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: headline,
          summary,
          accountIds: selectedAccountIds,
          companyName,
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        channelsPushed?: number;
        message?: string;
        error?: string;
      };

      if (res.ok && data.success) {
        playSound('success');
        setPublishSuccess({
          channelsCount: data.channelsPushed || selectedAccountIds.length,
          message: data.message || `Broadcast successfully sent to ${selectedAccountIds.length} channels!`,
        });
        onNewsPublished?.();
      } else {
        playSound('error');
        setErrorMessage(data.error || 'Failed to broadcast announcement.');
      }
    } catch (err) {
      playSound('error');
      setErrorMessage(`Broadcast failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleCopy = (text: string, tab: string) => {
    navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin':
        return <LinkedInIcon className="w-4 h-4 text-sky-600" />;
      case 'twitter':
        return <XTwitterIcon className="w-4 h-4 text-slate-800" />;
      case 'facebook':
        return <FacebookIcon className="w-4 h-4 text-blue-600" />;
      default:
        return <Globe className="w-4 h-4 text-slate-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Make News & Social Broadcast</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                  CRM Multi-Channel
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Publish company announcements across your CRM social channels and add to your signal deck.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Success Banner */}
          {publishSuccess ? (
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-emerald-900">Announcement Broadcasted!</h3>
              <p className="text-xs text-emerald-700 max-w-md mx-auto leading-relaxed">
                {publishSuccess.message}
                <br />
                Your company announcement has also been registered in your TwinFlow signal intelligence deck.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPublishSuccess(null);
                    onClose();
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPublishSuccess(null);
                    setTopic('');
                    setKeyPoints('');
                    setDraft({
                      headline: '',
                      summary: '',
                      linkedinPost: '',
                      twitterPost: '',
                      facebookPost: '',
                    });
                  }}
                  className="px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-800 font-semibold text-xs hover:bg-emerald-100 transition-all cursor-pointer"
                >
                  Publish Another
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Error Message */}
              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Step 1: Announcement Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Announcement Topic / Milestone</label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="e.g. Apex Logistics opens new 150k sq ft cold storage facility in Dallas"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Publishing Tone</label>
                  <select
                    value={tone}
                    onChange={(e) => setTone(e.target.value as 'executive' | 'exciting' | 'educational')}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="executive">Executive & Formal</option>
                    <option value="exciting">High-Growth & Exciting</option>
                    <option value="educational">Educational & Thought Leader</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Key Points & Specific Numbers (Optional)</span>
                  <span className="text-[11px] font-normal text-slate-400">Bulleted details or metrics</span>
                </label>
                <textarea
                  rows={2}
                  value={keyPoints}
                  onChange={(e) => setKeyPoints(e.target.value)}
                  placeholder="e.g. Adding 45 commercial refrigerated routes; 20-year NDL roof warranty certified; ready for Q1 contract biddings."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Generate AI Draft Button */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateAiDraft}
                  disabled={isDrafting}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs transition-all cursor-pointer ${
                    isDrafting ? 'bg-blue-400 cursor-wait' : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isDrafting ? 'Drafting with AI...' : 'Draft Multi-Channel Copy with AI'}</span>
                </button>
              </div>

              {/* Step 2: Multi-Platform Post Preview & Tabs */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('summary')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        activeTab === 'summary'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Press Wire
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('linkedin')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'linkedin'
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <LinkedInIcon className="w-3.5 h-3.5 text-sky-600" />
                      <span>LinkedIn</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('twitter')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'twitter'
                          ? 'bg-slate-100 text-slate-800 border border-slate-300'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <XTwitterIcon className="w-3.5 h-3.5 text-slate-800" />
                      <span>X / Twitter</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('facebook')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === 'facebook'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <FacebookIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>Facebook / GBP</span>
                    </button>
                  </div>

                  {/* Copy Button */}
                  {draft[activeTab === 'summary' ? 'summary' : `${activeTab}Post` as keyof SocialAiDraft] && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(
                          (activeTab === 'summary'
                            ? `${draft.headline}\n\n${draft.summary}`
                            : (draft[`${activeTab}Post` as keyof SocialAiDraft] as string)) || '',
                          activeTab
                        )
                      }
                      className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedTab === activeTab ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <div className="p-4 space-y-3 bg-white">
                  {/* Headline (Visible on Press Wire) */}
                  {activeTab === 'summary' && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                        Press Headline
                      </label>
                      <input
                        type="text"
                        value={draft.headline}
                        onChange={(e) => setDraft((prev) => ({ ...prev, headline: e.target.value }))}
                        placeholder="Click 'Draft with AI' to generate a headline or type one here..."
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Active Content Editor */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {activeTab === 'summary' && 'Press Summary'}
                      {activeTab === 'linkedin' && 'LinkedIn Post Body'}
                      {activeTab === 'twitter' && 'X / Twitter Post (280 chars)'}
                      {activeTab === 'facebook' && 'Facebook & Google Business Update'}
                    </label>
                    <textarea
                      rows={5}
                      value={
                        activeTab === 'summary'
                          ? draft.summary
                          : (draft[`${activeTab}Post` as keyof SocialAiDraft] as string) || ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (activeTab === 'summary') {
                          setDraft((prev) => ({ ...prev, summary: val }));
                        } else {
                          setDraft((prev) => ({ ...prev, [`${activeTab}Post`]: val }));
                        }
                      }}
                      placeholder="Post copy will be generated here by AI..."
                      className="w-full p-3 rounded-xl border border-slate-200 text-xs leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Step 3: Select CRM Social Channels */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-slate-900">Broadcast Channels (CRM Social Planner)</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.2 rounded-full border ${
                        isCrmConnected
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {isCrmConnected ? 'Live Subaccount' : 'Simulated Subaccount'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {selectedAccountIds.length} of {accounts.length} selected
                  </span>
                </div>

                {isLoadingAccounts ? (
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
                    <span>Loading connected social channels...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accounts.map((acc) => {
                    const isSelected = selectedAccountIds.includes(acc.id);
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => handleToggleAccount(acc.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/60 border-blue-300 text-blue-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                            {getPlatformIcon(acc.platform)}
                          </div>
                          <div className="overflow-hidden">
                            <div className="text-xs font-semibold truncate">{acc.name}</div>
                            <div className="text-[10px] text-slate-400 capitalize">{acc.platform} • {acc.type || 'account'}</div>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-md border flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </button>
                    );
                  })}
                  </div>
                )}
              </div>

              {/* Informational Guidance on API Authorization */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-[11px] text-slate-600">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>API Authorization Note:</strong> Channels are authenticated using the CRM Social Planner OAuth
                  API. Any channel connected inside your subaccount is automatically synced and ready for instant publishing.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        {!publishSuccess && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/70">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || selectedAccountIds.length === 0}
              className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all cursor-pointer ${
                isPublishing || selectedAccountIds.length === 0
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-98'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {isPublishing
                  ? 'Broadcasting via CRM...'
                  : `Broadcast to ${selectedAccountIds.length} Channel${selectedAccountIds.length === 1 ? '' : 's'}`}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
