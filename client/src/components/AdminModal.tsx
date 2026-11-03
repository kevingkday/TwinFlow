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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="relative w-full max-w-6xl max-h-[92vh] rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col text-slate-800">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 font-display">TwinFlow Admin Console</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                  Superadmin Access
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Manage registered user accounts, credit balances, and CRM pipeline routing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchAdminData}
              disabled={isLoading}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Toast Alert */}
        {toastMessage && (
          <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-xs">
            {toastMessage.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span className={toastMessage.type === 'success' ? 'text-emerald-900' : 'text-rose-900'}>
              {toastMessage.message}
            </span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          {/* Top Vitals Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Total Users</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">{stats.totalUsers}</div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span>Active Credits</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {stats.totalCreditsActive.toLocaleString()}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                  <span>Ingested Signals</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
                  {stats.totalSignalsIngested}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Approved Leads</span>
                </div>
                <div className="text-xl font-bold font-mono text-emerald-700">
                  {stats.totalLeadsApproved}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <span>Dossiers Cached</span>
                </div>
                <div className="text-xl font-bold font-mono text-slate-900">
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
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-[11px] text-slate-500">Filter:</span>
              <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                {(['all', 'admin', 'user'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRoleFilter(mode)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      roleFilter === mode
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode === 'all' ? 'All' : `${mode}s`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Users Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">User & Organization</th>
                    <th className="px-4 py-3">Targeting ICP</th>
                    <th className="px-4 py-3">CRM Workspace</th>
                    <th className="px-4 py-3">Credits</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
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
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
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
                                <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                  <span className="truncate">{u.name || 'Operator'}</span>
                                  {u.role === 'admin' && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-mono">
                                      ADMIN
                                    </span>
                                  )}
                                  {isCurrentAdmin && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[9px] font-mono">
                                      YOU
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-mono truncate">{u.email}</div>
                                {u.organization && (
                                  <div className="text-[10px] text-blue-600 flex items-center gap-1 mt-0.5">
                                    <Building className="w-3 h-3 text-blue-500 flex-shrink-0" />
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
                                <div className="flex items-center gap-1 text-[11px] text-slate-800">
                                  <MapPin className="w-3 h-3 text-blue-600 flex-shrink-0" />
                                  <span className="truncate">{u.targetLocation}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">No location set</span>
                              )}
                              {u.targetIndustries && u.targetIndustries.length > 0 && (
                                <div className="text-[10px] text-slate-500 truncate">
                                  {u.targetIndustries.slice(0, 2).join(', ')}
                                  {u.targetIndustries.length > 2 && ` +${u.targetIndustries.length - 2}`}
                                </div>
                              )}
                              <div className="text-[10px]">
                                {u.onboardingCompleted ? (
                                  <span className="text-emerald-700 font-medium">● ICP Calibrated</span>
                                ) : (
                                  <span className="text-amber-700 font-medium">○ Pending Setup</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* CRM Workspace */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-0.5 font-mono text-[11px]">
                              <div className="text-slate-800 truncate">
                                {u.ghlSubaccountId ? (
                                  <span>{u.ghlSubaccountId.slice(0, 10)}...</span>
                                ) : (
                                  <span className="text-slate-400">None</span>
                                )}
                              </div>
                              <div>
                                {u.hasCustomGhlKey ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold">
                                    <Check className="w-3 h-3 text-emerald-600" /> Key Live
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-700">
                                    <AlertCircle className="w-3 h-3 text-amber-600" /> No Key
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Credits balance */}
                          <td className="px-4 py-3.5">
                            <div className="space-y-1">
                              <div className="font-mono font-bold text-slate-900 text-sm">
                                {u.creditBalance.toLocaleString()}{' '}
                                <span className="text-[10px] font-normal text-slate-500">pts</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddCredits(u, 500)}
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 text-[10px] font-mono transition-colors"
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
                                  className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] transition-colors"
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
                                  ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-950'
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
                                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-blue-600 transition-colors"
                                title="Reset Onboarding Questionnaire"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>

                              {!isPrimarySuperadmin && !isCurrentAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors"
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
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>
              Primary Superadmin: <strong className="text-slate-800">kevingkday@gmail.com</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold transition-colors shadow-2xs"
          >
            Close Console
          </button>
        </div>
      </div>

      {/* Credit Adjustment Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 space-y-4 shadow-2xl text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">Adjust User Credits</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500">Target User:</span>
                <div className="font-bold text-slate-900">{selectedUser.name || 'User'}</div>
                <div className="text-[11px] font-mono text-slate-500">{selectedUser.email}</div>
                <div className="text-[11px] text-blue-700 font-mono mt-0.5">
                  Current Balance: {selectedUser.creditBalance} credits
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreditMode('add')}
                    className={`py-2 rounded-lg border text-center font-semibold transition-all ${
                      creditMode === 'add'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Add Credits (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreditMode('set')}
                    className={`py-2 rounded-lg border text-center font-semibold transition-all ${
                      creditMode === 'set'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Set Exact Balance (=)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">Amount</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 mb-1 font-semibold">Audit Reason</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="e.g. Founder promo grant, testing, top-up"
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAdjustCredits}
                disabled={isUpdatingCredit}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-all shadow-xs"
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
