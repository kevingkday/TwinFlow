import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { INITIAL_LEADS } from './data/mockLeads';
import type {
  LeadCardData,
  SwipeAction,
  SwipeStats,
  ApiDeckResponse,
  ApiActionResponse,
  ApiSignalItem,
  SignalCategory,
  UserProfile,
  DecisionMaker,
} from './types/lead';
import type { Campaign, CampaignsResponse } from './types/campaign';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { DeckView } from './components/DeckView';
import { ActionControls } from './components/ActionControls';
import { LeadDetailPane } from './components/LeadDetailPane';
import { PitchEditorModal } from './components/PitchEditorModal';
import { HelpModal } from './components/HelpModal';
import { AdminModal } from './components/AdminModal';
import { UpgradeModal } from './components/UpgradeModal';
import { GhlSettingsModal } from './components/GhlSettingsModal';
import { BranchOutModal } from './components/BranchOutModal';
import { AuthModal } from './components/AuthModal';
import { OnboardingModal } from './components/OnboardingModal';
import { LandingPage } from './components/LandingPage';
import { ProfilePage } from './components/ProfilePage';
import { ContactsPage } from './components/ContactsPage';
import { MakeNewsModal } from './components/MakeNewsModal';
import { playSound } from './utils/audio';
import { authFetch } from './utils/api';
import { Radio, Check, AlertCircle } from 'lucide-react';
import { LegalPage } from './components/LegalPage';
import { articleSourceLabel, formatPublishedAgo } from './utils/publishedAt';

function mapApiSignalToLead(item: ApiSignalItem): LeadCardData {
  const hostname = articleSourceLabel(item.sourceUrl, 'Market Wire');

  const bodyWords = item.outreachDraft?.body ? item.outreachDraft.body.split(/\s+/).length : 50;
  const readSeconds = Math.max(25, Math.ceil((bodyWords / 180) * 60));

  const primaryContact: DecisionMaker = {
    id: item.contact?.id || `dm-${item.id}`,
    name: item.contact?.name || 'Verified Executive',
    title: item.contact?.title || 'Decision Maker',
    company: item.companyName,
    email: item.contact?.email || undefined,
    linkedinUrl: item.contact?.linkedinUrl || undefined,
    avatarUrl: item.contact?.avatarUrl || undefined,
    isEnriched: Boolean(item.contact?.email || item.contact?.linkedinUrl),
  };

  const allContacts: DecisionMaker[] = (item.contacts && item.contacts.length > 0)
    ? item.contacts.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        company: item.companyName,
        email: c.email || undefined,
        linkedinUrl: c.linkedinUrl || undefined,
        avatarUrl: c.avatarUrl || undefined,
        isEnriched: Boolean(c.email || c.linkedinUrl || c.isEnriched),
      }))
    : [primaryContact];

  const defaultSummary = item.summaryBullets && item.summaryBullets.length > 0
    ? `${item.companyName} reported a key ${item.signalType.toLowerCase()} milestone: ${item.summaryBullets[0]}. This operational catalyst triggers immediate strategic outreach.`
    : `${item.signalType} catalyst reported for ${item.companyName}.`;

  return {
    id: item.id,
    parentSignalId: item.parentSignalId || null,
    headline: item.title,
    companyName: item.companyName,
    source: hostname,
    sourceUrl: item.sourceUrl,
    publishedAgo: item.parentSignalId ? 'Branched Lead' : formatPublishedAgo(item.publishedAt),
    category: item.signalType as SignalCategory,
    fitScore: 94 + (item.id.charCodeAt(item.id.length - 1) % 5),
    summaryBullets:
      item.summaryBullets && item.summaryBullets.length > 0
        ? item.summaryBullets
        : [
            'Significant executive or market trigger detected',
            'Substantial operational scaling underway',
            'Immediate outbound pipeline opportunity',
          ],
    articleSummary: item.articleSummary || defaultSummary,
    decisionMaker: primaryContact,
    contacts: allContacts,
    emailDraft: {
      id: item.outreachDraft?.id,
      subject: item.outreachDraft?.subject || `quick question re: ${item.companyName}`,
      body:
        item.outreachDraft?.body ||
        `Hi ${primaryContact.name.split(' ')[0] || 'there'},\n\nI saw the recent article regarding ${item.companyName}'s upcoming plans. Given our work in commercial services, would there be an opportunity to connect and see if we can present our services for your upcoming milestones?\n\nBest,`,
      cta: 'Connect re: offerings',
      estimatedReadTime: `${readSeconds} sec read`,
    },
    rawSignalSummary: `${item.signalType} trigger for ${item.companyName}. Verified decision-maker: ${item.contact?.name || 'Key Executive'}.`,
    tags: [
      item.signalType,
      item.companyName,
      item.parentSignalId ? 'Branched Node' : 'Live Trigger',
      'Verified',
    ],
    industryTags: item.industryTags || [],
  };
}

export const App: React.FC = () => {
  const [leads, setLeads] = useState<LeadCardData[]>(INITIAL_LEADS);
  const [history, setHistory] = useState<{ lead: LeadCardData; action: SwipeAction }[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [ghlSettingsOpen, setGhlSettingsOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [editingLead, setEditingLead] = useState<LeadCardData | null>(null);
  const [mobileDetailLead, setMobileDetailLead] = useState<LeadCardData | null>(null);
  const [branchModalLead, setBranchModalLead] = useState<LeadCardData | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('twinflow_session_token') : null
  );
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'signup' | 'login'>('login');
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [campaignModalOpen, setCampaignModalOpen] = useState(false);
  const [campaignModalMode, setCampaignModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCampaignForEdit, setSelectedCampaignForEdit] = useState<Campaign | null>(null);
  const [serverOnline, setServerOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isScouting, setIsScouting] = useState(false);
  const [scoutToast, setScoutToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [makeNewsModalOpen, setMakeNewsModalOpen] = useState(false);

  const [stats, setStats] = useState<SwipeStats>({
    approvedCount: 0,
    passedCount: 0,
    remainingCount: INITIAL_LEADS.length,
    streak: 0,
    creditsRemaining: 500,
    totalPoints: 0,
    branchCombo: 0,
  });

  const [currentView, setCurrentView] = useState<'landing' | 'deck' | 'contacts' | 'profile'>(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#deck') return 'deck';
      if (window.location.hash === '#contacts') return 'contacts';
      if (window.location.hash === '#profile') return 'profile';
    }
    return 'landing';
  });

  const handleNavigate = useCallback(
    (view: 'landing' | 'deck' | 'contacts' | 'profile') => {
      setCurrentView(view);
      if (typeof window !== 'undefined') {
        window.location.hash =
          view === 'deck'
            ? '#deck'
            : view === 'contacts'
            ? '#contacts'
            : view === 'profile'
            ? '#profile'
            : '';
      }
    },
    []
  );

  const handleLaunchDeck = useCallback(() => {
    handleNavigate('deck');
  }, [handleNavigate]);

  useEffect(() => {
    const handleHash = () => {
      if (window.location.hash === '#deck') {
        setCurrentView('deck');
      } else if (window.location.hash === '#contacts') {
        setCurrentView('contacts');
      } else if (window.location.hash === '#profile') {
        setCurrentView('profile');
      } else if (!window.location.hash || window.location.hash === '#home') {
        setCurrentView('landing');
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Fetch operator profile & CRM connection status
  const fetchUserProfile = useCallback(async () => {
    try {
      const token = sessionToken || localStorage.getItem('twinflow_session_token');
      if (!token) {
        setUserProfile(null);
        return;
      }
      const res = await authFetch('/api/user/profile');
      if (res.ok) {
        const data = (await res.json()) as { success: boolean; user?: UserProfile };
        if (data.success && data.user) {
          setUserProfile(data.user);
          setStats((prev) => ({
            ...prev,
            creditsRemaining: data.user!.creditBalance,
            streak: data.user!.streakCount,
            totalPoints: data.user!.totalPoints,
          }));
        } else {
          setUserProfile(null);
        }
      } else {
        localStorage.removeItem('twinflow_session_token');
        setSessionToken(null);
        setUserProfile(null);
      }
    } catch {
      // Local fallback
    }
  }, [sessionToken]);

  // Fetch user campaigns from GET /api/campaigns
  const fetchCampaigns = useCallback(async (customToken?: string) => {
    try {
      const res = await authFetch('/api/campaigns', {
        headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      });
      if (!res.ok) return;
      const data = (await res.json()) as CampaignsResponse;
      if (data.success && Array.isArray(data.campaigns)) {
        setCampaigns(data.campaigns);
        const active =
          data.activeCampaignId ||
          data.campaigns.find((c) => c.isActive)?.id ||
          (data.campaigns[0] ? data.campaigns[0].id : null);
        setActiveCampaignId(active);
      }
    } catch (err) {
      console.warn('Could not fetch campaigns:', err);
    }
  }, []);

  // Fetch signals deck from GET /api/signals/deck
  const fetchDeck = useCallback(async (customToken?: string, campaignIdOverride?: string) => {
    setIsLoading(true);
    const targetCampId = campaignIdOverride !== undefined ? campaignIdOverride : activeCampaignId;
    try {
      const queryParam = targetCampId ? `?campaignId=${encodeURIComponent(targetCampId)}` : '';
      const res = await authFetch(`/api/signals/deck${queryParam}`, {
        headers: customToken ? { Authorization: `Bearer ${customToken}` } : {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ApiDeckResponse = await res.json();

      if (data.success && Array.isArray(data.signals)) {
        if (data.signals.length > 0) {
          const mapped = data.signals.map(mapApiSignalToLead);
          setLeads(mapped);
          setServerOnline(true);
          if (data.user) {
            setStats((prev) => ({
              ...prev,
              remainingCount: mapped.length,
              creditsRemaining: data.user.creditBalance,
              streak: data.user.streakCount,
              totalPoints: data.user.totalPoints,
              ...(typeof data.approvedCount === 'number' ? { approvedCount: data.approvedCount } : {}),
            }));
          }
        } else {
          setLeads([]);
          setServerOnline(true);
          if (data.user) {
            setStats((prev) => ({
              ...prev,
              remainingCount: 0,
              creditsRemaining: data.user.creditBalance,
              streak: data.user.streakCount,
              totalPoints: data.user.totalPoints,
              ...(typeof data.approvedCount === 'number' ? { approvedCount: data.approvedCount } : {}),
            }));
          }
        }
      } else {
        setServerOnline(true);
      }
    } catch (err) {
      console.warn('Backend /api/signals/deck unavailable or local fallback active:', err);
      setServerOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, [activeCampaignId]);

  useEffect(() => {
    fetchDeck();
    fetchUserProfile();
    fetchCampaigns();
  }, [fetchDeck, fetchUserProfile, fetchCampaigns]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#6366f1', '#10b981', '#a855f7', '#38bdf8'],
    });
  };

  // Trigger real ingestion pipeline (AI Search & Enrichment)
  const handleScoutNews = async () => {
    if (isScouting) return;
    setIsScouting(true);
    setScoutToast({
      message: 'Scouting market signals via AI Search & Enrichment...',
      type: 'info',
    });

    try {
      const res = await authFetch('/api/signals/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Series A OR expansion OR hired CEO',
          limit: 3,
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setScoutToast({
          message:
            data.ingestedCount > 0
              ? `AI Scout successfully enriched ${data.ingestedCount} new signals!`
              : 'Signals scanned; all recent items already in queue.',
          type: 'success',
        });
        if (soundEnabled) playSound('streak');
        triggerConfetti();
        await fetchDeck();
      } else {
        setScoutToast({
          message: data.error || 'Signal ingestion encountered an issue.',
          type: 'error',
        });
      }
    } catch (err) {
      console.error('Error scouting news signals:', err);
      setScoutToast({
        message: 'Could not connect to backend ingestion pipeline.',
        type: 'error',
      });
    } finally {
      setIsScouting(false);
      setTimeout(() => setScoutToast(null), 5000);
    }
  };

  // Top-up dev credits
  const handleReplenishDevCredits = async (amount: number) => {
    try {
      const res = await authFetch('/api/signals/credits/replenish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setStats((prev) => ({
            ...prev,
            creditsRemaining: data.creditBalance,
          }));
          setScoutToast({
            message: `Added +${amount} credits! New balance: ${data.creditBalance}`,
            type: 'success',
          });
          if (soundEnabled) playSound('streak');
          triggerConfetti();
          setUpgradeModalOpen(false);
        }
      }
    } catch (err) {
      console.error('Replenish credits error:', err);
    }
  };

  const handleAuthSuccess = (user: UserProfile, token: string) => {
    localStorage.setItem('twinflow_session_token', token);
    setSessionToken(token);
    setUserProfile(user);
    setStats((prev) => ({
      ...prev,
      creditsRemaining: user.creditBalance,
      streak: user.streakCount,
      totalPoints: user.totalPoints,
    }));
    setScoutToast({
      message: `Signed in as ${user.name || user.email}!`,
      type: 'success',
    });
    fetchCampaigns(token);
    fetchDeck(token);
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('twinflow_session_token');
    if (token) {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    localStorage.removeItem('twinflow_session_token');
    setSessionToken(null);
    setUserProfile(null);
    setCampaigns([]);
    setActiveCampaignId(null);
    setStats({
      approvedCount: 0,
      passedCount: 0,
      remainingCount: INITIAL_LEADS.length,
      streak: 0,
      creditsRemaining: 500,
      totalPoints: 0,
      branchCombo: 0,
    });
    setLeads(INITIAL_LEADS);
    setScoutToast({
      message: 'You have been signed out.',
      type: 'info',
    });
  };

  const handleSelectCampaign = async (campaignId: string) => {
    setActiveCampaignId(campaignId);
    setCampaigns((prev) =>
      prev.map((c) => ({ ...c, isActive: c.id === campaignId }))
    );
    try {
      await authFetch(`/api/campaigns/${campaignId}/activate`, {
        method: 'POST',
      });
    } catch (err) {
      console.warn('Failed to persist active campaign:', err);
    }
    await fetchDeck(undefined, campaignId);
    const selected = campaigns.find((c) => c.id === campaignId);
    if (selected) {
      setScoutToast({
        message: `Campaign switched to: "${selected.name}"`,
        type: 'info',
      });
    }
  };

  const handleOpenCreateCampaign = () => {
    setSelectedCampaignForEdit(null);
    setCampaignModalMode('create');
    setCampaignModalOpen(true);
  };

  const handleOpenEditCampaign = (campaign: Campaign) => {
    setSelectedCampaignForEdit(campaign);
    setCampaignModalMode('edit');
    setCampaignModalOpen(true);
  };

  const handleCampaignModalComplete = async (
    updatedUser: UserProfile,
    savedCampaign?: Campaign
  ) => {
    setUserProfile(updatedUser);
    setCampaignModalOpen(false);
    setOnboardingOpen(false);
    setStats((prev) => ({
      ...prev,
      creditsRemaining: updatedUser.creditBalance,
    }));
    const token = localStorage.getItem('twinflow_session_token') || undefined;
    await fetchCampaigns(token);
    if (savedCampaign) {
      setActiveCampaignId(savedCampaign.id);
      await fetchDeck(token, savedCampaign.id);
      setScoutToast({
        message:
          campaignModalMode === 'edit'
            ? `Campaign "${savedCampaign.name}" updated!`
            : `Campaign "${savedCampaign.name}" created and loaded!`,
        type: 'success',
      });
    } else {
      await fetchDeck(token);
      setScoutToast({
        message: 'Targeting calibrated! Initialized signal deck.',
        type: 'success',
      });
    }
    triggerConfetti();
  };

  // Branch Out Scout multiplier handler
  const handleBranchScouted = (
    newCard: ApiSignalItem,
    pointsAwarded: number,
    creditsDeducted: number,
    combo: number
  ) => {
    const mapped = mapApiSignalToLead(newCard);
    setLeads((prev) => [mapped, ...prev]);
    setStats((prev) => ({
      ...prev,
      creditsRemaining: Math.max(0, prev.creditsRemaining - creditsDeducted),
      totalPoints: prev.totalPoints + pointsAwarded,
      branchCombo: combo,
      remainingCount: prev.remainingCount + 1,
    }));
    setScoutToast({
      message: `Branch Scouted: "${newCard.companyName}" added to top of deck (-${creditsDeducted} credits, +${pointsAwarded} XP)!`,
      type: 'success',
    });
    if (soundEnabled) playSound('streak');
    triggerConfetti();
  };

  const handleSwipe = useCallback(
    async (action: SwipeAction) => {
      if (leads.length === 0) return;

      const swipedLead = leads[0];

      // Pre-flight checks for approval
      if (action === 'approve') {
        if (!userProfile) {
          // Demo Mode: simulate interactive swipe without debiting real account or pushing to CRM
          const remaining = leads.slice(1);
          if (soundEnabled) playSound('approve');
          setHistory((prev) => [...prev, { lead: swipedLead, action }]);
          setLeads(remaining);

          setStats((prev) => {
            const newStreak = prev.streak + 1;
            if (newStreak > 0 && newStreak % 3 === 0) {
              if (soundEnabled) playSound('streak');
              triggerConfetti();
            }
            return {
              ...prev,
              approvedCount: prev.approvedCount + 1,
              remainingCount: remaining.length,
              streak: newStreak,
              creditsRemaining: Math.max(0, prev.creditsRemaining - 10),
              totalPoints: prev.totalPoints + 50,
            };
          });

          setScoutToast({
            message: 'Demo: Lead Approved (+50 XP)! Sign up or log in to sync real leads with your CRM.',
            type: 'success',
          });

          if (remaining.length === 0) {
            triggerConfetti();
          }
          return;
        }

        if (!userProfile.hasCustomGhlKey && !userProfile.isGhlConnected) {
          setScoutToast({
            message: 'CRM Private Token required. Please configure your key in CRM Settings before approving.',
            type: 'error',
          });
          setGhlSettingsOpen(true);
          return;
        }

        if (stats.creditsRemaining < 10) {
          setScoutToast({
            message: 'Out of credits! Minimum 10 credits required to approve & push to CRM.',
            type: 'error',
          });
          setUpgradeModalOpen(true);
          return;
        }
      }

      const remaining = leads.slice(1);

      if (soundEnabled) {
        playSound(action);
      }

      setHistory((prev) => [...prev, { lead: swipedLead, action }]);
      setLeads(remaining);

      // Trigger animated toast immediately
      if (action === 'approve') {
        setScoutToast({
          message: 'Lead Pushed to CRM (-10 credits)',
          type: 'success',
        });
      }

      // Optimistic client update
      setStats((prev) => {
        const isApproved = action === 'approve';
        const newApproved = isApproved ? prev.approvedCount + 1 : prev.approvedCount;
        const newPassed = !isApproved ? prev.passedCount + 1 : prev.passedCount;
        const newStreak = isApproved ? prev.streak + 1 : 0;
        const newCredits = isApproved ? Math.max(0, prev.creditsRemaining - 10) : prev.creditsRemaining;
        const newPoints = isApproved ? prev.totalPoints + 50 : prev.totalPoints;

        if (isApproved && newStreak > 0 && newStreak % 3 === 0) {
          if (soundEnabled) playSound('streak');
          triggerConfetti();
        }

        return {
          ...prev,
          approvedCount: newApproved,
          passedCount: newPassed,
          remainingCount: remaining.length,
          streak: newStreak,
          creditsRemaining: newCredits,
          totalPoints: newPoints,
        };
      });

      if (remaining.length === 0) {
        triggerConfetti();
      }

      // Hit POST /api/signals/:id/action
      try {
        const res = await authFetch(`/api/signals/${swipedLead.id}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            customSubject: swipedLead.emailDraft.subject,
            customBody: swipedLead.emailDraft.body,
          }),
        });

        if (res.ok) {
          const data: ApiActionResponse = await res.json();
          if (data.success && data.user) {
            // Update dynamic streak and points directly from database
            setStats((prev) => ({
              ...prev,
              creditsRemaining: data.user.creditBalance,
              streak: data.user.streakCount,
              totalPoints: data.user.totalPoints,
            }));
            if (data.message) {
              setScoutToast({
                message: data.message,
                type: 'success',
              });
            }
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          if (errData.insufficientCredits) {
            setScoutToast({
              message: 'Insufficient credits. Upgrade to continue approving.',
              type: 'error',
            });
            setUpgradeModalOpen(true);
          } else if (errData.crmNotConnected) {
            setScoutToast({
              message: 'CRM integration required before approving leads.',
              type: 'error',
            });
            setGhlSettingsOpen(true);
          } else {
            setScoutToast({
              message: errData.error || 'Failed to sync lead to CRM.',
              type: 'error',
            });
          }
        }
      } catch (err) {
        console.warn(`Could not sync action to /api/signals/${swipedLead.id}/action:`, err);
      }
    },
    [leads, soundEnabled, stats.creditsRemaining]
  );

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;

    const last = history[history.length - 1];
    const newHistory = history.slice(0, history.length - 1);

    if (soundEnabled) {
      playSound('undo');
    }

    setLeads((prev) => [last.lead, ...prev]);
    setHistory(newHistory);

    setStats((prev) => {
      const wasApproved = last.action === 'approve';
      return {
        ...prev,
        approvedCount: wasApproved ? Math.max(0, prev.approvedCount - 1) : prev.approvedCount,
        passedCount: !wasApproved ? Math.max(0, prev.passedCount - 1) : prev.passedCount,
        remainingCount: prev.remainingCount + 1,
        streak: wasApproved ? Math.max(0, prev.streak - 1) : prev.streak,
        creditsRemaining: wasApproved ? prev.creditsRemaining + 10 : prev.creditsRemaining,
        totalPoints: wasApproved ? Math.max(0, prev.totalPoints - 50) : prev.totalPoints,
      };
    });
  }, [history, soundEnabled]);

  const handleReset = async () => {
    await fetchDeck();
    if (leads.length === 0) {
      setLeads(INITIAL_LEADS);
      setHistory([]);
      setStats((prev) => ({
        ...prev,
        approvedCount: 0,
        passedCount: 0,
        remainingCount: INITIAL_LEADS.length,
      }));
    }
  };

  const handleUpdateDraft = (leadId: string, subject: string, body: string) => {
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id === leadId) {
          return {
            ...lead,
            emailDraft: {
              ...lead.emailDraft,
              subject,
              body,
            },
          };
        }
        return lead;
      })
    );
  };

  const handleSaveAndApprove = (leadId: string, subject: string, body: string) => {
    handleUpdateDraft(leadId, subject, body);
    handleSwipe('approve');
  };

  const handleSelectContact = (leadId: string, contact: DecisionMaker) => {
    setLeads((prev) =>
      prev.map((lead) => {
        if (lead.id !== leadId) return lead;
        const firstName = contact.name.split(' ')[0] || 'there';
        let newBody = lead.emailDraft.body;
        if (/^Hi\s+[A-Za-z]+,/i.test(newBody)) {
          newBody = newBody.replace(/^Hi\s+[A-Za-z]+,/i, `Hi ${firstName},`);
        }
        return {
          ...lead,
          decisionMaker: contact,
          emailDraft: {
            ...lead.emailDraft,
            body: newBody,
          },
        };
      })
    );
  };

  const handleEnrichContact = async (leadId: string, contact: DecisionMaker) => {
    setScoutToast({
      message: `Enriching ${contact.name} via Apollo & AI search...`,
      type: 'info',
    });
    try {
      const res = await authFetch(`/api/signals/${leadId}/enrich-contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          name: contact.name,
          title: contact.title,
        }),
      });
      const data = await res.json();
      if (data.success && data.contact) {
        setLeads((prev) =>
          prev.map((lead) => {
            if (lead.id !== leadId) return lead;
            const updatedContacts = (lead.contacts || []).map((c) =>
              c.id === contact.id || c.name === contact.name
                ? { ...c, ...data.contact, isEnriched: true }
                : c
            );
            return {
              ...lead,
              decisionMaker: { ...data.contact, isEnriched: true },
              contacts: updatedContacts,
              emailDraft: data.outreachDraft || lead.emailDraft,
            };
          })
        );
        setScoutToast({
          message: `Enriched ${data.contact.name}! Verified contact dossier active.`,
          type: 'success',
        });
        if (soundEnabled) playSound('streak');
        triggerConfetti();
      } else {
        setScoutToast({
          message: data.error || 'Contact enrichment could not find verified match.',
          type: 'error',
        });
      }
    } catch (err) {
      console.error('Error enriching contact:', err);
      setScoutToast({
        message: 'Could not connect to enrichment service.',
        type: 'error',
      });
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSwipe('approve');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSwipe('pass');
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (leads.length > 0) {
          setEditingLead(leads[0]);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        if (leads.length === 0) {
          handleReset();
        }
      } else if (e.key === '?') {
        setHelpOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe, handleUndo, leads]);

  const activeLead = leads[0] || null;
  const legalPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') : '';
  if (legalPath === '/privacy' || legalPath === '/terms') {
    return <LegalPage page={legalPath === '/privacy' ? 'privacy' : 'terms'} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 relative">
      {/* Toast Notification */}
      {scoutToast && (
        <div className="fixed top-20 right-6 z-50 animate-bounce transition-all">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border shadow-lg text-xs font-medium ${
              scoutToast.type === 'success'
                ? 'bg-white border-emerald-300 text-emerald-800'
                : scoutToast.type === 'error'
                ? 'bg-white border-rose-300 text-rose-800'
                : 'bg-white border-blue-300 text-slate-800'
            }`}
          >
            {scoutToast.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : scoutToast.type === 'info' ? (
              <Radio className="w-4 h-4 text-blue-600 animate-spin" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600" />
            )}
            <span>{scoutToast.message}</span>
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Header
        stats={stats}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((prev) => !prev)}
        onOpenHelp={() => setHelpOpen(true)}
        onOpenUpgrade={() => setUpgradeModalOpen(true)}
        onOpenGhlSettings={() => setGhlSettingsOpen(true)}
        onOpenAdmin={() => setAdminModalOpen(true)}
        onOpenMakeNews={() => setMakeNewsModalOpen(true)}
        isGhlConnected={userProfile?.isGhlConnected}
        onScoutNews={handleScoutNews}
        isScouting={isScouting}
        serverOnline={serverOnline}
        user={userProfile}
        onOpenAuth={(mode = 'login') => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onOpenOnboarding={() => {
          const current = campaigns.find((c) => c.id === activeCampaignId) || campaigns[0] || null;
          if (current) {
            handleOpenEditCampaign(current);
          } else {
            handleOpenCreateCampaign();
          }
        }}
        currentView={currentView}
        onNavigate={handleNavigate}
        leadsCount={leads.length}
        contactsCount={stats.approvedCount}
      />

      {currentView === 'landing' ? (
        <LandingPage
          onLaunchDeck={handleLaunchDeck}
          onOpenAuth={(mode = 'signup') => {
            setAuthModalMode(mode);
            setAuthModalOpen(true);
          }}
          onOpenUpgrade={() => setUpgradeModalOpen(true)}
          user={userProfile}
          leads={leads}
          onSwipe={handleSwipe}
          onOpenPitchEditor={(lead) => setEditingLead(lead)}
          onOpenBranchOut={(lead) => setBranchModalLead(lead)}
          onReset={handleReset}
          stats={stats}
          isCrmConnected={Boolean(userProfile?.hasCustomGhlKey || userProfile?.isGhlConnected)}
          onOpenCrmSettings={() => setGhlSettingsOpen(true)}
        />
      ) : currentView === 'profile' ? (
        <ProfilePage
          user={userProfile}
          onProfileUpdated={(updated) => {
            setUserProfile((prev) => (prev ? { ...prev, ...updated } : updated));
            fetchCampaigns();
            fetchUserProfile();
          }}
          onOpenCrmSettings={() => setGhlSettingsOpen(true)}
          onOpenMakeNews={() => setMakeNewsModalOpen(true)}
          onNavigateDeck={() => handleNavigate('deck')}
        />
      ) : currentView === 'contacts' ? (
        <ContactsPage
          user={userProfile}
          campaigns={campaigns}
          activeCampaignId={activeCampaignId}
          onNavigateDeck={handleLaunchDeck}
          onOpenCrmSettings={() => setGhlSettingsOpen(true)}
        />
      ) : (
        <>
          {/* Progress & Deck Status HUD */}
          <StatsBar
            stats={stats}
            canUndo={history.length > 0}
            onUndo={handleUndo}
            onReset={handleReset}
            totalCards={Math.max(leads.length + stats.approvedCount + stats.passedCount, 1)}
            campaigns={campaigns}
            activeCampaignId={activeCampaignId || undefined}
            onSelectCampaign={handleSelectCampaign}
            onCreateNewCampaign={handleOpenCreateCampaign}
            onEditCampaign={handleOpenEditCampaign}
            onNavigateToContacts={() => handleNavigate('contacts')}
          />

          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col">
            {isLoading && (
              <div className="flex items-center justify-center py-2 text-xs text-slate-500 gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                Syncing cards from Cloudflare D1 deck...
              </div>
            )}

            {stats.creditsRemaining < 10 && (
              <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    <strong>Low Credit Balance:</strong> You have {stats.creditsRemaining} credits left (minimum 10 credits required per approved lead).
                  </span>
                </div>
                <button
                  onClick={() => setUpgradeModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold transition-all shadow-xs"
                >
                  Top Up
                </button>
              </div>
            )}

            <div className="flex-1 w-full max-w-6xl mx-auto flex flex-col items-center">
              <DeckView
                leads={leads}
                onSwipe={handleSwipe}
                onOpenPitchEditor={(lead) => setEditingLead(lead)}
                onSelectForDetail={(lead) => setMobileDetailLead(lead)}
                onReset={handleReset}
                onScoutNews={handleScoutNews}
                isScouting={isScouting}
                onOpenBranchOut={(lead) => setBranchModalLead(lead)}
                onSelectContact={handleSelectContact}
                onEnrichContact={handleEnrichContact}
              />

              {/* Deck Action Controls */}
              {leads.length > 0 && (
                <div className="w-full max-w-6xl mt-4">
                  <ActionControls
                    onAction={handleSwipe}
                    onEditPitch={() => activeLead && setEditingLead(activeLead)}
                    disabled={leads.length === 0}
                    creditBalance={stats.creditsRemaining}
                    onUpgradePrompt={() => setUpgradeModalOpen(true)}
                    isCrmConnected={Boolean(userProfile?.hasCustomGhlKey || userProfile?.isGhlConnected)}
                    isDemo={!userProfile}
                    onOpenCrmSettings={() => setGhlSettingsOpen(true)}
                  />
                </div>
              )}
            </div>
          </main>
        </>
      )}

      {/* Mobile Drawer/Modal for Full Context Details */}
      {mobileDetailLead && (
        <div className="fixed inset-0 z-50 md:hidden bg-slate-900/60 backdrop-blur-xs p-4 flex flex-col justify-end">
          <div className="h-[85vh] w-full">
            <LeadDetailPane
              lead={mobileDetailLead}
              user={userProfile}
              onSwipe={(action) => {
                handleSwipe(action);
                setMobileDetailLead(null);
              }}
              onUpdateDraft={handleUpdateDraft}
              onCloseMobileModal={() => setMobileDetailLead(null)}
              isMobileModal={true}
              creditBalance={stats.creditsRemaining}
              onUpgradePrompt={() => setUpgradeModalOpen(true)}
              onOpenBranchOut={(lead) => setBranchModalLead(lead)}
              isCrmConnected={Boolean(userProfile?.hasCustomGhlKey || userProfile?.isGhlConnected)}
              onOpenCrmSettings={() => setGhlSettingsOpen(true)}
            />
          </div>
        </div>
      )}

      {/* Quick Pitch Customization Modal */}
      <PitchEditorModal
        lead={editingLead}
        user={userProfile}
        isOpen={!!editingLead}
        onClose={() => setEditingLead(null)}
        onSaveAndApprove={handleSaveAndApprove}
        onUpdateDraft={handleUpdateDraft}
      />

      {/* Credit Upgrade & Top-Up Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        currentCredits={stats.creditsRemaining}
        onReplenishDevCredits={handleReplenishDevCredits}
      />

      {/* CRM Sub-Account Configuration Modal */}
      <GhlSettingsModal
        isOpen={ghlSettingsOpen}
        onClose={() => setGhlSettingsOpen(false)}
        userProfile={userProfile}
        onProfileUpdated={(updated) => {
          setUserProfile((prev) => (prev ? { ...prev, ...updated } : updated));
          setStats((prev) => ({
            ...prev,
            creditsRemaining: updated.creditBalance,
            streak: updated.streakCount,
            totalPoints: updated.totalPoints,
          }));
        }}
      />

      {/* Make News & Multi-Channel Social Broadcast Modal */}
      <MakeNewsModal
        isOpen={makeNewsModalOpen}
        onClose={() => setMakeNewsModalOpen(false)}
        user={userProfile}
        onNewsPublished={() => {
          fetchDeck(undefined, activeCampaignId || undefined);
          fetchUserProfile();
        }}
      />

      {/* Branch Out Knowledge Graph & Lead Multiplier Modal */}
      <BranchOutModal
        lead={branchModalLead}
        isOpen={!!branchModalLead}
        onClose={() => setBranchModalLead(null)}
        creditBalance={stats.creditsRemaining}
        onBranchScouted={handleBranchScouted}
        onOpenUpgrade={() => setUpgradeModalOpen(true)}
      />

      {/* Authentication Modal (Sign In & Register) */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* ICP Targeting & Multi-Campaign Modal */}
      <OnboardingModal
        isOpen={campaignModalOpen || onboardingOpen}
        user={userProfile}
        campaign={selectedCampaignForEdit}
        mode={campaignModalMode}
        onComplete={handleCampaignModalComplete}
        onClose={() => {
          setCampaignModalOpen(false);
          setOnboardingOpen(false);
        }}
      />

      {/* Help & Keyboard Shortcuts Modal */}
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* System Administrator Console */}
      <AdminModal
        isOpen={adminModalOpen}
        onClose={() => setAdminModalOpen(false)}
        currentUserEmail={userProfile?.email}
      />
    </div>
  );
};

export default App;
