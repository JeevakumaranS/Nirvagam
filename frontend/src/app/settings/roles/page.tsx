'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Shield, Check, ChevronRight, Plus, Pencil, Trash2, UsersRound } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Record<string, any[]>>({});
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [editedPermissionIds, setEditedPermissionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleManagerOpen, setRoleManagerOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleModalMode, setRoleModalMode] = useState<'create' | 'edit'>('create');
  const [editingRole, setEditingRole] = useState<any>(null);
  const [roleFormSaving, setRoleFormSaving] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const { toast } = useToast();
  const canManageRoles = Boolean(
    user?.roles?.some((role) => role === 'BUSINESS_OWNER' || role === 'BUSINESS_ADMIN')
  );
  const canEditRole = (role: any) =>
    Boolean(
      canManageRoles &&
        (role?.isSystem
          ? role?.businessId === null
          : role?.businessId)
    );
  const canEditSelectedRole = canEditRole(selectedRole);
  const rolePermissionIds = new Set(editedPermissionIds);
  const allPermissionIds = Object.values(permissions).flat().map((permission) => permission.id);
  const isAllAccess =
    allPermissionIds.length > 0 && allPermissionIds.every((permissionId) => rolePermissionIds.has(permissionId));
  const originalPermissionIds = new Set(
    selectedRole?.rolePermissions?.map((rp: any) => rp.permissionId || rp.permission?.id).filter(Boolean) || []
  );
  const hasUnsavedChanges =
    editedPermissionIds.length !== originalPermissionIds.size ||
    editedPermissionIds.some((permissionId) => !originalPermissionIds.has(permissionId));

  const formatRoleName = (name?: string) =>
    name
      ? name
          .split(/[_\s]+/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(' ')
      : '';

  useEffect(() => {
    async function loadRolesAndPermissions() {
      try {
        setLoading(true);
        const [rolesRes, permsRes] = await Promise.all([
          apiFetch('/roles'),
          apiFetch('/roles/permissions'),
        ]);
        setRoles(rolesRes || []);
        setPermissions(permsRes || {});
        const firstPredefinedRole = rolesRes?.find((role: any) => role.isSystem);
        if (firstPredefinedRole) {
          setSelectedRole(firstPredefinedRole);
          setEditedPermissionIds(
            firstPredefinedRole.rolePermissions
              ?.map((rp: any) => rp.permissionId || rp.permission?.id)
              .filter(Boolean) || []
          );
        }
        // Start with permission categories collapsed.
        if (permsRes) {
          const initialExpanded: Record<string, boolean> = {};
          Object.keys(permsRes).forEach((key) => {
            initialExpanded[key] = false;
          });
          setExpandedCategories(initialExpanded);
        }
      } catch (err: any) {
        toast({ type: 'error', title: 'Unable to load roles', message: err.message });
      } finally {
        setLoading(false);
      }
    }
    loadRolesAndPermissions();
  }, [toast]);

  const selectRole = (role: any) => {
    setSelectedRole(role);
    setEditedPermissionIds(
      role.rolePermissions?.map((rp: any) => rp.permissionId || rp.permission?.id).filter(Boolean) || []
    );
  };

  const togglePermission = (permissionId: string) => {
    setEditedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId]
    );
  };

  const savePermissions = async () => {
    if (!selectedRole || !canEditSelectedRole) return;

    try {
      setSaving(true);
      const updatedRole = await apiFetch(`/roles/${selectedRole.id}/permissions`, {
        method: 'PUT',
        body: JSON.stringify({ permissionIds: editedPermissionIds }),
      });
      setSelectedRole(updatedRole);
      setRoles((current) => current.map((role) => role.id === updatedRole.id ? updatedRole : role));
      setEditedPermissionIds(
        updatedRole.rolePermissions?.map((rp: any) => rp.permissionId || rp.permission?.id).filter(Boolean) || []
      );
      toast({
        type: 'success',
        title: 'Role access updated',
        message: selectedRole.isSystem
          ? 'Changes apply to all tenants using this predefined role.'
          : 'Changes apply to users assigned this role in your business.',
      });
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to update role access', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const openCreateRole = () => {
    setRoleModalMode('create');
    setEditingRole(null);
    setRoleForm({ name: '', description: '' });
    setRoleModalOpen(true);
  };

  const openEditRole = (role: any) => {
    if (!canEditRole(role)) return;
    setRoleModalMode('edit');
    setEditingRole(role);
    setRoleForm({ name: role.name, description: role.description || '' });
    setRoleModalOpen(true);
  };

  const saveRoleDetails = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = roleForm.name.trim();
    if (!name) {
      toast({ type: 'warning', title: 'Role name required', message: 'Enter a name for this role.' });
      return;
    }

    try {
      setRoleFormSaving(true);
      const isCreating = roleModalMode === 'create';
      const updatedRole = await apiFetch(isCreating ? '/roles' : `/roles/${editingRole.id}`, {
        method: isCreating ? 'POST' : 'PATCH',
        body: JSON.stringify({
          name,
          description: roleForm.description.trim() || null,
        }),
      });

      if (isCreating) {
        setRoles((current) => [...current, updatedRole]);
        setSelectedRole(updatedRole);
        setEditedPermissionIds([]);
      } else {
        setRoles((current) => current.map((role) => role.id === updatedRole.id ? updatedRole : role));
        if (selectedRole?.id === updatedRole.id) {
          selectRole(updatedRole);
        }
      }

      setRoleModalOpen(false);
      toast({
        type: 'success',
        title: isCreating ? 'Role created' : 'Role updated',
        message: isCreating ? 'Set its access permissions in the matrix.' : 'Role details saved.',
      });
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to save role', message: err.message });
    } finally {
      setRoleFormSaving(false);
    }
  };

  const deleteRole = async (role: any) => {
    if (!canEditRole(role) || hasUnsavedChanges) return;

    const warning = role.isSystem
      ? 'This predefined role is shared globally. It can only be deleted if no user in any tenant is assigned to it.'
      : 'This role can only be deleted if no user in this business is assigned to it.';
    if (!window.confirm(`${warning}\n\nDelete "${formatRoleName(role.name)}"?`)) return;

    try {
      const deletedId = role.id;
      await apiFetch(`/roles/${deletedId}`, { method: 'DELETE' });
      const nextRoles = roles.filter((role) => role.id !== deletedId);
      setRoles(nextRoles);
      if (selectedRole?.id === deletedId) {
        if (nextRoles.length > 0) {
          selectRole(nextRoles[0]);
        } else {
          setSelectedRole(null);
          setEditedPermissionIds([]);
        }
      }
      toast({ type: 'success', title: 'Role deleted', message: 'The role was removed.' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to delete role', message: err.message });
    }
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56 rounded-md" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
          <div className="lg:col-span-3 space-y-3">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="h-full min-h-0 flex flex-col space-y-6">
      {/* Page Title */}
      <div className="shrink-0 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary tracking-[-0.01em]">
            Roles & Permissions Matrix
          </h2>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Warning: changes to predefined roles affect every tenant using that role.
          </p>
        </div>
        {canManageRoles && (
          <Button
            size="sm"
            variant="primary"
            disabled={hasUnsavedChanges || saving || roleFormSaving}
            icon={<UsersRound className="w-3.5 h-3.5" />}
            onClick={() => setRoleManagerOpen(true)}
          >
            Custom Roles
          </Button>
        )}
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 grid-rows-2 lg:grid-cols-4 lg:grid-rows-1 gap-6 items-stretch overflow-hidden">
        {/* Left Column: Clean Role List Rows */}
        <div className="lg:col-span-1 min-h-0 flex flex-col gap-2">
          <div className="shrink-0 px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-secondary">
            Roles ({roles.length})
          </div>
          <div className="flex-1 min-h-0 space-y-1 overflow-y-auto overscroll-contain pr-1">
            {roles.length === 0 ? (
              <div className="p-3 text-xs text-text-secondary">No roles are available.</div>
            ) : roles.map((r) => {
              const isSelected = selectedRole?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => selectRole(r)}
                  disabled={saving || (hasUnsavedChanges && !isSelected)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-[120ms] ease-[cubic-bezier(0.2,0,0,1)] ${
                    isSelected
                      ? 'bg-accent/12 border-accent/30 text-accent shadow-none font-medium'
                      : 'bg-transparent border-transparent text-text-primary hover:bg-black/5 dark:hover:bg-white/5 active:scale-[0.99]'
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium tracking-[-0.01em] truncate">
                      {formatRoleName(r.name)}
                    </span>
                  </div>
                  <p className="text-[12px] text-text-secondary truncate mt-0.5">
                    {r.description || 'Custom business workspace role'}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Permission Matrix with Staggered Entry on Role Change */}
        <div key={selectedRole?.id} className="lg:col-span-3 min-h-0 flex flex-col gap-4 animate-matrix-in">
          {/* Sticky Blurred Role Header */}
          <div className="shrink-0 macos-vibrancy p-4 rounded-xl border border-border/80 shadow-card flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent stroke-[1.5]" />
                <h3 className="text-[15px] font-semibold text-text-primary tracking-[-0.01em] truncate">
                  {selectedRole ? formatRoleName(selectedRole.name) : 'Select a role'}
                </h3>
              </div>
              <p className="text-[12px] text-text-secondary mt-0.5 truncate">
                {selectedRole?.description || 'Manage module-level privileges and access limitations.'}
              </p>
            </div>
            <div className="shrink-0 flex flex-wrap items-center justify-end gap-2">
              {canEditSelectedRole && hasUnsavedChanges && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => selectRole(selectedRole)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" variant="primary" loading={saving} onClick={savePermissions}>
                    Save changes
                  </Button>
                </>
              )}
              {isAllAccess ? (
                <Badge size="sm" variant="accent">Full Access</Badge>
              ) : (
                <Badge size="sm" variant="neutral">Restricted Role</Badge>
              )}
            </div>
          </div>

          {/* Collapsible Permission Category Cards */}
          <div className="flex-1 min-h-0 space-y-3 overflow-y-auto overscroll-contain pr-1">
            {Object.entries(permissions).map(([resource, actions], catIdx) => {
              const isExpanded = expandedCategories[resource] ?? false;
              const grantedCount = actions.filter(
                (act) => rolePermissionIds.has(act.id)
              ).length;

              return (
                <div
                  key={resource}
                  className="bg-surface border border-border/80 rounded-[10px] shadow-card overflow-hidden transition-all duration-[200ms]"
                  style={{ animationDelay: `${catIdx * 30}ms` }}
                >
                  {/* Category Header Accordion Button */}
                  <button
                    type="button"
                    onClick={() => toggleCategory(resource)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-surface hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors text-left select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <ChevronRight
                        className={`w-4 h-4 text-text-secondary stroke-[1.5] transition-transform duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)] ${
                          isExpanded ? 'rotate-90' : 'rotate-0'
                        }`}
                      />
                      <span className="text-[13px] font-semibold text-text-primary uppercase tracking-[0.02em]">
                        {resource.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-text-secondary">
                        {grantedCount} / {actions.length} granted
                      </span>
                    </div>
                  </button>

                  {/* 60fps Zero-Jank CSS Grid Collapsible Body */}
                  <div
                    className="accordion-grid"
                    data-expanded={isExpanded}
                  >
                    <div className="overflow-hidden">
                      <div className="p-4 pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {actions.map((act) => {
                          const hasPerm = rolePermissionIds.has(act.id);

                          return (
                            <button
                              type="button"
                              key={act.id}
                              aria-pressed={hasPerm}
                              disabled={!canEditSelectedRole || saving}
                              onClick={() => togglePermission(act.id)}
                              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md text-[12px] border text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
                                hasPerm
                                  ? 'bg-accent/10 text-accent border-accent/25 font-medium'
                                  : 'bg-black/[0.02] dark:bg-white/[0.02] text-text-secondary border-border/60 hover:border-border'
                              }`}
                            >
                              <span className="capitalize tracking-tight truncate">
                                {act.action.replace(/_/g, ' ').toLowerCase()}
                              </span>

                              {/* macOS check indicator */}
                              <div
                                className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                                  hasPerm
                                    ? 'bg-accent text-white'
                                    : 'border border-border/80 bg-background/50'
                                }`}
                              >
                                {hasPerm && <Check className="w-2.5 h-2.5 stroke-[2.5]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
      <Modal
        isOpen={roleManagerOpen}
        onClose={() => setRoleManagerOpen(false)}
        title="Custom Roles"
        description="Manage predefined and business-specific roles."
        maxWidth="2xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-text-secondary">
              Predefined role changes affect every tenant using that role.
            </p>
            <Button
              size="sm"
              variant="primary"
              disabled={hasUnsavedChanges || roleFormSaving}
              icon={<Plus className="w-3.5 h-3.5" />}
              onClick={openCreateRole}
            >
              Add Role
            </Button>
          </div>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto overscroll-contain pr-1">
            {roles.length === 0 ? (
              <div className="rounded-lg border border-border p-4 text-sm text-text-secondary">
                No roles are available.
              </div>
            ) : roles.map((role) => (
              <div
                key={role.id}
                className={`flex items-center gap-3 rounded-lg border p-3 ${
                  selectedRole?.id === role.id
                    ? 'border-accent/30 bg-accent/5'
                    : 'border-border bg-surface'
                }`}
              >
                <button
                  type="button"
                  disabled={saving || hasUnsavedChanges}
                  onClick={() => {
                    selectRole(role);
                    setRoleManagerOpen(false);
                  }}
                  className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="block truncate text-[13px] font-medium text-text-primary">
                    {formatRoleName(role.name)}
                  </span>
                  <span className="block truncate text-xs text-text-secondary">
                    {role.description || 'Custom business workspace role'}
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Edit ${formatRoleName(role.name)}`}
                    title="Edit role"
                    disabled={!canEditRole(role) || saving || hasUnsavedChanges}
                    onClick={() => openEditRole(role)}
                    className="rounded-md p-2 text-text-secondary hover:bg-black/5 hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/5"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${formatRoleName(role.name)}`}
                    title="Delete role"
                    disabled={!canEditRole(role) || saving || hasUnsavedChanges}
                    onClick={() => deleteRole(role)}
                    className="rounded-md p-2 text-text-secondary hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={roleModalMode === 'create' ? 'Add Custom Role' : 'Edit Role'}
        description={
          roleModalMode === 'create'
            ? 'Create a business-specific role, then assign its permissions.'
            : editingRole?.isSystem
              ? 'Predefined role names are fixed; update the description and access permissions.'
              : 'Update this business-specific role.'
        }
      >
        <form onSubmit={saveRoleDetails} className="space-y-4">
          <Input
            label="Role name"
            value={roleForm.name}
            onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))}
            disabled={roleModalMode === 'edit' && editingRole?.isSystem}
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
            <Button type="button" size="sm" variant="secondary" onClick={() => setRoleModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" variant="primary" loading={roleFormSaving}>
              {roleModalMode === 'create' ? 'Create Role' : 'Save Role'}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
