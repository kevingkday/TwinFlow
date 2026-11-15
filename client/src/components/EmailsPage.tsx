import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Mail,
  Send,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Edit3,
  AlertCircle,
  Zap,
  X,
  Building2,
} from 'lucide-react';
import type { PipelineContact } from '../types/contact';
import type { Campaign } from '../types/campaign';
import type { UserProfile } from '../types/lead';
import { ExecutiveAvatar } from './ExecutiveAvatar';
import { authFetch } from '../utils/api';
import {
  openEmailClient,
  sendEmailViaGmailApi,
  startGmailOAuthConnect,
} from '../utils/email';

interface EmailsPageProps {
  user: UserProfile | null;
  campaigns?: Campaign[];
  activeCampaignId?: string | null;
  onNavigateDeck: () => void;
  onNavigateProfile: () => void;
}

export const EmailsPage: React.FC<EmailsPageProps> = ({
  user,
  campaigns = [],
  activeCampaignId,
  onNavigateDeck,
}) => {
  const [contacts, setContacts] = useState<PipelineContact[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'sent' | 'all'>('pending');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(activeCampaignId || 'all');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [connectingGmail, setConnectingGmail] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inline Edit Modal State
  const [editingContact, setEditingContact] = useState<PipelineContact | null>(null);
  const [editSubject, setEditSubject] = useState<string>('');
  const [editBody, setEditBody] = useState<string>('');
  const [savingDraft, setSavingDraft] = useState<boolean>(false);

  const isGmailConnected = Boolean(user?.gmailEmail);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const fetchEmailQueue = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = new URL('/api/contacts', window.location.origin);
      if (selectedCampaignId && selectedCampaignId !== 'all') {
        url.searchParams.set('campaignId', selectedCampaignId);
      }
      url.searchParams.set('status', 'approved');

      const res = await authFetch(url.pathname + url.search);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setContacts((data.contacts || []).filter((c: PipelineContact) => Boolean(c.outreachDraft)));
        }
      }
    } catch (err) {
      console.error('Failed to fetch email queue:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    fetchEmailQueue();
  }, [fetchEmailQueue]);

  const counts = useMemo(() => {
    const pending = contacts.filter((c) => c.outreachDraft?.status !== 'sent');
    const sent = contacts.filter((c) => c.outreachDraft?.status === 'sent');
    const readyToSend = pending.filter((c) => Boolean(c.email));
    const missingEmail = pending.filter((c) => !c.email);
    return {
      total: contacts.length,
      pending: pending.length,
      sent: sent.length,
      readyToSend: readyToSend.length,
      missingEmail: missingEmail.length,
    };
  }, [contacts]);

  const filteredItems = useMemo(() => {
    return contacts.filter((c) => {
      const isSent = c.outreachDraft?.status === 'sent';
      if (activeTab === 'pending' && isSent) return false;
      if (activeTab === 'sent' && !isSent) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.companyName.toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.outreachDraft?.subject || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [contacts, activeTab, searchQuery]);

  const handleCopy = (contact: PipelineContact) => {
    if (!contact.outreachDraft) return;
    const text = `Subject: ${contact.outreachDraft.subject}\n\n${contact.outreachDraft.body}`;
    navigator.clipboard.writeText(text);
    setCopiedId(contact.id);
    showToast('Email draft copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    const res = await startGmailOAuthConnect('/#emails');
    if (!res.success) {
      showToast(res.error || 'Could not start Gmail OAuth.');
      setConnectingGmail(false);
    }
  };

  const handleSendViaGmail = async (
    contact: PipelineContact,
    overrideSubject?: string,
    overrideBody?: string
  ) => {
    if (!contact.email || !contact.outreachDraft) {
      showToast('Recipient email address is required to send via Gmail.');
      return;
    }

    setSendingId(contact.id);
    try {
      const subject = overrideSubject ?? contact.outreachDraft.subject;
      const body = overrideBody ?? contact.outreachDraft.body;
      const res = await sendEmailViaGmailApi({
        to: contact.email,
        subject,
        body,
        contactId: contact.id,
        signalId: contact.signalId,
        draftId: contact.outreachDraft.id,
      });

      if (res.success) {
        const now = new Date().toISOString();
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contact.id && c.outreachDraft
              ? {
                  ...c,
                  updatedAt: now,
                  outreachDraft: {
                    ...c.outreachDraft,
                    subject,
                    body,
                    status: 'sent',
                  },
                }
              : c
          )
        );
        showToast(`✓ Sent to ${contact.email} via ${res.fromEmail || 'Gmail'}!`);
        if (editingContact?.id === contact.id) {
          setEditingContact(null);
        }
      } else {
        showToast(res.error || 'Failed to send email via Gmail.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error while sending email.');
    } finally {
      setSendingId(null);
    }
  };

  const handleUpdateDraftStatus = async (
    contact: PipelineContact,
    status: 'queued' | 'sent'
  ) => {
    if (!contact.outreachDraft) return;
    setUpdatingId(contact.id);
    try {
      const res = await authFetch(`/api/contacts/drafts/${contact.outreachDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setContacts((prev) =>
          prev.map((c) =>
            c.id === contact.id && c.outreachDraft
              ? {
                  ...c,
                  updatedAt: data.draft.updatedAt,
                  outreachDraft: { ...c.outreachDraft, status },
                }
              : c
          )
        );
        showToast(status === 'sent' ? 'Marked as Sent.' : 'Moved back to Pending.');
      } else {
        showToast(data.error || 'Could not update draft status.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenEdit = (contact: PipelineContact) => {
    if (!contact.outreachDraft) return;
    setEditingContact(contact);
    setEditSubject(contact.outreachDraft.subject);
    setEditBody(contact.outreachDraft.body);
  };

  const handleSaveEdit = async (sendAfterSave = false) => {
    if (!editingContact || !editingContact.outreachDraft) return;
    setSavingDraft(true);
    try {
      const res = await authFetch(`/api/contacts/drafts/${editingContact.outreachDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: editSubject, body: editBody }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updatedContact: PipelineContact = {
          ...editingContact,
          updatedAt: data.draft.updatedAt,
          outreachDraft: {
            ...editingContact.outreachDraft,
            subject: data.draft.subject,
            body: data.draft.body,
          },
        };
        setContacts((prev) =>
          prev.map((c) => (c.id === editingContact.id ? updatedContact : c))
        );
        if (sendAfterSave && isGmailConnected && updatedContact.email) {
          await handleSendViaGmail(updatedContact, data.draft.subject, data.draft.body);
        } else {
          showToast('Draft saved.');
          setEditingContact(null);
        }
      } else {
        showToast(data.error || 'Could not save draft.');
      }
    } catch (err: any) {
      showToast(err?.message || 'Network error.');
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-semibold uppercase tracking-wider">
                  Outbound Email Queue
                </span>
                {isGmailConnected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Gmail Synced: {user?.gmailEmail}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-semibold">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    Gmail Not Synced
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Pending & Sent Emails
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Review and send tailored outreach drafts from your approved leads. Direct 1-click sending
                and automatic Sent tracking require a synced Gmail account.
              </p>
            </div>

            <div className="flex items-center gap-2.5 sm:self-end flex-wrap">
              {!isGmailConnected && user && (
                <button
                  type="button"
                  onClick={handleConnectGmail}
                  disabled={connectingGmail}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {connectingGmail ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  <span>Connect Gmail</span>
                </button>
              )}

              <button
                type="button"
                onClick={onNavigateDeck}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>Lead Deck</span>
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`text-left rounded-xl p-3.5 border transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-500/10'
                  : 'bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Pending Emails</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1">
                {counts.pending}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Awaiting outreach</div>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sent')}
              className={`text-left rounded-xl p-3.5 border transition-all cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-emerald-50/60 border-emerald-300 ring-2 ring-emerald-500/10'
                  : 'bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Sent Emails</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1">
                {counts.sent}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {counts.total > 0
                  ? `${Math.round((counts.sent / counts.total) * 100)}% sent`
                  : 'Ready to send'}
              </div>
            </button>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Ready to Send</span>
                <Send className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1">
                {counts.readyToSend}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Pending with verified email</div>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Missing Email</span>
                <AlertCircle className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1">
                {counts.missingEmail}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Needs recipient address</div>
            </div>
          </div>
        </div>
      </div>

      {/* Gmail Sync Notice when disconnected */}
      {!isGmailConnected && user && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Connect Gmail for automatic Sent tracking:</span>{' '}
                Opening an external mail link cannot report back whether an email was sent. Connect your
                Gmail account to send directly from TwinFlow and automatically move emails to Sent.
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectGmail}
              disabled={connectingGmail}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all cursor-pointer flex-shrink-0"
            >
              {connectingGmail ? 'Connecting...' : 'Sync Gmail Now'}
            </button>
          </div>
        </div>
      )}

      {/* Filter & Tabs Toolbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by recipient, company, email, or subject..."
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {campaigns.length > 0 && (
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
              >
                <option value="all">All Campaigns</option>
                {campaigns.map((camp) => (
                  <option key={camp.id} value={camp.id}>
                    {camp.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'pending'
                  ? 'bg-white text-amber-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pending ({counts.pending})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sent')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-white text-emerald-700 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sent ({counts.sent})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({counts.total})
            </button>
          </div>
        </div>
      </div>

      {/* Email List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-800">Loading email queue...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3 border border-blue-100">
              <Mail className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {activeTab === 'pending'
                ? 'No pending emails right now'
                : activeTab === 'sent'
                ? 'No sent emails yet'
                : 'No outreach emails yet'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1.5">
              {activeTab === 'pending'
                ? 'Approve leads on the Lead Deck or unlock lookalike contacts to queue new outreach emails.'
                : 'Send a pending email via your synced Gmail account and it will appear here automatically.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((c) => {
              const draft = c.outreachDraft!;
              const isSent = draft.status === 'sent';
              const isSending = sendingId === c.id;
              const isUpdating = updatingId === c.id;

              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    {/* Recipient & Company */}
                    <div className="flex items-start gap-3 min-w-0">
                      <ExecutiveAvatar name={c.name} avatarUrl={c.avatarUrl} size="md" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                          <span className="text-xs text-slate-500">{c.title}</span>
                          {isSent ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Sent {new Date(c.updatedAt).toLocaleDateString()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
                              <Clock className="w-3 h-3 text-amber-600" />
                              Pending
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-xs text-slate-600 flex-wrap">
                          <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {c.companyName}
                          </span>
                          <span>•</span>
                          {c.email ? (
                            <span className="font-mono text-slate-700">{c.email}</span>
                          ) : (
                            <span className="text-rose-600 font-medium">No email address on file</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap md:flex-shrink-0">
                      {!isSent && isGmailConnected && c.email && (
                        <button
                          type="button"
                          onClick={() => handleSendViaGmail(c)}
                          disabled={isSending}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                          {isSending ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>{isSending ? 'Sending...' : 'Send via Gmail'}</span>
                        </button>
                      )}

                      {!isSent && !isGmailConnected && c.email && (
                        <button
                          type="button"
                          onClick={() =>
                            openEmailClient('gmail', c.email, draft.subject, draft.body)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Open in Gmail</span>
                          <ExternalLink className="w-3 h-3 opacity-70" />
                        </button>
                      )}

                      {!isSent && c.email && (
                        <button
                          type="button"
                          onClick={() =>
                            openEmailClient('default', c.email, draft.subject, draft.body)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all cursor-pointer"
                          title="Open in default mail app"
                        >
                          <span>Mail App</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all cursor-pointer"
                        title="Edit subject and body"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopy(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all cursor-pointer"
                        title="Copy subject and body"
                      >
                        {copiedId === c.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                        )}
                        <span>{copiedId === c.id ? 'Copied' : 'Copy'}</span>
                      </button>

                      {!isSent ? (
                        <button
                          type="button"
                          onClick={() => handleUpdateDraftStatus(c, 'sent')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                          title="Manually mark as sent if sent via external mail app"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Mark Sent</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUpdateDraftStatus(c, 'queued')}
                          disabled={isUpdating}
                          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                        >
                          <span>Move to Pending</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Email Subject & Body Preview */}
                  <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 space-y-1.5">
                    <div className="text-xs font-semibold text-slate-900">
                      Subject: <span className="font-normal text-slate-700">{draft.subject}</span>
                    </div>
                    <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {draft.body}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Email Draft Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Edit Email to {editingContact.name}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingContact.email || 'No email on file'} • {editingContact.companyName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Message Body
                </label>
                <textarea
                  rows={7}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingContact(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit(false)}
                disabled={savingDraft}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-800 cursor-pointer disabled:opacity-50"
              >
                {savingDraft ? 'Saving...' : 'Save Draft'}
              </button>
              {isGmailConnected && editingContact.email && (
                <button
                  type="button"
                  onClick={() => handleSaveEdit(true)}
                  disabled={savingDraft || sendingId === editingContact.id}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Save & Send via Gmail</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
