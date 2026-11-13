import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Building2,
  Search,
  Download,
  ExternalLink,
  Mail,
  CheckCircle2,
  Clock,
  Copy,
  Check,
  RefreshCw,
  FileText,
  ChevronRight,
  ArrowUpRight,
  Zap,
  LayoutList,
  LayoutGrid,
  X,
  Building,
  Sparkles,
  Flame,
} from 'lucide-react';
import { LinkedInIcon } from './icons';
import type { PipelineContact, PipelineStats, SimilarContactCandidate } from '../types/contact';
import type { Campaign } from '../types/campaign';
import type { UserProfile } from '../types/lead';
import { ExecutiveAvatar } from './ExecutiveAvatar';
import { OrganizationDetailPage } from './OrganizationDetailPage';
import { authFetch } from '../utils/api';
import { openEmailClient } from '../utils/email';
import { isExternalArticleUrl } from '../utils/publishedAt';

interface ContactsPageProps {
  user: UserProfile | null;
  campaigns?: Campaign[];
  activeCampaignId?: string | null;
  onNavigateDeck: () => void;
  onOpenCrmSettings?: () => void;
}

export const ContactsPage: React.FC<ContactsPageProps> = ({
  user,
  campaigns = [],
  activeCampaignId,
  onNavigateDeck,
  onOpenCrmSettings,
}) => {
  const [contacts, setContacts] = useState<PipelineContact[]>([]);
  const [stats, setStats] = useState<PipelineStats>({
    totalCount: 0,
    organizationsCount: 0,
    crmSyncedCount: 0,
    withEmailCount: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(activeCampaignId || 'all');
  const [activeTab, setActiveTab] = useState<'all' | 'synced' | 'with_email' | 'with_linkedin'>('all');
  const [entityView, setEntityView] = useState<'contacts' | 'organizations'>('contacts');
  const [selectedOrganizationName, setSelectedOrganizationName] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedContactForModal, setSelectedContactForModal] = useState<PipelineContact | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [syncingContactId, setSyncingContactId] = useState<string | null>(null);
  const [unlockingApolloId, setUnlockingApolloId] = useState<string | null>(null);
  const [similarContacts, setSimilarContacts] = useState<SimilarContactCandidate[]>([]);
  const [similarContactsMode, setSimilarContactsMode] = useState<string>('');
  const [loadingSimilarContacts, setLoadingSimilarContacts] = useState<boolean>(false);
  const [gamification, setGamification] = useState({
    xp: user?.totalPoints ?? 0,
    streak: user?.streakCount ?? 0,
    credits: user?.creditBalance ?? 0,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setGamification({
        xp: user.totalPoints ?? 0,
        streak: user.streakCount ?? 0,
        credits: user.creditBalance ?? 0,
      });
    }
  }, [user]);

  // Show temporary toast message
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  // Fetch approved contacts from server
  const fetchContacts = useCallback(async () => {
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
          setContacts(data.contacts || []);
          if (data.stats) {
            setStats(data.stats);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch pipeline contacts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCampaignId]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Copy helper
  const handleCopy = (text: string, id: string, label: string = 'Copied') => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    showToast(`${label} copied to clipboard!`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Sync individual contact to CRM
  const handleSyncContact = async (contact: PipelineContact) => {
    setSyncingContactId(contact.id);
    try {
      const res = await authFetch(`/api/contacts/${contact.id}/sync-crm`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`✓ ${contact.name} at ${contact.companyName} synced to CRM!`);
        // Update contact state with new CRM id
        setContacts((prev) =>
          prev.map((c) => (c.id === contact.id ? { ...c, ghlContactId: data.ghlContactId } : c))
        );
        setStats((prev) => ({
          ...prev,
          crmSyncedCount: prev.crmSyncedCount + (contact.ghlContactId ? 0 : 1),
        }));
        if (selectedContactForModal?.id === contact.id) {
          setSelectedContactForModal((prev) =>
            prev ? { ...prev, ghlContactId: data.ghlContactId } : prev
          );
        }
      } else {
        if (data.crmNotConnected && onOpenCrmSettings) {
          onOpenCrmSettings();
        }
        showToast(`Sync failed: ${data.error || 'Please verify CRM credentials.'}`);
      }
    } catch (err: any) {
      showToast(`Sync error: ${err.message || 'Network error'}`);
    } finally {
      setSyncingContactId(null);
    }
  };

  // Load similar contacts when a Contact Dossier modal opens
  const fetchSimilarContacts = useCallback(async (contactId: string) => {
    if (!contactId || contactId.startsWith('ct_virtual_')) {
      setSimilarContacts([]);
      return;
    }
    setLoadingSimilarContacts(true);
    try {
      const res = await authFetch(`/api/contacts/${contactId}/similar`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setSimilarContacts(data.candidates || []);
          setSimilarContactsMode(data.mode || '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch similar contacts:', err);
    } finally {
      setLoadingSimilarContacts(false);
    }
  }, []);

  useEffect(() => {
    if (selectedContactForModal) {
      setSimilarContacts([]);
      fetchSimilarContacts(selectedContactForModal.id);
    }
  }, [selectedContactForModal, fetchSimilarContacts]);

  // Unlock a similar contact from Apollo & chain into it
  const handleUnlockSimilar = async (
    candidate: SimilarContactCandidate,
    context: {
      sourceCompanyName?: string;
      sourceContactName?: string;
      parentSignalId?: string;
      campaignId?: string | null;
    },
    openAfterUnlock?: 'dossier' | 'organization'
  ) => {
    setUnlockingApolloId(candidate.apolloPersonId);
    try {
      const res = await authFetch('/api/contacts/unlock-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apolloPersonId: candidate.apolloPersonId,
          sourceCompanyName: context.sourceCompanyName,
          sourceContactName: context.sourceContactName,
          parentSignalId: context.parentSignalId,
          campaignId: context.campaignId,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.contact) {
        const newContact: PipelineContact = data.contact;
        setContacts((prev) => [newContact, ...prev]);
        setStats((prev) => ({
          ...prev,
          totalCount: prev.totalCount + 1,
          organizationsCount: prev.organizationsCount + (
            contacts.some((c) => c.companyName.toLowerCase() === newContact.companyName.toLowerCase()) ? 0 : 1
          ),
          withEmailCount: prev.withEmailCount + (newContact.email ? 1 : 0),
        }));
        setGamification({
          xp: data.totalPoints ?? gamification.xp + 25,
          streak: data.streakCount ?? gamification.streak + 1,
          credits: data.creditsRemaining ?? Math.max(0, gamification.credits - 5),
        });
        showToast(`🔥 +${data.pointsAwarded || 25} XP · Streak x${data.streakCount || gamification.streak + 1}! Unlocked ${newContact.name}`);

        if (openAfterUnlock === 'dossier') {
          setSelectedContactForModal(newContact);
        } else if (openAfterUnlock === 'organization') {
          setSelectedOrganizationName(newContact.companyName);
        }
      } else {
        showToast(data.error || 'Could not unlock similar contact.');
      }
    } catch (err: any) {
      showToast(`Unlock error: ${err.message || 'Network error'}`);
    } finally {
      setUnlockingApolloId(null);
    }
  };

  // Filtered contacts based on search query and quick tab
  const filteredContacts = useMemo(() => {
    return contacts.filter((c) => {
      // Tab filter
      if (activeTab === 'synced' && !c.ghlContactId) return false;
      if (activeTab === 'with_email' && !c.email) return false;
      if (activeTab === 'with_linkedin' && !c.linkedinUrl) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = c.name.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesCompany = c.companyName.toLowerCase().includes(q);
        const matchesEmail = c.email ? c.email.toLowerCase().includes(q) : false;
        const matchesSignal = c.signalTitle.toLowerCase().includes(q) || c.signalType.toLowerCase().includes(q);
        return matchesName || matchesTitle || matchesCompany || matchesEmail || matchesSignal;
      }
      return true;
    });
  }, [contacts, activeTab, searchQuery]);

  // Group contacts by organization for Card / Org view
  const groupedByOrganization = useMemo(() => {
    const map = new Map<string, PipelineContact[]>();
    for (const c of filteredContacts) {
      const org = c.companyName || 'Other Accounts';
      if (!map.has(org)) {
        map.set(org, []);
      }
      map.get(org)!.push(c);
    }
    return Array.from(map.entries()).map(([orgName, members]) => ({
      organization: orgName,
      contacts: members,
      primarySignal: members[0]?.signalTitle,
      signalType: members[0]?.signalType,
      sourceUrl: members[0]?.sourceUrl,
      industryTags: members[0]?.industryTags || [],
    }));
  }, [filteredContacts]);

  const selectedOrganizationContacts = useMemo(() => {
    if (!selectedOrganizationName) return [];
    return contacts.filter(
      (c) => (c.companyName || 'Other Accounts') === selectedOrganizationName
    );
  }, [contacts, selectedOrganizationName]);

  // CSV Export
  const handleExportCsv = () => {
    if (filteredContacts.length === 0) {
      showToast('No contacts available to export.');
      return;
    }

    const headers = [
      'Company Name',
      'Decision Maker Name',
      'Job Title',
      'Email',
      'LinkedIn Profile',
      'Signal Catalyst',
      'Signal Headline',
      'Source Article URL',
      'CRM Contact ID',
      'CRM Sync Status',
      'Outreach Subject Line',
      'Outreach Pitch',
      'Date Approved',
    ];

    const escapeCsv = (str: string | null | undefined) => {
      if (!str) return '""';
      const clean = str.replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = filteredContacts.map((c) => [
      escapeCsv(c.companyName),
      escapeCsv(c.name),
      escapeCsv(c.title),
      escapeCsv(c.email),
      escapeCsv(c.linkedinUrl),
      escapeCsv(c.signalType),
      escapeCsv(c.signalTitle),
      escapeCsv(c.sourceUrl),
      escapeCsv(c.ghlContactId || 'Pending'),
      escapeCsv(c.ghlContactId ? 'Synced to CRM' : 'Pending'),
      escapeCsv(c.outreachDraft?.subject),
      escapeCsv(c.outreachDraft?.body),
      escapeCsv(new Date(c.createdAt).toLocaleDateString()),
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `twinflow-contacts-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`✓ Exported ${filteredContacts.length} contacts to CSV.`);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs px-4 py-2.5 rounded-xl shadow-lg border border-slate-700 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Hero / Header Section */}
      <div className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 text-[11px] font-semibold uppercase tracking-wider">
                  Outbound Pipeline
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-slate-500 text-xs font-medium">Cloudflare D1 Verified Ledger</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 font-sans">
                Contacts & Organizations
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
                Every verified decision-maker and organization approved from your live signal triage deck,
                synced with your CRM subaccount along with tailored executive outreach drafts.
              </p>
            </div>

            {/* Quick Actions + Gamification Chain HUD */}
            <div className="flex items-center gap-2.5 sm:self-end flex-wrap">
              {user && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-xs">
                  <span className="inline-flex items-center gap-1 text-amber-300" title="Total XP earned">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="font-mono">{gamification.xp} XP</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="inline-flex items-center gap-1 text-orange-300" title="Opportunity chain streak">
                    <Flame className="w-3.5 h-3.5" />
                    <span className="font-mono">x{gamification.streak}</span>
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-slate-200 font-mono">{gamification.credits} cr</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={contacts.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download CSV dossier"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={onNavigateDeck}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                title="Triage more signals in Lead Deck"
              >
                <Zap className="w-3.5 h-3.5 text-white" />
                <span>Lead Deck</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6">
            <button
              type="button"
              onClick={() => {
                setEntityView('contacts');
                setSelectedOrganizationName(null);
              }}
              className={`text-left rounded-xl p-3.5 border transition-all cursor-pointer ${
                entityView === 'contacts' && !selectedOrganizationName
                  ? 'bg-blue-50/50 border-blue-300 ring-2 ring-blue-500/10'
                  : 'bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Contacts</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1">
                {stats.totalCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Approved decision-makers</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setEntityView('organizations');
                setSelectedOrganizationName(null);
              }}
              className={`text-left rounded-xl p-3.5 border transition-all cursor-pointer ${
                entityView === 'organizations' || selectedOrganizationName
                  ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/10'
                  : 'bg-slate-50/80 border-slate-200/80 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Organizations</span>
                <Building2 className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1">
                {stats.organizationsCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Click to view accounts</div>
            </button>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Synced to CRM</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1">
                {stats.crmSyncedCount}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {stats.totalCount > 0
                  ? `${Math.round((stats.crmSyncedCount / stats.totalCount) * 100)}% synchronized`
                  : 'Ready to sync'}
              </div>
            </div>

            <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200/80">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Direct Verified Emails</span>
                <Mail className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-xl sm:text-2xl font-bold text-slate-900 font-mono mt-1">
                {stats.withEmailCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Verified outreach addresses</div>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Detail Page OR Contacts/Organizations Directory */}
      {selectedOrganizationName ? (
        <OrganizationDetailPage
          organizationName={selectedOrganizationName}
          contacts={selectedOrganizationContacts}
          user={user}
          copiedId={copiedId}
          syncingContactId={syncingContactId}
          unlockingApolloId={unlockingApolloId}
          onBack={() => {
            setSelectedOrganizationName(null);
            setEntityView('organizations');
          }}
          onCopy={handleCopy}
          onSyncContact={handleSyncContact}
          onSelectContactDossier={(contact) => setSelectedContactForModal(contact)}
          onUnlockSimilar={handleUnlockSimilar}
          onOpenOrganization={(org) => setSelectedOrganizationName(org)}
        />
      ) : (
        <>
      {/* Filter & Toolbar Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input & Campaign Selector */}
          <div className="flex items-center gap-2.5 flex-1 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by contact name, organization, title, or email..."
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

            {/* Campaign Select */}
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

          {/* Quick Filter Tabs & Layout View Switcher */}
          <div className="flex items-center justify-between lg:justify-end gap-2.5 flex-wrap">
            {/* Entity View Toggle: Contacts vs Organizations */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setEntityView('contacts')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  entityView === 'contacts'
                    ? 'bg-white text-blue-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Contacts</span>
              </button>
              <button
                type="button"
                onClick={() => setEntityView('organizations')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  entityView === 'organizations'
                    ? 'bg-white text-indigo-700 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Organizations</span>
              </button>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'all'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({contacts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('synced')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'synced'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                CRM Synced ({stats.crmSyncedCount})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('with_email')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'with_email'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                With Email ({stats.withEmailCount})
              </button>
            </div>

            {/* View Mode Toggle: Table vs Cards (Contacts mode only) */}
            {entityView === 'contacts' && (
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Table List View"
                >
                  <LayoutList className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white text-blue-600 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Organization Cards View"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-4">
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-3" />
            <div className="text-sm font-semibold text-slate-800">Loading approved pipeline...</div>
            <div className="text-xs text-slate-500 mt-1">Querying Cloudflare D1 contacts ledger</div>
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 sm:p-16 text-center shadow-xs">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-xs">
              <Users className="w-7 h-7" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              {searchQuery ? 'No matching contacts found' : 'No Approved Contacts Yet'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
              {searchQuery
                ? `No contacts or organizations matched your search "${searchQuery}". Try adjusting your keywords or clearing the filter.`
                : 'When you swipe right or approve prospects on the Lead Deck, their verified contact details, signal catalyst, and custom outreach pitches will appear here.'}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition-all cursor-pointer"
                >
                  Clear Search
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onNavigateDeck}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-xs font-semibold text-white shadow-xs transition-all cursor-pointer"
                >
                  <Zap className="w-4 h-4 text-white" />
                  <span>Open Lead Deck to Review Signals</span>
                </button>
              )}
            </div>
          </div>
        ) : entityView === 'organizations' ? (
          /* Organizations Directory View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedByOrganization.map((group) => {
              const syncedCount = group.contacts.filter((c) => Boolean(c.ghlContactId)).length;
              const emailCount = group.contacts.filter((c) => Boolean(c.email)).length;
              return (
                <div
                  key={group.organization}
                  onClick={() => setSelectedOrganizationName(group.organization)}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between cursor-pointer group"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-indigo-700 flex-shrink-0 font-bold text-sm">
                          {group.organization.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-slate-900 text-base truncate group-hover:text-indigo-700 transition-colors">
                            {group.organization}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 mt-0.5">
                            {group.signalType || 'Market Signal'}
                          </span>
                        </div>
                      </div>

                      {isExternalArticleUrl(group.sourceUrl) && (
                        <a
                          href={group.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
                          title="Read news source"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>

                    {group.primarySignal && (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 mb-3 text-xs text-slate-600 line-clamp-2">
                        <span className="font-semibold text-slate-700">Trigger:</span> {group.primarySignal}
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div className="rounded-lg bg-slate-50 border border-slate-200/70 py-2 px-1">
                        <div className="text-sm font-bold text-slate-900 font-mono">{group.contacts.length}</div>
                        <div className="text-[10px] text-slate-500">Contacts</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200/70 py-2 px-1">
                        <div className="text-sm font-bold text-slate-900 font-mono">
                          {syncedCount}/{group.contacts.length}
                        </div>
                        <div className="text-[10px] text-slate-500">CRM Synced</div>
                      </div>
                      <div className="rounded-lg bg-slate-50 border border-slate-200/70 py-2 px-1">
                        <div className="text-sm font-bold text-slate-900 font-mono">{emailCount}</div>
                        <div className="text-[10px] text-slate-500">Emails</div>
                      </div>
                    </div>

                    {group.industryTags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mb-3">
                        {group.industryTags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="truncate">
                      {group.contacts.map((c) => c.name).slice(0, 2).join(', ')}
                      {group.contacts.length > 2 ? ` +${group.contacts.length - 2}` : ''}
                    </span>
                    <span className="font-semibold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-0.5 flex-shrink-0">
                      <span>View Organization</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : viewMode === 'table' ? (
          /* Table View */
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto lg:overflow-x-visible">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 px-3">Organization & Catalyst</th>
                    <th className="py-3.5 px-3">Decision Maker</th>
                    <th className="py-3.5 px-3">Contact Details</th>
                    <th className="py-3.5 px-3">Outreach Pitch</th>
                    <th className="py-3.5 px-3">CRM Status</th>
                    <th className="py-3.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContacts.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setSelectedContactForModal(c)}
                    >
                      {/* Organization & Catalyst */}
                      <td className="py-4 px-3 max-w-[230px]">
                        <div className="flex items-start gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 flex-shrink-0 mt-0.5">
                            <Building className="w-4 h-4 text-slate-600" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 text-sm truncate flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOrganizationName(c.companyName || 'Other Accounts');
                                }}
                                className="truncate hover:text-indigo-600 hover:underline text-left cursor-pointer"
                                title="View organization details"
                              >
                                {c.companyName}
                              </button>
                              {isExternalArticleUrl(c.sourceUrl) && (
                                <a
                                  href={c.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-slate-400 hover:text-blue-600 transition-colors flex-shrink-0"
                                  title="View source article"
                                >
                                  <ArrowUpRight className="w-3.5 h-3.5" />
                                </a>
                              )}
                            </div>
                            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                                {c.signalType}
                              </span>
                              {c.campaignName && (
                                <span className="inline-flex items-center text-[10px] text-slate-400 truncate max-w-[110px]">
                                  • {c.campaignName}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate mt-1" title={c.signalTitle}>
                              {c.signalTitle}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Decision Maker */}
                      <td className="py-4 px-3 max-w-[200px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ExecutiveAvatar name={c.name} avatarUrl={c.avatarUrl} size="md" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span className="truncate">{c.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold flex-shrink-0">
                                Verified
                              </span>
                            </div>
                            <div className="text-slate-500 text-[11px] truncate mt-0.5">{c.title}</div>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info: Email & LinkedIn */}
                      <td className="py-4 px-3 max-w-[185px]">
                        <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                          {c.email ? (
                            <button
                              type="button"
                              onClick={() => handleCopy(c.email!, `email-${c.id}`, 'Email')}
                              className="flex items-center gap-1.5 text-slate-600 hover:text-blue-600 transition-colors text-[11px] group/copy max-w-full"
                              title="Click to copy email address"
                            >
                              <Mail className="w-3.5 h-3.5 text-slate-400 group-hover/copy:text-blue-600 flex-shrink-0" />
                              <span className="font-mono text-slate-800 group-hover/copy:underline truncate">
                                {c.email}
                              </span>
                              {copiedId === `email-${c.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400 opacity-0 group-hover/copy:opacity-100 flex-shrink-0 transition-opacity" />
                              )}
                            </button>
                          ) : (
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">Direct email pending</span>
                            </div>
                          )}

                          {c.linkedinUrl && (
                            <a
                              href={c.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors text-[11px] font-medium"
                              title="Open LinkedIn Profile"
                            >
                              <LinkedInIcon className="w-3.5 h-3.5 text-blue-600 fill-current flex-shrink-0" />
                              <span className="truncate">LinkedIn Profile</span>
                              <ExternalLink className="w-2.5 h-2.5 text-blue-500 flex-shrink-0" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Outreach Pitch Subject Preview */}
                      <td className="py-4 px-3 max-w-[210px]">
                        {c.outreachDraft ? (
                          <div className="space-y-1">
                            <div className="font-medium text-slate-800 truncate text-[11px]">
                              {c.outreachDraft.subject}
                            </div>
                            <div className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                              {c.outreachDraft.body}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] italic">Draft generated on deck</span>
                        )}
                      </td>

                      {/* CRM Status */}
                      <td className="py-4 px-3 whitespace-nowrap">
                        {c.ghlContactId ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Synced to CRM</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-medium">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Pending Sync</span>
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {c.outreachDraft && (
                              <button
                                type="button"
                                onClick={() =>
                                  openEmailClient('gmail', c.email, c.outreachDraft?.subject, c.outreachDraft?.body)
                                }
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
                                title="Launch Gmail compose with this pitch pre-filled"
                              >
                                <Mail className="w-3 h-3 text-red-600" />
                                <span>Gmail</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                              </button>
                            )}

                            {!c.ghlContactId && (
                              <button
                                type="button"
                                onClick={() => handleSyncContact(c)}
                                disabled={syncingContactId === c.id}
                                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition-all cursor-pointer disabled:opacity-50"
                                title="Sync to CRM"
                              >
                                {syncingContactId === c.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin text-blue-600" />
                                ) : (
                                  'Sync CRM'
                                )}
                              </button>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedContactForModal(c)}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-[11px] transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>Dossier</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Cards Grid View (Grouped by Organization) */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groupedByOrganization.map((group) => (
              <div
                key={group.organization}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Org Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-700 flex-shrink-0 font-bold text-sm">
                        {group.organization.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setSelectedOrganizationName(group.organization)}
                          className="font-bold text-slate-900 text-base truncate hover:text-indigo-600 hover:underline text-left block max-w-full cursor-pointer"
                        >
                          {group.organization}
                        </button>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 mt-0.5">
                          {group.signalType || 'Market Signal'}
                        </span>
                      </div>
                    </div>

                    {isExternalArticleUrl(group.sourceUrl) && (
                      <a
                        href={group.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
                        title="Read news source"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>

                  {/* Signal Context */}
                  {group.primarySignal && (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 mb-3 text-xs text-slate-600 line-clamp-2">
                      <span className="font-semibold text-slate-700">Trigger:</span> {group.primarySignal}
                    </div>
                  )}

                  {/* Members / Contacts in this Org */}
                  <div className="space-y-2.5 mb-4">
                    <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Identified Decision-Makers ({group.contacts.length})
                    </div>
                    {group.contacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => setSelectedContactForModal(contact)}
                        className="p-3 rounded-xl border border-slate-200/90 hover:border-blue-300 hover:bg-blue-50/20 transition-all cursor-pointer flex items-center justify-between gap-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ExecutiveAvatar name={contact.name} avatarUrl={contact.avatarUrl} size="sm" />
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-900 text-xs truncate">
                              {contact.name}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">{contact.title}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {contact.ghlContactId ? (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" title="Synced to CRM" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-amber-400" title="Pending CRM Sync" />
                          )}
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Approved {new Date(group.contacts[0]?.createdAt || Date.now()).toLocaleDateString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedOrganizationName(group.organization)}
                    className="font-semibold text-indigo-600 hover:text-indigo-800 transition-colors cursor-pointer"
                  >
                    View Organization →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
        </>
      )}

      {/* Contact Dossier & Pitch Detail Modal */}
      {selectedContactForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-semibold uppercase tracking-wider">
                  Approved Contact Dossier
                </span>
                {selectedContactForModal.ghlContactId ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Synced to CRM
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    <Clock className="w-3 h-3 text-amber-600" />
                    Pending CRM Sync
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedContactForModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Executive Overview */}
              <div className="flex items-start gap-4">
                <ExecutiveAvatar
                  name={selectedContactForModal.name}
                  avatarUrl={selectedContactForModal.avatarUrl}
                  size="lg"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-slate-900">{selectedContactForModal.name}</h2>
                  <div className="text-sm text-slate-600 font-medium">{selectedContactForModal.title}</div>
                  <button
                    type="button"
                    onClick={() => {
                      const org = selectedContactForModal.companyName || 'Other Accounts';
                      setSelectedContactForModal(null);
                      setSelectedOrganizationName(org);
                    }}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 hover:underline mt-0.5 inline-flex items-center gap-1 cursor-pointer"
                    title="View organization detail page"
                  >
                    <span>{selectedContactForModal.companyName}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Quick Contact Buttons */}
                  <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                    {selectedContactForModal.email && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            selectedContactForModal.email!,
                            `modal-email`,
                            'Email'
                          )
                        }
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-mono font-medium transition-colors cursor-pointer"
                        title="Copy email"
                      >
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span>{selectedContactForModal.email}</span>
                        {copiedId === 'modal-email' ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400" />
                        )}
                      </button>
                    )}

                    {selectedContactForModal.linkedinUrl && (
                      <a
                        href={selectedContactForModal.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors"
                      >
                        <LinkedInIcon className="w-3.5 h-3.5 text-blue-600 fill-current" />
                        <span>LinkedIn Profile</span>
                        <ExternalLink className="w-3 h-3 text-blue-500" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Triggering Catalyst Signal */}
              <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/70">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Triggering Market Signal
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/80">
                    {selectedContactForModal.signalType}
                  </span>
                </div>
                <div className="font-semibold text-slate-900 text-sm">
                  {selectedContactForModal.signalTitle}
                </div>
                {selectedContactForModal.articleSummary && (
                  <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                    {selectedContactForModal.articleSummary}
                  </p>
                )}
                {selectedContactForModal.summaryBullets && selectedContactForModal.summaryBullets.length > 0 && (
                  <ul className="mt-2.5 space-y-1">
                    {selectedContactForModal.summaryBullets.map((bullet, idx) => (
                      <li key={idx} className="text-xs text-slate-600 flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {isExternalArticleUrl(selectedContactForModal.sourceUrl) && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between">
                    <a
                      href={selectedContactForModal.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                    >
                      <span>Read Original Source Article</span>
                      <ExternalLink className="w-3 h-3 text-blue-500" />
                    </a>
                  </div>
                )}
              </div>

              {/* Outreach Pitch Draft */}
              {selectedContactForModal.outreachDraft && (
                <div className="rounded-xl border border-slate-200 p-4 bg-white">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        2-Sentence Outbound Pitch
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          openEmailClient(
                            'gmail',
                            selectedContactForModal.email,
                            selectedContactForModal.outreachDraft?.subject,
                            selectedContactForModal.outreachDraft?.body
                          )
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200/80 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                        title="Launch Gmail web compose with pre-filled recipient, subject, and 2-sentence pitch"
                      >
                        <Mail className="w-3.5 h-3.5 text-red-600" />
                        <span>Open in Gmail</span>
                        <ExternalLink className="w-3 h-3 opacity-70" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          openEmailClient(
                            'default',
                            selectedContactForModal.email,
                            selectedContactForModal.outreachDraft?.subject,
                            selectedContactForModal.outreachDraft?.body
                          )
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
                        title="Open default system mail client"
                      >
                        <span>Mail App</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(
                            `Subject: ${selectedContactForModal.outreachDraft?.subject}\n\n${selectedContactForModal.outreachDraft?.body}`,
                            'modal-pitch',
                            'Pitch'
                          )
                        }
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                      >
                        {copiedId === 'modal-pitch' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Sender / Recipient Metadata Bar */}
                  <div className="mb-2.5 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400">From:</span>
                      <span className="font-mono text-slate-800 font-medium truncate">{user?.email || 'demo@twinflow.co'}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-100/70 text-red-700 font-medium">Gmail</span>
                    </div>
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400">To:</span>
                      <span className="font-mono text-slate-800 font-medium truncate">{selectedContactForModal.email || 'Direct email pending'}</span>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-slate-900 pb-2 border-b border-slate-100">
                    Subject: <span className="font-normal text-slate-700">{selectedContactForModal.outreachDraft.subject}</span>
                  </div>

                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed pt-2.5 font-sans bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    {selectedContactForModal.outreachDraft.body}
                  </div>
                </div>
              )}

              {/* Similar Contacts (Apollo Lookalikes - Opportunity Chaining) */}
              {!selectedContactForModal.id.startsWith('ct_virtual_') && (
                <div className="rounded-xl border border-indigo-200/80 p-4 bg-indigo-50/30 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                        Similar Contacts
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px] font-semibold">
                        {similarContactsMode === 'lookalike_person' ? 'Apollo Lookalikes' : 'Role & Industry Peers'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">Unlock next opportunity (+25 XP)</span>
                  </div>

                  {loadingSimilarContacts ? (
                    <div className="py-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>Finding people similar to {selectedContactForModal.name}...</span>
                    </div>
                  ) : similarContacts.length === 0 ? (
                    <div className="py-3 text-center text-xs text-slate-500">
                      No similar contacts returned for this profile.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {similarContacts.map((cand) => {
                        const isUnlocking = unlockingApolloId === cand.apolloPersonId;
                        return (
                          <div
                            key={cand.apolloPersonId}
                            className="rounded-xl bg-white border border-slate-200 p-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs">{cand.firstName}</span>
                                <span className="text-slate-400 text-xs">•</span>
                                <span className="text-xs font-semibold text-indigo-700 truncate">
                                  {cand.organizationName}
                                </span>
                                {cand.hasEmail && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                    Email
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">{cand.title}</div>
                            </div>

                            <button
                              type="button"
                              disabled={Boolean(unlockingApolloId)}
                              onClick={() =>
                                handleUnlockSimilar(
                                  cand,
                                  {
                                    sourceCompanyName: selectedContactForModal.companyName,
                                    sourceContactName: selectedContactForModal.name,
                                    parentSignalId: selectedContactForModal.signalId,
                                    campaignId: selectedContactForModal.campaignId,
                                  },
                                  'dossier'
                                )
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-all cursor-pointer disabled:opacity-50 flex-shrink-0"
                            >
                              {isUnlocking ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <Zap className="w-3 h-3" />
                              )}
                              <span>{isUnlocking ? 'Unlocking...' : 'Unlock & Open (-5 cr)'}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-slate-50 border-t border-slate-200 px-6 py-3.5 flex items-center justify-between">
              <div className="text-[11px] text-slate-500">
                Approved on {new Date(selectedContactForModal.createdAt).toLocaleDateString()}
              </div>

              <div className="flex items-center gap-2.5">
                {!selectedContactForModal.ghlContactId && (
                  <button
                    type="button"
                    onClick={() => handleSyncContact(selectedContactForModal)}
                    disabled={syncingContactId === selectedContactForModal.id}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {syncingContactId === selectedContactForModal.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Sync to CRM Now</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedContactForModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
