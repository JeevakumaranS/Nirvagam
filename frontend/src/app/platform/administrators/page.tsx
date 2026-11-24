'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { PasswordInput } from '@/components/ui/password-input';
import { Badge } from '@/components/ui/badge';
import { Plus, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

type Role = { key: string; name: string };
type User = {
  id: string;
  identityId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isSuperAdmin: boolean;
  status: string;
  createdAt: string;
};

const initialInvite = {
  email: '',
  firstName: '',
  lastName: '',
  password: 'Password@123',
  role: 'PLATFORM_SUPPORT_ADMIN',
};

export default function PlatformAdministratorsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(initialInvite);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ users: User[]; roles: Role[] }>('/platform/system-roles');
      setUsers(data.users || []);
      setRoles(data.roles || []);
    } catch (err: any) {
      toast({ type: 'error', title: 'Could not load administrators', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setSaving(true);
      await apiFetch('/platform/system-roles/users', {
        method: 'POST',
        body: JSON.stringify(invite),
      });
      setInviteOpen(false);
      setInvite(initialInvite);
      toast({
        type: 'success',
        title: 'Platform administrator added',
        message: 'The selected platform role was assigned.',
      });
      await load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to add administrator', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (user: User) => {
    try {
      await apiFetch(`/platform/system-roles/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
        }),
      });
      await load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to update status', message: err.message });
    }
  };

  const getRoleName = (roleKey: string) =>
    roles.find((role) => role.key === roleKey)?.name || 'Platform Super Admin';
  const getUserName = (user: User) =>
    user.firstName || user.lastName
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
      : user.email;
  const isSuperAdmin = (user: User) =>
    user.isSuperAdmin || ['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const visibleUsers = users.filter(
    (user) => !isSuperAdmin(user) || user.identityId === currentUser?.id
  );
  const assignableRoles = roles.filter(
    (role) => !['SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN'].includes(role.key)
  );

  if (loading) {
    return <div className="p-5 text-sm text-text-secondary">Loading platform administrators...</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 border-b border-border/80 pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <Users className="h-5 w-5 shrink-0 text-accent" />
            <h1 className="text-lg font-semibold text-text-primary">Platform Administrators</h1>
            <Badge variant="accent" size="sm">Account Directory</Badge>
          </div>
          <p className="mt-1 text-[12px] text-text-secondary">
            Manage administrator accounts and assign the configured platform roles.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          icon={<Plus className="h-3.5 w-3.5" />}
          className="w-full lg:w-auto"
          onClick={() => setInviteOpen(true)}
        >
          Add Platform Admin
        </Button>
      </div>

      <section className="macos-card rounded-xl p-3 sm:p-4">
        <div className="mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-text-secondary" />
          <h2 className="text-sm font-semibold text-text-primary">
            Administrator accounts ({visibleUsers.length})
          </h2>
        </div>

        <div className="space-y-3 lg:hidden">
          {visibleUsers.length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-sm text-text-secondary">
              No platform administrators found.
            </p>
          ) : (
            visibleUsers.map((user) => (
              <article key={user.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{getUserName(user)}</p>
                    <p className="break-all text-xs text-text-secondary">{user.email}</p>
                  </div>
                  <Badge
                    size="sm"
                    variant={user.status === 'ACTIVE' ? 'success' : 'neutral'}
                  >
                    {user.status}
                  </Badge>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border/70 pt-3 text-xs">
                  <div className="min-w-0">
                    <dt className="text-text-tertiary">Platform role</dt>
                    <dd className="mt-0.5 truncate text-text-primary">{getRoleName(user.role)}</dd>
                  </div>
                  <div>
                    <dt className="text-text-tertiary">Created</dt>
                    <dd className="mt-0.5 text-text-primary">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full"
                  disabled={isSuperAdmin(user)}
                  title={
                    isSuperAdmin(user)
                      ? 'Super administrator accounts cannot be suspended'
                      : undefined
                  }
                  onClick={() => updateStatus(user)}
                >
                  {isSuperAdmin(user)
                    ? 'Protected'
                    : user.status === 'ACTIVE'
                      ? 'Suspend'
                      : 'Activate'}
                </Button>
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          {visibleUsers.length === 0 ? (
            <p className="rounded-lg border border-border p-4 text-sm text-text-secondary">
              No platform administrators found.
            </p>
          ) : (
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase text-text-secondary">
                  <th className="px-3 py-2.5">Administrator</th>
                  <th className="px-3 py-2.5">Platform Role</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Created</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visibleUsers.map((user) => (
                  <tr key={user.id}>
                    <td className="px-3 py-3 text-text-primary">
                      {getUserName(user)}
                      <div className="text-[11px] text-text-secondary">{user.email}</div>
                    </td>
                    <td className="px-3 py-3 text-text-secondary">{getRoleName(user.role)}</td>
                    <td className="px-3 py-3">
                      <Badge
                        size="sm"
                        variant={user.status === 'ACTIVE' ? 'success' : 'neutral'}
                      >
                        {user.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-text-secondary">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isSuperAdmin(user)}
                        title={
                          isSuperAdmin(user)
                            ? 'Super administrator accounts cannot be suspended'
                            : undefined
                        }
                        onClick={() => updateStatus(user)}
                      >
                        {isSuperAdmin(user)
                          ? 'Protected'
                          : user.status === 'ACTIVE'
                            ? 'Suspend'
                            : 'Activate'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {inviteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/30 p-3 sm:p-4"
          onClick={() => !saving && setInviteOpen(false)}
        >
          <form
            onSubmit={createUser}
            onClick={(event) => event.stopPropagation()}
            className="my-auto max-h-[92dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-xl border border-border bg-surface p-4 shadow-xl sm:p-5"
          >
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                Add Platform Administrator
              </h2>
              <p className="mt-1 text-xs text-text-secondary">
                Assign one of the configured platform roles.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="First name"
                value={invite.firstName}
                onChange={(event) =>
                  setInvite((value) => ({ ...value, firstName: event.target.value }))
                }
              />
              <Input
                label="Last name"
                value={invite.lastName}
                onChange={(event) =>
                  setInvite((value) => ({ ...value, lastName: event.target.value }))
                }
              />
            </div>
            <Input
              label="Email"
              type="email"
              required
              value={invite.email}
              onChange={(event) => setInvite((value) => ({ ...value, email: event.target.value }))}
            />
            <PasswordInput
              label="Initial password"
              placeholder="Create a temporary platform admin password"
              required
              value={invite.password}
              onChange={(event) =>
                setInvite((value) => ({ ...value, password: event.target.value }))
              }
            />
            <Select
              label="System-level role"
              value={invite.role}
              onChange={(event) => setInvite((value) => ({ ...value, role: event.target.value }))}
            >
              {assignableRoles.map((role) => (
                <option key={role.key} value={role.key}>
                  {role.name}
                </option>
              ))}
            </Select>
            <div className="flex flex-col-reverse justify-end gap-2 border-t border-border pt-3 sm:flex-row">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full sm:w-auto"
                disabled={saving}
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                className="w-full sm:w-auto"
                loading={saving}
              >
                Add administrator
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
