'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  ShieldCheck,
  Headphones,
  CreditCard,
  Plus,
  Trash2,
  Check,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  assignedCount: number;
  isCustom: boolean;
}

interface Permission {
  id: string;
  key: string;
  category: string;
  label: string;
}

const PROTECTED_PLATFORM_ROLES = new Set(['SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN']);

const ROLE_METADATA: Record<string, { icon: LucideIcon; color: string }> = {
  PLATFORM_SUPER_ADMIN: {
    icon: ShieldCheck,
    color: 'text-accent',
  },
  SUPER_ADMIN: {
    icon: ShieldCheck,
    color: 'text-accent',
  },
  PLATFORM_SUPPORT_ADMIN: {
    icon: Headphones,
    color: 'text-blue-500',
  },
  PLATFORM_FINANCE_ADMIN: {
    icon: CreditCard,
    color: 'text-emerald-500',
  },
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
  const [customRolesOpen, setCustomRolesOpen] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [roleFormSaving, setRoleFormSaving] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{
          roles: Role[];
          permissions: Permission[];
          rolePermissions: { key: string; permissionId: string }[];
        }>('/platform/system-roles');
        const mapped: Record<string, string[]> = {};
        (data.roles || []).forEach((role) => {
          mapped[role.key] = [];
        });
        (data.rolePermissions || []).forEach((item) => {
          (mapped[item.key] ||= []).push(item.permissionId);
        });
        const visibleRoles = (data.roles || []).filter((role) => !PROTECTED_PLATFORM_ROLES.has(role.key));
        setRoles(visibleRoles);
        setPermissions(data.permissions || []);
        setRolePermissions(mapped);
        const first = visibleRoles[0] || null;
        setSelectedRole(first);
        setSelectedIds(first ? mapped[first.key] || [] : []);
        setExpanded(
          Object.fromEntries((data.permissions || []).map((permission) => [permission.category, false]))
        );
      } catch (err: any) {
        toast({ type: 'error', title: 'Could not load system roles', message: err.message });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [toast]);

  const categories = useMemo(
    () =>
      permissions.reduce<Record<string, Permission[]>>((all, permission) => {
        (all[permission.category] ||= []).push(permission);
        return all;
      }, {}),
    [permissions]
  );
  const dirty = selectedRole
    ? JSON.stringify(selectedIds.slice().sort()) !==
      JSON.stringify((rolePermissions[selectedRole.key] || []).slice().sort())
    : false;
  const selectRole = (role: Role) => {
    setSelectedRole(role);
    setSelectedIds(rolePermissions[role.key] || []);
  };
  const savePermissions = async () => {
    if (!selectedRole) return;
    if (['SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN'].includes(selectedRole.key)) {
      toast({ type: 'error', title: 'Protected role', message: 'Super Admin permissions cannot be changed.' });
      return;
    }
    try {
      setSaving(true);
      await apiFetch(`/platform/system-roles/${selectedRole.key}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds: selectedIds }),
      });
      setRolePermissions((current) => ({ ...current, [selectedRole.key]: selectedIds }));
      toast({
        type: 'success',
        title: 'Role access updated',
        message: `${selectedRole.name} permissions were saved.`,
      });
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to save access', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const openCreateRole = () => {
    setRoleForm({ name: '', description: '' });
    setCreateRoleOpen(true);
  };

  const createCustomRole = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = roleForm.name.trim();
    if (!name) return;

    try {
      setRoleFormSaving(true);
      const role = await apiFetch<Role>('/platform/system-roles', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: roleForm.description.trim() || null,
        }),
      });
      setRoles((current) => [...current, role].sort((a, b) => a.name.localeCompare(b.name)));
      setRolePermissions((current) => ({ ...current, [role.key]: [] }));
      setSelectedRole(role);
      setSelectedIds([]);
      setCreateRoleOpen(false);
      setCustomRolesOpen(false);
      toast({
        type: 'success',
        title: 'Custom role created',
        message: 'Configure its access using the permissions matrix.',
      });
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to create role', message: err.message });
    } finally {
      setRoleFormSaving(false);
    }
  };

  const deleteCustomRole = async (role: Role) => {
    if (!role.isCustom || role.assignedCount > 0) return;
    if (!window.confirm(`Delete the custom role “${role.name}”? This cannot be undone.`)) return;
    try {
      await apiFetch(`/platform/system-roles/${role.key}`, { method: 'DELETE' });
      const remaining = roles.filter((item) => item.key !== role.key);
      setRoles(remaining);
      setRolePermissions((current) => {
        const next = { ...current };
        delete next[role.key];
        return next;
      });
      if (selectedRole?.key === role.key) {
        const nextRole = remaining[0] || null;
        setSelectedRole(nextRole);
        setSelectedIds(nextRole ? rolePermissions[nextRole.key] || [] : []);
      }
      toast({ type: 'success', title: 'Custom role deleted', message: `${role.name} was removed.` });
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to delete role', message: err.message });
    }
  };

  if (loading) {
    return <div className="p-8 text-sm text-text-secondary">Loading system roles...</div>;
  }

  return (
    <div className="flex min-h-full flex-col space-y-4 sm:h-full sm:min-h-0 sm:space-y-6">
      <div className="flex shrink-0 flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-start lg:gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Shield className="w-5 h-5 text-accent" />
            <h1 className="text-base font-semibold leading-tight text-text-primary sm:text-[17px]">
              System-Level Roles &amp; Access
            </h1>
            <Badge variant="accent" size="sm">
              Platform Super Admin
            </Badge>
          </div>
          <p className="text-[12px] text-text-secondary mt-1">
            Configure system-level permissions for platform roles and create custom roles.
          </p>
        </div>
        <Button
          size="sm"
          variant="primary"
          className="w-full lg:w-auto"
          disabled={dirty || saving || roleFormSaving}
          icon={<Plus className="w-3.5 h-3.5" />}
          onClick={() => setCustomRolesOpen(true)}
        >
          Custom Roles
        </Button>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-3 lg:min-h-0 lg:grid-cols-4 lg:gap-6 lg:overflow-hidden">
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-1">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
            Configurable roles ({roles.length})
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto lg:max-h-none lg:flex-1">
            {roles.map((role) => {
              const Icon = ROLE_METADATA[role.key]?.icon || Shield;
              const isSelected = selectedRole?.key === role.key;
              return (
                <button
                  key={role.key}
                  onClick={() => selectRole(role)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] ${
                    isSelected
                      ? 'bg-accent-subtle border-accent/30 text-accent shadow-none font-medium'
                      : 'bg-transparent border-transparent text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99]'
                  }`}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-2 text-[13px] font-medium">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${ROLE_METADATA[role.key]?.color || 'text-accent'}`}
                      />
                      <span className="truncate">{role.name}</span>
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-right text-[11px] text-text-tertiary">
                      {role.assignedCount} assigned
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-text-secondary">{role.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div
          key={selectedRole?.key}
          className="flex min-h-0 flex-col gap-3 animate-matrix-in lg:col-span-3 lg:gap-4"
        >
          <div className="macos-vibrancy flex flex-col items-stretch justify-between gap-3 rounded-xl border border-border/80 p-3 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-text-primary">
                {selectedRole?.name || 'Select a role'}
              </h2>
              <p className="text-[12px] text-text-secondary mt-0.5">
                Assign platform-specific permissions to this role.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
              {dirty && !['SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN'].includes(selectedRole?.key || '') && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    selectedRole && setSelectedIds(rolePermissions[selectedRole.key] || [])
                  }
                >
                  Cancel
                </Button>
              )}
              {dirty && (
                <Button size="sm" variant="primary" loading={saving} onClick={savePermissions}>
                  Save changes
                </Button>
              )}
            </div>
          </div>

          <div className="min-h-0 space-y-3 overflow-y-auto pr-1 lg:flex-1">
            {Object.entries(categories).map(([category, items]) => {
              const granted = items.filter((permission) => selectedIds.includes(permission.id)).length;
              const open = expanded[category];
              return (
                <div
                  key={category}
                  className="bg-surface border border-border/80 rounded-[10px] overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                    onClick={() =>
                      setExpanded((current) => ({ ...current, [category]: !current[category] }))
                    }
                  >
                    <span className="flex items-center gap-2 text-[13px] font-semibold text-text-primary">
                      <ChevronRight className={`w-4 h-4 transition-transform ${open ? 'rotate-90' : ''}`} />
                      {category}
                    </span>
                    <span className="text-[11px] font-mono text-text-secondary">
                      {granted} / {items.length} granted
                    </span>
                  </button>
                  {open && (
                    <div className="grid grid-cols-1 gap-2 border-t border-border/60 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-3">
                      {items.map((permission) => {
                        const active = selectedIds.includes(permission.id);
                        return (
                          <button
                            key={permission.id}
                            disabled={!selectedRole || saving}
                            onClick={() =>
                              setSelectedIds((ids) =>
                                active
                                  ? ids.filter((id) => id !== permission.id)
                                  : [...ids, permission.id]
                              )
                            }
                            className={`flex items-center justify-between px-3 py-2 rounded-md text-[12px] border ${
                              active
                                ? 'bg-accent/10 text-accent border-accent/25'
                                : 'text-text-secondary border-border/60'
                            }`}
                          >
                            {permission.label}
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center ${
                                active ? 'bg-accent text-white' : 'border border-border'
                              }`}
                            >
                              {active && <Check className="w-2.5 h-2.5" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal
        isOpen={customRolesOpen}
        onClose={() => setCustomRolesOpen(false)}
        title="Platform Roles"
        description="View predefined roles and create custom roles, then manage access in the permissions matrix."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              Select a role to manage its access or add a custom platform role.
            </p>
            <Button
              size="sm"
              variant="primary"
              disabled={dirty || saving || roleFormSaving}
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={openCreateRole}
            >
              Add Role
            </Button>
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {roles.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-text-secondary">
                No platform roles are available.
              </div>
            ) : (
              roles.map((role) => (
                <div
                  key={role.id}
                  className={`flex w-full items-center gap-2 rounded-lg border p-3 ${
                    selectedRole?.id === role.id
                      ? 'border-accent/30 bg-accent/5'
                      : 'border-border bg-surface'
                  }`}
                >
                  <button
                    type="button"
                    disabled={saving || dirty}
                    onClick={() => {
                      selectRole(role);
                      setCustomRolesOpen(false);
                    }}
                    className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="block truncate text-[13px] font-medium text-text-primary">{role.name}</span>
                    <span className="block truncate text-xs text-text-secondary">
                      {role.description || (role.isCustom ? 'Custom platform role' : 'Predefined platform role')}
                    </span>
                  </button>
                  {role.isCustom && (
                    <button
                      type="button"
                      aria-label={`Delete ${role.name}`}
                      title={role.assignedCount > 0 ? 'Remove this role from administrators before deleting it' : 'Delete custom role'}
                      disabled={saving || dirty || role.assignedCount > 0}
                      onClick={() => void deleteCustomRole(role)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-danger/25 text-danger transition hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        title="Add Custom Platform Role"
        description="Create a role, then configure its access with the permissions matrix."
      >
        <form onSubmit={createCustomRole} className="space-y-4">
          <Input
            label="Role name"
            value={roleForm.name}
            onChange={(event) =>
              setRoleForm((current) => ({ ...current, name: event.target.value }))
            }
            required
            maxLength={100}
          />
          <label className="w-full flex flex-col gap-1 text-left text-xs font-medium text-text-secondary">
            Description
            <textarea
              value={roleForm.description}
              onChange={(event) =>
                setRoleForm((current) => ({ ...current, description: event.target.value }))
              }
              maxLength={500}
              rows={3}
              className="w-full p-2.5 text-xs bg-surface text-text-primary rounded-sm border border-border focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/35 resize-y"
            />
          </label>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={roleFormSaving}
              onClick={() => setCreateRoleOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={roleFormSaving}>
              Create Role
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
