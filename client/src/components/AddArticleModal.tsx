import React, { useEffect, useState } from 'react';
import {
  X,
  Link2,
  Mail,
  Smartphone,
  Bookmark,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Plus,
} from 'lucide-react';
import type { Campaign } from '../types/campaign';

interface AddArticleModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: Campaign[];
  activeCampaignId: string;
  onAdded: (result: { companyName?: string; message: string; duplicate?: boolean; async?: boolean; jobId?: string }) => Promise<void> | void;
}

export const AddArticleModal: React.FC<AddArticleModalProps> = ({
  isOpen,
  onClose,
  campaigns,
  activeCampaignId,
  onAdded,
}) => {
  const [tab, setTab] = useState<'paste' | 'mobile'>('paste');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [selectedCampaignId, setSelectedCampaignId] = useState(activeCampaignId);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [forwardingEmail, setForwardingEmail] = useState('');
  const [quickAddUrl, setQuickAddUrl] = useState('');
  const [ingestToken, setIngestToken] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedCampaignId(activeCampaignId);
      setError(null);
    }
  }, [isOpen, activeCampaignId]);

  useEffect(() => {
    if (!isOpen || tab !== 'mobile' || forwardingEmail) return;
    const token = localStorage.getItem('twinflow_session_token');
    if (!token) return;
    fetch('/api/user/ingest-token', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setForwardingEmail(data.forwardingEmail || '');
          setQuickAddUrl(data.quickAddUrl || '');
          setIngestToken(data.ingestToken || '');
        }
      })
      .catch(() => {
        // non-fatal
      });
  }, [isOpen, tab, forwardingEmail]);

  if (!isOpen) return null;

  const handleCopy = (label: string, value: string) => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleRotate = async () => {
    const token = localStorage.getItem('twinflow_session_token');
    if (!token) return;
    setIsRotating(true);
    try {
      const res = await fetch('/api/user/ingest-token/rotate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setForwardingEmail(data.forwardingEmail || '');
        setQuickAddUrl(data.quickAddUrl || '');
        setIngestToken(data.ingestToken || '');
      }
    } finally {
      setIsRotating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() && !title.trim() && !text.trim()) {
      setError('Enter an article URL, headline, or text.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const token = localStorage.getItem('twinflow_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/signals/quick-add', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          url: url.trim() || undefined,
          title: title.trim() || undefined,
          text: text.trim() || undefined,
          campaignId: selectedCampaignId || undefined,
          sourceLabel: 'Manual Add',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || data.error || 'Could not add article.');
        return;
      }
      setUrl('');
      setTitle('');
      setText('');
      await onAdded({
        companyName: data.companyName,
        message: data.message,
        duplicate: data.duplicate,
        async: data.async,
        jobId: data.jobId,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error adding article.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const bookmarkletHref = `javascript:(function(){window.open('https://twinflow.co/?addUrl='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title),'_blank');})();`;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden text-slate-800"
      >
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Add Prospect from Article</h2>
            <p className="text-xs text-slate-500">
              Extract company, decision-maker, and tailored outreach draft automatically
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 sm:px-5 pt-3 border-b border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={() => setTab('paste')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              tab === 'paste'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link2 className="w-3.5 h-3.5" />
            Paste Link or Text
          </button>
          <button
            type="button"
            onClick={() => setTab('mobile')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              tab === 'mobile'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Phone Share, Email &amp; Bookmarklet
          </button>
        </div>

        {tab === 'paste' ? (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Article URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://biv.com/news/..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {campaigns.length > 0 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Target Campaign
                </label>
                <select
                  value={selectedCampaignId}
                  onChange={(e) => setSelectedCampaignId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Headline <span className="font-normal text-slate-400">(optional if URL provided)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Salish Soils expands operations into Metro Vancouver"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Article Text / Notes <span className="font-normal text-slate-400">(optional, helpful for paywalled articles)</span>
              </label>
              <textarea
                rows={3}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste key paragraphs if the article is behind a paywall..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                {isSubmitting ? 'Extracting Prospect...' : 'Add to Lead Deck'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-4 sm:p-5 space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                1. Phone Share Sheet (Zero Copy-Paste)
              </div>
              <p className="text-slate-600 leading-relaxed">
                <strong>Android:</strong> Tap Chrome menu &rarr; <em>Add to Home Screen</em>. TwinFlow appears directly in your phone&apos;s Share menu from any news app or LinkedIn.
              </p>
              <p className="text-slate-600 leading-relaxed">
                <strong>iPhone (Apple Shortcut):</strong> Create a 2-step Shortcut (&ldquo;Receive URLs from Share Sheet&rdquo; &rarr; &ldquo;Get Contents of URL&rdquo; POST JSON <code>{`{"url": Shortcut Input}`}</code>) to your personal Quick-Add URL:
              </p>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-semibold text-slate-700">Personal Quick-Add URL</span>
                <button
                  type="button"
                  onClick={handleRotate}
                  disabled={isRotating}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} />
                  Rotate Token
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={quickAddUrl || (ingestToken ? `https://twinflow.co/api/signals/quick-add?token=${ingestToken}` : 'Loading...')}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => handleCopy('quickAddUrl', quickAddUrl)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'quickAddUrl' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  2. Save-Once Forwarding Email
                </span>
                <button
                  type="button"
                  onClick={handleRotate}
                  disabled={isRotating}
                  className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isRotating ? 'animate-spin' : ''}`} />
                  Rotate
                </button>
              </div>
              <p className="text-slate-600">
                Save this address once in your Contacts as <strong>TwinFlow</strong>, then Share &rarr; Mail or forward any article/newsletter to it (no account ID needed):
              </p>
              <div className="flex items-center gap-2 pt-1">
                <input
                  readOnly
                  value={forwardingEmail || (ingestToken ? `leads+${ingestToken}@twinflow.co` : 'Loading...')}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => handleCopy('email', forwardingEmail)}
                  className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'email' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  Copy
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <Bookmark className="w-3.5 h-3.5 text-blue-600" />
                  3. Desktop 1-Click Bookmarklet
                </div>
                <p className="text-slate-600 mt-0.5">
                  Drag this button to your bookmarks bar to send any open article in 1 click.
                </p>
              </div>
              <a
                href={bookmarkletHref}
                onClick={(e) => e.preventDefault()}
                title="Drag me to your bookmarks bar"
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold whitespace-nowrap shadow-xs"
              >
                + TwinFlow
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
