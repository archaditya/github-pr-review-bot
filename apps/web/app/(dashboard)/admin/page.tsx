'use client';

import { useState } from 'react';
import {
  ShieldCheck,
  Users,
  UserCheck,
  UserX,
  AlertCircle,
  Sliders,
  CheckCircle2,
  XCircle,
  Key,
  Search,
  RefreshCw,
  GitPullRequest,
  Share2,
} from 'lucide-react';
import {
  useAdminUsers,
  useAdminStats,
  useUpdateUserStatus,
  useUpdateUserRole,
  useUpdateUserFeatures,
} from '@/hooks/use-admin';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import type { User, UserFeatures } from '@/types/api';

export default function AdminDashboardPage() {
  const { data: currentUser } = useCurrentUser();
  const { data: users, isLoading: usersLoading, refetch } = useAdminUsers();
  const { data: stats, isLoading: statsLoading } = useAdminStats();

  const updateStatus = useUpdateUserStatus();
  const updateRole = useUpdateUserRole();
  const updateFeatures = useUpdateUserFeatures();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [modalFeatures, setModalFeatures] = useState<UserFeatures>({});

  if (currentUser && currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="rounded-full bg-red-500/10 p-4 mb-4">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold font-mono">Restricted Access</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-md">
          This area is reserved for the primary system administrator. If you believe this is a mistake, contact Aditya.
        </p>
      </div>
    );
  }

  function openEditModal(user: User) {
    setSelectedUserForEdit(user);
    setModalFeatures(user.features || {
      can_review_prs: true,
      can_repo_chat: true,
      can_social_studio: true,
      allowed_social_platforms: ['linkedin', 'instagram', 'facebook'],
      social_monthly_quota: 20,
      ai_provider_mode: 'byok_only',
    });
  }

  async function handleSaveFeatures() {
    if (!selectedUserForEdit) return;
    await updateFeatures.mutateAsync({
      id: selectedUserForEdit.id,
      features: modalFeatures,
    });
    setSelectedUserForEdit(null);
  }

  const filteredUsers = (users || []).filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      String(u.githubUserId).includes(q)
    );
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-2xl font-bold tracking-tight">Admin & Multi-Tenant Control</h1>
            <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-xs font-semibold text-amber-500 border border-amber-500/30">
              SUPERADMIN
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage user approval, toggle BYOK vs Managed modes, allocate individual feature entitlements and set social quotas.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 self-start">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono uppercase">Total Users</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2">
            {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.users.total ?? 0}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono uppercase">Active</span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-emerald-400">
            {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.users.active ?? 0}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono uppercase">Suspended</span>
            <UserX className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-red-400">
            {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.users.suspended ?? 0}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-mono uppercase">Total Reviews</span>
            <GitPullRequest className="h-4 w-4 text-blue-400" />
          </div>
          <p className="text-2xl font-bold font-mono mt-2 text-foreground">
            {statsLoading ? <Skeleton className="h-8 w-12" /> : stats?.counts.reviews ?? 0}
          </p>
        </div>
      </div>

      {/* User Directory */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-semibold">User Directory & Feature Allocations</h2>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, ID..."
              className="w-full rounded-md border border-border bg-background py-1.5 pl-8 pr-3 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>

        {usersLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Users}
              title="No users found"
              description="No registered users matched your search criteria."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-accent/40 font-mono text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">BYOK OpenAI Key</th>
                  <th className="py-3 px-4">Entitlements</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-sans">
                {filteredUsers.map((u) => {
                  const isCurrent = u.id === currentUser?.id;
                  const hasKey = Boolean(u.hasOpenaiKey);

                  return (
                    <tr key={u.id} className="hover:bg-accent/20 transition-colors">
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-foreground">{u.name || 'Anonymous User'}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">
                          ID: {u.githubUserId} {u.email ? `• ${u.email}` : ''}
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3.5 px-4 font-mono">
                        <button
                          disabled={isCurrent}
                          onClick={() =>
                            updateRole.mutate({
                              id: u.id,
                              role: u.role === 'admin' ? 'user' : 'admin',
                            })
                          }
                          className={`rounded px-2 py-0.5 font-semibold text-[10px] uppercase transition-colors ${
                            u.role === 'admin'
                              ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                              : 'bg-muted text-muted-foreground hover:bg-accent'
                          }`}
                          title={isCurrent ? 'Cannot demote self' : 'Click to toggle Admin/User'}
                        >
                          {u.role}
                        </button>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 font-mono">
                        <select
                          disabled={isCurrent}
                          value={u.status}
                          onChange={(e) =>
                            updateStatus.mutate({
                              id: u.id,
                              status: e.target.value as any,
                            })
                          }
                          className={`rounded border px-2 py-0.5 text-[11px] font-medium bg-background ${
                            u.status === 'active'
                              ? 'border-emerald-500/30 text-emerald-400'
                              : u.status === 'suspended'
                              ? 'border-red-500/30 text-red-400'
                              : 'border-amber-500/30 text-amber-400'
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </td>

                      {/* BYOK Key */}
                      <td className="py-3.5 px-4 font-mono">
                        {hasKey ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {u.maskedOpenaiKey || 'Set'}
                          </span>
                        ) : u.role === 'admin' ? (
                          <span className="text-blue-400 text-[11px]">Managed (Server)</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-3.5 w-3.5 text-amber-500" />
                            Not Set
                          </span>
                        )}
                      </td>

                      {/* Entitlements Badges */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                          {u.features?.can_review_prs !== false && (
                            <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5">PR</span>
                          )}
                          {u.features?.can_repo_chat !== false && (
                            <span className="rounded bg-blue-500/10 text-blue-400 px-1.5 py-0.5">Chat</span>
                          )}
                          {u.features?.can_social_studio !== false && (
                            <span className="rounded bg-pink-500/10 text-pink-400 px-1.5 py-0.5">Social</span>
                          )}
                          {u.features?.allowed_social_platforms?.includes('x') && (
                            <span className="rounded bg-amber-500/10 text-amber-400 px-1.5 py-0.5">𝕏 Allowed</span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditModal(u)}
                          className="h-7 text-xs gap-1"
                        >
                          <Sliders className="h-3 w-3" />
                          Allocate
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feature Allocation Modal */}
      {selectedUserForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-base font-semibold">Allocate Features</h3>
                <p className="text-xs text-muted-foreground">
                  User: <span className="font-mono text-foreground">{selectedUserForEdit.name}</span> ({selectedUserForEdit.githubUserId})
                </p>
              </div>
              <button
                onClick={() => setSelectedUserForEdit(null)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            {/* Feature Toggles */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">PR Code Reviews</p>
                  <p className="text-xs text-muted-foreground">Allow bot to review this user's pull requests</p>
                </div>
                <input
                  type="checkbox"
                  checked={modalFeatures.can_review_prs !== false}
                  onChange={(e) =>
                    setModalFeatures({ ...modalFeatures, can_review_prs: e.target.checked })
                  }
                  className="rounded border-border text-primary h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Interactive Repo Chat</p>
                  <p className="text-xs text-muted-foreground">Allow querying code knowledge graph</p>
                </div>
                <input
                  type="checkbox"
                  checked={modalFeatures.can_repo_chat !== false}
                  onChange={(e) =>
                    setModalFeatures({ ...modalFeatures, can_repo_chat: e.target.checked })
                  }
                  className="rounded border-border text-primary h-4 w-4"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Social Media Studio</p>
                  <p className="text-xs text-muted-foreground">Allow generating and publishing social posts</p>
                </div>
                <input
                  type="checkbox"
                  checked={modalFeatures.can_social_studio !== false}
                  onChange={(e) =>
                    setModalFeatures({ ...modalFeatures, can_social_studio: e.target.checked })
                  }
                  className="rounded border-border text-primary h-4 w-4"
                />
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold uppercase text-muted-foreground font-mono mb-2">
                  Allowed Platforms
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {['linkedin', 'instagram', 'facebook', 'x'].map((platform) => {
                    const current = modalFeatures.allowed_social_platforms || [];
                    const isAllowed = current.includes(platform as any);

                    return (
                      <label key={platform} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isAllowed}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setModalFeatures({
                                ...modalFeatures,
                                allowed_social_platforms: [...current, platform as any],
                              });
                            } else {
                              setModalFeatures({
                                ...modalFeatures,
                                allowed_social_platforms: current.filter((p) => p !== platform),
                              });
                            }
                          }}
                          className="rounded border-border text-primary"
                        />
                        <span className="capitalize">{platform === 'x' ? 'X (Twitter)' : platform}</span>
                        {platform === 'x' && (
                          <span className="text-[10px] text-amber-500 font-mono">PAID</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-border pt-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">AI Provider Mode</p>
                  <p className="text-xs text-muted-foreground">Force BYOK or allow managed server fallback</p>
                </div>
                <select
                  value={modalFeatures.ai_provider_mode || 'byok_only'}
                  onChange={(e) =>
                    setModalFeatures({ ...modalFeatures, ai_provider_mode: e.target.value as any })
                  }
                  className="rounded border border-border bg-background px-2 py-1 text-xs font-mono"
                >
                  <option value="byok_only">BYOK Only</option>
                  <option value="managed">Managed (Admin)</option>
                </select>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button variant="ghost" onClick={() => setSelectedUserForEdit(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveFeatures} disabled={updateFeatures.isPending}>
                {updateFeatures.isPending ? 'Saving...' : 'Save Entitlements'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
