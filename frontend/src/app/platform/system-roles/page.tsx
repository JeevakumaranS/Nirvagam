'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
    </div>
  </div>;
}
