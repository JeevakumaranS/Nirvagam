'use client';

import React, { useEffect,useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ChevronRight, CreditCard, Headphones, Shield } from 'lucide-react';

type Role = { id: string; key: string; name: string; description: string; assignedCount: number };
type Permission = { id: string; key: string; category: string; label: string };

const roleMeta: Record<string, { icon: any; color: string }> = {
  PLATFORM_SUPPORT_ADMIN: { icon: Headphones, color: 'text-blue-500' },
  PLATFORM_FINANCE_ADMIN: { icon: CreditCard, color: 'text-emerald-500' },
};

export default function SystemRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{ roles: Role[]; permissions: Permission[]; rolePermissions: { key: string; permissionId: string }[] }>('/platform/system-roles');
        const mapped: Record<string, string[]> = {};
        (data.roles || []).forEach((role) => { mapped[role.key] = []; });
        (data.rolePermissions || []).forEach((item) => { (mapped[item.key] ||= []).push(item.permissionId); });
        setRoles(data.roles || []); setPermissions(data.permissions || []); setRolePermissions(mapped);
        const first = data.roles?.[0] || null;
        setSelectedRole(first); setSelectedIds(first ? mapped[first.key] || [] : []);
        setExpanded(Object.fromEntries((data.permissions || []).map((permission) => [permission.category, false])));
      } catch (err: any) { toast({ type: 'error', title: 'Could not load system roles', message: err.message }); }
      finally { setLoading(false); }
    }
    load();
  }, [toast]);

  const categories = useMemo(() => permissions.reduce<Record<string, Permission[]>>((all, permission) => { (all[permission.category] ||= []).push(permission); return all; }, {}), [permissions]);
  const dirty = selectedRole ? JSON.stringify(selectedIds.slice().sort()) !== JSON.stringify((rolePermissions[selectedRole.key] || []).slice().sort()) : false;
  const selectRole = (role: Role) => { setSelectedRole(role); setSelectedIds(rolePermissions[role.key] || []); };
  const savePermissions = async () => {
    if (!selectedRole) return;
    try {
      setSaving(true);
      await apiFetch(`/platform/system-roles/${selectedRole.key}/permissions`, { method: 'PUT', body: JSON.stringify({ permissionIds: selectedIds }) });
      setRolePermissions((current) => ({ ...current, [selectedRole.key]: selectedIds }));
      toast({ type: 'success', title: 'Role access updated', message: `${selectedRole.name} permissions were saved.` });
    } catch (err: any) { toast({ type: 'error', title: 'Unable to save access', message: err.message }); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="p-8 text-sm text-text-secondary">Loading system roles...</div>;
  return <div className="h-full min-h-0 flex flex-col space-y-6">
    <div className="shrink-0"><div className="flex items-center gap-2"><Shield className="w-5 h-5 text-accent" /><h1 className="text-[17px] font-semibold text-text-primary">System-Level Roles & Access</h1><Badge variant="accent" size="sm">Platform Super Admin</Badge></div><p className="text-[12px] text-text-secondary mt-1">Configure platform role access using the tenant role-and-permission workflow.</p></div>
    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6 overflow-hidden">
      <div className="min-h-0 flex flex-col gap-2"><div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">Configurable roles ({roles.length})</div><div className="space-y-1 overflow-y-auto">{roles.map((role) => { const Icon = roleMeta[role.key]?.icon || Shield; const isSelected = selectedRole?.key === role.key; return <button key={role.key} onClick={() => selectRole(role)} className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] ${isSelected ? 'bg-accent-subtle border-accent/30 text-accent shadow-none font-medium' : 'bg-transparent border-transparent text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99]'}`}><div className="flex min-w-0 items-center justify-between gap-2"><span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium"><Icon className={`w-4 h-4 shrink-0 ${roleMeta[role.key]?.color || 'text-accent'}`} /><span className="truncate">{role.name}</span></span><span className="shrink-0 whitespace-nowrap text-right text-[11px] text-text-tertiary">{role.assignedCount} assigned</span></div><p className="mt-1 truncate text-[11px] text-text-secondary">{role.description}</p></button>; })}</div></div>
      <div key={selectedRole?.key} className="lg:col-span-3 min-h-0 flex flex-col gap-4 animate-matrix-in"><div className="macos-vibrancy p-4 rounded-xl border border-border/80 flex items-center justify-between gap-4"><div><h2 className="text-[15px] font-semibold text-text-primary">{selectedRole?.name || 'Select a role'}</h2><p className="text-[12px] text-text-secondary mt-0.5">Assign platform-specific permissions to this role.</p></div><div className="flex items-center gap-2">{dirty && <Button size="sm" variant="secondary" onClick={() => selectedRole && setSelectedIds(rolePermissions[selectedRole.key] || [])}>Cancel</Button>}{dirty && <Button size="sm" variant="primary" loading={saving} onClick={savePermissions}>Save changes</Button>}</div></div><div className="flex-1 min-h-0 space-y-3 overflow-y-auto pr-1">{Object.entries(categories).map(([category, items]) => { const granted = items.filter((permission) => selectedIds.includes(permission.id)).length; const open = expanded[category]; return <div key={category} className="bg-surface border border-border/80 rounded-[10px] overflow-hidden"><button className="w-full flex items-center justify-between px-4 py-3 text-left" onClick={() => setExpanded((current) => ({ ...current, [category]: !current[category] }))}><span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary"><ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />{category}</span><span className="text-[11px] font-mono text-text-secondary">{granted} / {items.length} granted</span></button>{open && <div className="p-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-3 gap-2">{items.map((permission) => { const active = selectedIds.includes(permission.id); return <button key={permission.id} disabled={!selectedRole || saving} onClick={() => setSelectedIds((ids) => active ? ids.filter((id) => id !== permission.id) : [...ids, permission.id])} className={`flex items-center justify-between px-3 py-2 rounded-md text-[12px] border ${active ? 'bg-accent/10 text-accent border-accent/25' : 'text-text-secondary border-border/60'}`}>{permission.label}<span className={`w-4 h-4 rounded-full flex items-center justify-center ${active ? 'bg-accent text-white' : 'border border-border'}`}>{active && <Check className="w-2.5 h-2.5" />}</span></button>; })}</div>}</div>; })}</div></div>
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
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 animate-fade-in">
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
        </div>,
        document.body
      )}
    </div>
  </div>;
}
