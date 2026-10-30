import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  Users,
  Search,
  Trash2,
  RotateCcw,
  RefreshCw,
  X,
  Database,
  Sliders,
  Check,
  AlertCircle,
  Sparkles,
  TrendingUp,
  MapPin,
  Building,
} from 'lucide-react';
import { ExecutiveAvatar } from './ExecutiveAvatar';

export interface AdminUserRecord {
  id: string;
  email: string;
  name: string;
  organization?: string | null;
  role: 'admin' | 'user';
  isAdmin: boolean;
  avatarUrl?: string | null;
  creditBalance: number;
  streakCount: number;
  totalPoints: number;
  ghlSubaccountId?: string | null;
  hasCustomGhlKey: boolean;
  ghlApiKeyMasked?: string | null;
  targetLocation?: string | null;
  userIntent?: string | null;
  userMission?: string | null;
  targetIndustries?: string[];
  targetTriggers?: string[];
  targetRoles?: string[];
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalCreditsActive: number;
  totalSignalsIngested: number;
  totalLeadsApproved: number;
  totalContactsExtracted: number;
}

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserEmail?: string;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  currentUserEmail,
}) => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all');
  const [toastMessage, setToastMessage] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Credit Adjustment Modal state
  const [selectedUser, setSelectedUser] = useState<AdminUserRecord | null>(null);
  const [creditAmount, setCreditAmount] = useState<number>(500);
  const [creditMode, setCreditMode] = useState<'add' | 'set'>('add');
  const [creditReason, setCreditReason] = useState<string>('Admin grant');
  const [isUpdatingCredit, setIsUpdatingCredit] = useState(false);

  const fetchAdminData = useCallback(async () => {
    const token = localStorage.getItem('twinflow_session_token');
    if (!token) return;

    setIsLoading(true);
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (statsRes.ok) {
        const statsData = (await statsRes.json()) as { success: boolean; stats?: AdminStats };
        if (statsData.success && statsData.stats) {
          setStats(statsData.stats);
        }
      }

      if (usersRes.ok) {
        const usersData = (await usersRes.json()) as { success: boolean; users?: AdminUserRecord[] };
        if (usersData.success && usersData.users) {
          setUsers(usersData.users);
        }
      } else {
        const err = await usersRes.json().catch(() => ({}));
        showToast(err.error || 'Failed to load admin data.', 'error');
      }
    } catch {
      showToast('Network error loading admin console.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchAdminData();
    }
  }, [isOpen, fetchAdminData]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ message, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleAdjustCredits = async () => {
    if (!selectedUser) return;
    const token = localStorage.getItem('twinflow_session_token');
    setIsUpdatingCredit(true);

    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: creditAmount,
          mode: creditMode,
          reason: creditReason,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || 'Credit balance updated successfully.');
        setSelectedUser(null);
        await fetchAdminData();
      } else {
        showToast(data.error || 'Failed to update credits.', 'error');
      }
    } catch {
      showToast('Network error updating credits.', 'error');
    } finally {
      setIsUpdatingCredit(false);
    }
  };

  const handleQuickAddCredits = async (user: AdminUserRecord, amount: number) => {
    const token = localStorage.getItem('twinflow_session_token');
    try {
      const res = await fetch(`/api/admin/users/${user.id}/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount,
          mode: 'add',
          reason: `Quick grant (+${amount})`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Added ${amount} credits to ${user.email}.`);
        await fetchAdminData();
      } else {
        showToast(data.error || 'Failed to add credits.', 'error');
      }
    } catch {
      showToast('Network error adding credits.', 'error');
    }
  };

  const handleToggleRole = async (user: AdminUserRecord) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    const confirmPrompt = window.confirm(
      `Are you sure you want to change ${user.email}'s role to "${nextRole}"?`
    );
    if (!confirmPrompt) return;

    const token = localStorage.getItem('twinflow_session_token');
    try {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: nextRole }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Role for ${user.email} updated to ${nextRole}.`);
        await fetchAdminData();
      } else {
        showToast(data.error || 'Failed to update role.', 'error');
      }
    } catch {
      showToast('Network error updating role.', 'error');
    }
  };

  const handleResetOnboarding = async (user: AdminUserRecord) => {
    const confirmPrompt = window.confirm(
      `Reset onboarding status for ${user.email}? They will be prompted to re-take the ICP questionnaire.`
    );
    if (!confirmPrompt) return;

    const token = localStorage.getItem('twinflow_session_token');
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-onboarding`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Onboarding reset for ${user.email}.`);
        await fetchAdminData();
      } else {
        showToast(data.error || 'Failed to reset onboarding.', 'error');
      }
    } catch {
      showToast('Network error resetting onboarding.', 'error');
    }
  };

  const handleDeleteUser = async (user: AdminUserRecord) => {
    const confirmPrompt = window.confirm(
      `CRITICAL: Permanently delete account for ${user.email} (${user.name})? This cannot be undone.`
    );
    if (!confirmPrompt) return;

    const token = localStorage.getItem('twinflow_session_token');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message || `Deleted user ${user.email}.`);
        await fetchAdminData();
      } else {
        showToast(data.error || 'Failed to delete user.', 'error');
      }
    } catch {
      showToast('Network error deleting user.', 'error');
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesQuery =
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.organization && u.organization.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.targetLocation && u.targetLocation.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesQuery) return false;
    if (roleFilter === 'admin') return u.role === 'admin';
    if (roleFilter === 'user') return u.role !== 'admin';
    return true;
  });

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in"
    >
      <div className="relative w-full max-w-6xl max-h-[92vh] rounded-2xl glass-card border border-white/10 shadow-2xl overflow-hidden flex flex-col bg-[#0B0F17]">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-indigo-950/40 via-purple-950/40 to-slate-950/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-emerald-400 p-[1px] shadow-glow-brand flex-shrink-0">
              <div className="w-full h-full bg-[#0B0F17] rounded-[11px] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-display">TwinFlow Admin Console</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                  Superadmin Access
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Manage registered user accounts, credit balances, and CRM pipeline routing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAdminData}
              disabled={isLoading}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="px-6 py-2.5 bg-indigo-950/80 border-b border-indigo-500/30 flex items-center gap-2 text-xs">
            {toastMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span className={toastMessage.type === 'success' ? 'text-emerald-200' : 'text-rose-200'}>
              {toastMessage.message}
            </span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Vitals Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Total Users</span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{stats.totalUsers}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Active Credits</span>
                </div>
                <div className="text-xl font-bold font-mono text-amber-300">
                  {stats.totalCreditsActive.toLocaleString()}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Ingested Signals</span>
                </div>
                <div className="text-xl font-bold font-mono text-cyan-300">
                  {stats.totalSignalsIngested}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Approved Leads</span>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-300">
                  {stats.totalLeadsApproved}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5">
                <div className="flex items-center gap-1.5 text-slate-400 text-[11px] mb-1">
                  <Database className="w-3.5 h-3.5 text-purple-400" />
                  <span>Dossiers Cached</span>
                </div>
                <div className="text-xl font-bold font-mono text-purple-300">
                  {stats.totalContactsExtracted}
                </div>
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search user, email, org, city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-400 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] text-slate-400">Filter:</span>
              <div className="flex items-center p-1 rounded-xl bg-white/[0.03] border border-white/5 text-xs">
                {(['all', 'admin', 'user'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRoleFilter(mode)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      roleFilter === mode
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {mode === 'all' ? 'All' : `${mode}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-xl border border-white/10 overflow-hidden bg-black/40">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">User & Organization</th>
                    <th className="px-4 py-3">Targeting ICP</th>
                    <th className="px-4 py-3">CRM Workspace</th>
                    <th className="px-4 py-3">Credits</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {isLoading && users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Loading registered accounts from Cloudflare D1...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No users match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isCurrentAdmin = u.email.toLowerCase() === currentUserEmail?.toLowerCase();
                      const isPrimarySuperadmin = u.email.toLowerCase() === 'kevingkday@gmail.com';

                      return (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          {/* User info */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <ExecutiveAvatar
                                name={u.name || u.email}
                                avatarUrl={u.avatarUrl}
                                size="sm"
                                className="w-8 h-8 text-xs"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 font-bold text-white">
                                  <span className="truncate">{u.name || 'Operator'}</span>
                                  {u.role === 'admin' && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-mono">
                                      ADMIN
                                    </span>
                                  )}
                                  {isCurrentAdmin && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-indigo-500/20 text-indigo-300 text-[9px] font-mono">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-400 font-mono truncate">{u.email}</div>
                                {u.organization && (
                                  <div className="text-[10px] text-cyan-300 flex items-center gap-1 mt-0.5">
                                    <Building className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                                    <span className="truncate">{u.organization}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Targeting ICP */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-1 max-w-[200px]">
                              {u.targetLocation ? (
                                <div className="flex items-center gap-1 text-[11px] text-slate-200">
                                  <MapPin className="w-3 h-3 text-cyan-400 flex-shrink-0" />
                                  <span className="truncate">{u.targetLocation}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No location set</span>
                              )}
                              {u.targetIndustries && u.targetIndustries.length > 0 && (
                                <div className="text-[10px] text-slate-400 truncate">
                                  {u.targetIndustries.slice(0, 2).join(', ')}
                                  {u.targetIndustries.length > 2 && ` +${u.targetIndustries.length - 2}`}
                                </div>
                              )}
                              <div className="text-[10px]">
                                {u.onboardingCompleted ? (
                                  <span className="text-emerald-400 font-medium">● ICP Calibrated</span>
                                ) : (
                                  <span className="text-amber-400 font-medium">○ Pending Setup</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* CRM Workspace */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-0.5 font-mono text-[11px]">
                              <div className="text-slate-300 truncate">
                                {u.ghlSubaccountId ? (
                                  <span>{u.ghlSubaccountId.slice(0, 10)}...</span>
                                ) : (
                                  <span className="text-slate-500">None</span>
                                )}
                              </div>
                              <div>
                                {u.hasCustomGhlKey ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                                    <Check className="w-3 h-3" /> Key Live
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
                                    <AlertCircle className="w-3 h-3" /> No Key
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Credits balance */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-1">
                              <div className="font-mono font-bold text-white text-sm">
                                {u.creditBalance.toLocaleString()}{' '}
                                <span className="text-[10px] font-normal text-slate-400">pts</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddCredits(u, 500)}
                                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 text-[10px] font-mono transition-colors"
                                  title="Quick grant 500 credits"
                                >
                                  +500
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setCreditAmount(500);
                                    setCreditMode('add');
                                  }}
                                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-[10px] transition-colors"
                                >
                                  Edit
                                </button>
                              </div>
                            </div>
                          </td>

                          {/* Role */}
                          <td className="px-4 py-3.5">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(u)}
                              disabled={isPrimarySuperadmin}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold font-mono tracking-wider border transition-all ${
                                u.role === 'admin'
                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                              } ${isPrimarySuperadmin ? 'opacity-80 cursor-default' : 'cursor-pointer'}`}
                              title={
                                isPrimarySuperadmin
                                  ? 'Primary System Administrator'
                                  : 'Click to toggle admin/user role'
                              }
                            >
                              {u.role.toUpperCase()}
                            </button>
                          </td>

                          {/* Action controls */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleResetOnboarding(u)}
                                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors"
                                title="Reset Onboarding Questionnaire"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              {!isPrimarySuperadmin && !isCurrentAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-200 transition-colors"
                                  title="Delete User Account"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>
              Primary Superadmin: <strong className="text-white">kevingkday@gmail.com</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close Console
          </button>
        </div>
      </div>

      {/* Credit Adjustment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md rounded-2xl glass-card border border-white/15 p-6 space-y-4 bg-[#0E1522] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Adjust User Credits</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-400">Target User:</span>
                <div className="font-bold text-white">{selectedUser.name || 'User'}</div>
                <div className="text-[11px] font-mono text-slate-400">{selectedUser.email}</div>
                <div className="text-[11px] text-amber-300 font-mono mt-0.5">
                  Current Balance: {selectedUser.creditBalance} credits
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditMode('add')}
                    className={`py-2 rounded-lg border text-center font-semibold transition-all ${
                      creditMode === 'add'
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Add Credits (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditMode('set')}
                    className={`py-2 rounded-lg border text-center font-semibold transition-all ${
                      creditMode === 'set'
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    Set Exact Balance (=)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Amount</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white font-mono text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Audit Reason</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="e.g. Founder promo grant, testing, top-up"
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-indigo-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdjustCredits}
                disabled={isUpdatingCredit}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-500 hover:from-indigo-500 hover:to-emerald-400 text-white text-xs font-bold transition-all shadow-glow-brand"
              >
                {isUpdatingCredit ? 'Updating...' : 'Save Credits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
