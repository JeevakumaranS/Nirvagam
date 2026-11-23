'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, ShieldCheck, Users } from 'lucide-react';

type Role = { key: string; name: string };
type User = { id: string; email: string; firstName: string | null; lastName: string | null; role: string; status: string; createdAt: string };

export default function PlatformAdministratorsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', firstName: '', lastName: '', password: 'Password@123', role: 'PLATFORM_SUPPORT_ADMIN' });
  const { toast } = useToast();

  const load = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<{ users: User[]; roles: Role[] }>('/platform/system-roles');
      setUsers(data.users || []); setRoles(data.roles || []);
    } catch (err: any) { toast({ type: 'error', title: 'Could not load administrators', message: err.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await apiFetch('/platform/system-roles/users', { method: 'POST', body: JSON.stringify(invite) });
      setInviteOpen(false); setInvite({ email: '', firstName: '', lastName: '', password: 'Password@123', role: 'PLATFORM_SUPPORT_ADMIN' });
      toast({ type: 'success', title: 'Platform administrator added', message: 'The selected platform role was assigned.' });
      load();
    } catch (err: any) { toast({ type: 'error', title: 'Unable to add administrator', message: err.message }); }
  };

  const updateStatus = async (user: User) => {
    try { await apiFetch(`/platform/system-roles/users/${user.id}`, { method: 'PUT', body: JSON.stringify({ status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' }) }); load(); }
    catch (err: any) { toast({ type: 'error', title: 'Unable to update status', message: err.message }); }
  };

  if (loading) return <div className="p-8 text-sm text-text-secondary">Loading platform administrators...</div>;
  return <div className="space-y-6 max-w-7xl mx-auto">
    <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-5"><div><div className="flex items-center gap-2.5"><Users className="w-5 h-5 text-accent" /><h1 className="text-[17px] font-semibold text-text-primary">Platform Administrators</h1><Badge variant="accent" size="sm">Account Directory</Badge></div><p className="text-[12px] text-text-secondary mt-1">Manage administrator accounts and assign the configured platform roles.</p></div><Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setInviteOpen(true)}>Add Platform Admin</Button></div>
    <div className="macos-card p-4"><div className="flex items-center gap-2 mb-3"><ShieldCheck className="w-4 h-4 text-text-secondary" /><h2 className="text-sm font-semibold text-text-primary">Administrator accounts ({users.length})</h2></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-[11px] uppercase text-text-secondary"><th className="py-2.5 px-3">Administrator</th><th className="py-2.5 px-3">Platform Role</th><th className="py-2.5 px-3">Status</th><th className="py-2.5 px-3">Created</th><th className="py-2.5 px-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-border/60">{users.map((user) => <tr key={user.id}><td className="py-3 px-3 text-text-primary">{user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.email}<div className="text-[11px] text-text-secondary">{user.email}</div></td><td className="py-3 px-3 text-text-secondary">{roles.find((role) => role.key === user.role)?.name || 'Platform Super Admin'}</td><td className="py-3 px-3"><Badge size="sm" variant={user.status === 'ACTIVE' ? 'success' : 'neutral'}>{user.status}</Badge></td><td className="py-3 px-3 text-text-secondary">{new Date(user.createdAt).toLocaleDateString()}</td><td className="py-3 px-3 text-right"><Button size="sm" variant="secondary" onClick={() => updateStatus(user)}>{user.status === 'ACTIVE' ? 'Suspend' : 'Activate'}</Button></td></tr>)}</tbody></table></div></div>
    {inviteOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"><form onSubmit={createUser} className="w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-xl space-y-4"><div><h2 className="text-base font-semibold text-text-primary">Add Platform Administrator</h2><p className="text-xs text-text-secondary mt-1">Assign one of the configured platform roles.</p></div><div className="grid grid-cols-2 gap-3"><Input label="First name" value={invite.firstName} onChange={(event) => setInvite((value) => ({ ...value, firstName: event.target.value }))} /><Input label="Last name" value={invite.lastName} onChange={(event) => setInvite((value) => ({ ...value, lastName: event.target.value }))} /></div><Input label="Email" type="email" required value={invite.email} onChange={(event) => setInvite((value) => ({ ...value, email: event.target.value }))} /><Input label="Initial password" type="password" required value={invite.password} onChange={(event) => setInvite((value) => ({ ...value, password: event.target.value }))} /><Select label="System-level role" value={invite.role} onChange={(event) => setInvite((value) => ({ ...value, role: event.target.value }))}><option value="PLATFORM_SUPPORT_ADMIN">Platform Support Admin</option><option value="PLATFORM_FINANCE_ADMIN">Platform Finance Admin</option></Select><div className="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" size="sm" variant="secondary" onClick={() => setInviteOpen(false)}>Cancel</Button><Button type="submit" size="sm" variant="primary">Add administrator</Button></div></form></div>}
  </div>;
}
