'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Headphones,
  CreditCard,
  Plus,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Trash2,
  Check,
  Lock,
} from 'lucide-react';

interface SystemRole {
  key: string;
  name: string;
  responsibilities: string;
  description: string;
}

interface PlatformUser {
  id: string;
  identityId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isSuperAdmin: boolean;
  status: string;
  createdAt: string;
}

const ROLE_METADATA: Record<
  string,
  { icon: any; variant: 'accent' | 'secondary' | 'outline'; color: string; badge: string }
> = {
  PLATFORM_SUPER_ADMIN: {
    icon: ShieldCheck,
    variant: 'accent',
    color: 'text-accent',
    badge: 'Full SaaS Control',
  },
  SUPER_ADMIN: {
    icon: ShieldCheck,
    variant: 'accent',
    color: 'text-accent',
    badge: 'Full SaaS Control',
  },
  PLATFORM_SUPPORT_ADMIN: {
    icon: Headphones,
    variant: 'secondary',
    color: 'text-blue-500',
    badge: 'Troubleshooting & Logs',
  },
  PLATFORM_FINANCE_ADMIN: {
    icon: CreditCard,
    variant: 'secondary',
    color: 'text-emerald-500',
    badge: 'Billing & Subscriptions',
  },
};

const SYSTEM_ROLES_DEFAULT: SystemRole[] = [
  {
    key: 'PLATFORM_SUPER_ADMIN',
    name: 'Platform Super Admin',
    responsibilities: 'Manage entire SaaS platform',
    description: 'Full administrative governance over tenant organizations, schema provisioning, business profiles, and global platform security.',
  },
  {
    key: 'PLATFORM_SUPPORT_ADMIN',
    name: 'Platform Support Admin',
    responsibilities: 'Customer support and troubleshooting',
    description: 'Operational troubleshooting, tenant health inspections, error diagnosis, and user incident resolution without financial alterations.',
  },
  {
    key: 'PLATFORM_FINANCE_ADMIN',
    name: 'Platform Finance Admin',
    responsibilities: 'Subscription and payment management',
    description: 'Monitors platform revenue, billing transactions, subscription renewals, invoices, and payment provider integrations.',
  },
];

export default function SystemRolesPage() {
  const [roles, setRoles] = useState<SystemRole[]>(SYSTEM_ROLES_DEFAULT);
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Invite modal form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [invitePassword, setInvitePassword] = useState('Password@123');
  const [inviteRole, setInviteRole] = useState('PLATFORM_SUPER_ADMIN');

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ roles: SystemRole[]; users: PlatformUser[] }>('/platform/system-roles');
      if (res.roles?.length) setRoles(res.roles);
      if (res.users) setUsers(res.users);
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Could not load system roles',
        message: err.message || 'Failed to fetch platform user directory',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast({ type: 'warning', title: 'Email required', message: 'Enter a valid email address.' });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/platform/system-roles/users', {
        method: 'POST',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          firstName: inviteFirstName.trim(),
          lastName: inviteLastName.trim(),
          password: invitePassword,
          role: inviteRole,
        }),
      });
      toast({
        type: 'success',
        title: 'Platform Administrator Added',
        message: `${inviteEmail} assigned role ${inviteRole}.`,
      });
      setIsModalOpen(false);
      setInviteEmail('');
      setInviteFirstName('');
      setInviteLastName('');
      setInvitePassword('Password@123');
      await loadData();
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Operation failed',
        message: err.message || 'Could not create platform user',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (user: PlatformUser) => {
    const nextStatus = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await apiFetch(`/platform/system-roles/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      toast({
        type: 'success',
        title: 'Status Updated',
        message: `${user.email} is now ${nextStatus}.`,
      });
      await loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Update failed', message: err.message });
    }
  };

  const handleDeleteUser = async (user: PlatformUser) => {
    if (!window.confirm(`Are you sure you want to remove platform administrator "${user.email}"?`)) {
      return;
    }
    try {
      await apiFetch(`/platform/system-roles/users/${user.id}`, {
        method: 'DELETE',
      });
      toast({
        type: 'success',
        title: 'Admin Removed',
        message: `${user.email} removed from platform administration.`,
      });
      await loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Delete failed', message: err.message });
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.email.toLowerCase().includes(q) ||
      (u.firstName && u.firstName.toLowerCase().includes(q)) ||
      (u.lastName && u.lastName.toLowerCase().includes(q)) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-semibold text-text-primary tracking-[-0.01em]">
              2.1 SYSTEM-LEVEL ROLES
            </h1>
            <Badge variant="accent" size="sm">Platform Super Admin</Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1 max-w-2xl">
            Platform governance structure defining System-Level Roles, their operational responsibilities,
            and authorized platform administrators.
          </p>
        </div>

        {/* Action Button */}
        <Button
          type="button"
          variant="primary"
          onClick={() => setIsModalOpen(true)}
          icon={<Plus className="w-4 h-4" />}
          className="shadow-sm"
        >
          Invite Platform Admin
        </Button>
      </div>

      {/* 2.1 SYSTEM-LEVEL ROLES CARDS (Exact match to SRS 2.1) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((r) => {
          const meta = ROLE_METADATA[r.key] || {
            icon: ShieldCheck,
            color: 'text-accent',
            badge: 'System Role',
          };
          const Icon = meta.icon;
          const assignedCount = users.filter((u) => u.role === r.key || (r.key === 'PLATFORM_SUPER_ADMIN' && u.role === 'SUPER_ADMIN')).length;

          return (
            <div
              key={r.key}
              className="macos-card p-4.5 space-y-3 border border-border/80 hover:border-accent/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="w-9 h-9 rounded-lg bg-surface-secondary border border-border flex items-center justify-center">
                  <Icon className={`w-5 h-5 ${meta.color}`} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-surface-secondary text-text-secondary border border-border/60">
                  {meta.badge}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-text-primary">{r.name}</h3>
                <div className="p-2 rounded bg-surface-secondary/50 border border-border/60">
                  <span className="text-[10px] uppercase font-bold text-text-tertiary block tracking-wider">
                    Responsibilities
                  </span>
                  <span className="text-xs font-medium text-text-primary">
                    {r.responsibilities}
                  </span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed pt-1">
                  {r.description}
                </p>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-text-tertiary">
                <span>Active Admins</span>
                <span className="font-semibold text-text-primary font-mono">{assignedCount} assigned</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* PLATFORM ADMINISTRATORS DIRECTORY */}
      <div className="macos-card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-text-secondary" />
            <h3 className="text-sm font-semibold text-text-primary">
              Platform Administrators Directory ({users.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border/80 rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-text-tertiary font-mono">
            Loading platform administrators...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-xs text-text-tertiary">
            No platform administrators found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border/80 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  <th className="py-2.5 px-3">Administrator</th>
                  <th className="py-2.5 px-3">System-Level Role</th>
                  <th className="py-2.5 px-3">Assigned Responsibilities</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Created</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-xs">
                {filteredUsers.map((user) => {
                  const roleObj = roles.find((r) => r.key === user.role || (r.key === 'PLATFORM_SUPER_ADMIN' && user.role === 'SUPER_ADMIN'));
                  const roleName = roleObj?.name || user.role;
                  const responsibilities = roleObj?.responsibilities || 'Manage SaaS operations';

                  return (
                    <tr key={user.id} className="hover:bg-surface-secondary/40 transition-colors">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-semibold text-xs shrink-0">
                            {(user.firstName || user.email).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-text-primary">
                              {user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.email.split('@')[0]}
                            </p>
                            <p className="text-[11px] text-text-secondary font-mono">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-medium text-text-primary inline-flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                          {roleName}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-text-secondary">
                        <span className="text-[11px] bg-surface-secondary px-2 py-0.5 rounded border border-border/50">
                          {responsibilities}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                            user.status === 'ACTIVE'
                              ? 'bg-success/10 text-success'
                              : 'bg-danger/10 text-danger'
                          }`}
                        >
                          {user.status === 'ACTIVE' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {user.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-[11px] text-text-tertiary">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(user)}
                            className="px-2 py-1 text-[11px] font-medium rounded border border-border hover:bg-surface-secondary transition-colors"
                          >
                            {user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(user)}
                            aria-label={`Remove ${user.email}`}
                            className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INVITE PLATFORM ADMINISTRATOR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-surface-secondary/40">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-text-primary">
                  Invite Platform Administrator
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-7 h-7 rounded flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <Input
                label="Email Address *"
                type="email"
                placeholder="admin@nirvagam.com"
                value={inviteEmail}
                required
                onChange={(e) => setInviteEmail(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="First Name"
                  placeholder="First name"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                />
                <Input
                  label="Last Name"
                  placeholder="Last name"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                />
              </div>

              <Select
                label="Select System-Level Role *"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="PLATFORM_SUPER_ADMIN">Platform Super Admin (Manage entire SaaS platform)</option>
                <option value="PLATFORM_SUPPORT_ADMIN">Platform Support Admin (Customer support & troubleshooting)</option>
                <option value="PLATFORM_FINANCE_ADMIN">Platform Finance Admin (Subscription & payment management)</option>
              </Select>

              <Input
                label="Initial Password *"
                type="password"
                value={invitePassword}
                required
                onChange={(e) => setInvitePassword(e.target.value)}
              />

              <div className="p-3 bg-surface-secondary rounded border border-border text-[11px] text-text-secondary space-y-1">
                <p className="font-semibold text-text-primary flex items-center gap-1">
                  <Lock className="w-3 h-3 text-accent" /> Isolated Platform Security
                </p>
                <p>
                  Platform administrators live strictly in the global platform schema and never appear in any tenant's
                  business member list.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={submitting}
                  icon={<Check className="w-3.5 h-3.5" />}
                >
                  Create Platform Admin
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
