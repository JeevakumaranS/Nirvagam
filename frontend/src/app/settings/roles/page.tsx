'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Shield, Check, Lock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function RolesSettingsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<Record<string, any[]>>({});
  const [selectedRole, setSelectedRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        if (rolesRes && rolesRes.length > 0) {
          setSelectedRole(rolesRes[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadRolesAndPermissions();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const rolePermissionKeys = new Set(
    selectedRole?.rolePermissions?.map((rp: any) => `${rp.permission?.resource}:${rp.permission?.action}`) || []
  );

  const isAllAccess = selectedRole?.name === 'SUPER_ADMIN' || selectedRole?.name === 'BUSINESS_OWNER';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Roles & Permission Matrix</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Standard Indian ERP RBAC architecture controlling billing, financial reversals, and audit logs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Role List */}
        <div className="lg:col-span-1 space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary px-1 font-mono">
            System & Business Roles
          </p>
          <div className="space-y-1">
            {roles.map((r) => {
              const isSelected = selectedRole?.id === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r)}
                  className={`w-full text-left p-2.5 rounded border transition-colors ${
                    isSelected
                      ? 'bg-surface-secondary border-accent text-accent font-medium shadow-subtle'
                      : 'bg-background border-border text-text-primary hover:bg-surface-secondary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs">{r.name}</span>
                    {r.isSystem && <Lock className="w-3 h-3 text-text-tertiary" />}
                  </div>
                  <p className="text-[11px] text-text-tertiary truncate mt-0.5">{r.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Permission Matrix */}
        <div className="lg:col-span-3 space-y-3">
          <div className="p-3 bg-surface-secondary border border-border rounded-lg flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-text-primary font-mono">{selectedRole?.name}</h3>
              <p className="text-xs text-text-secondary mt-0.5">{selectedRole?.description}</p>
            </div>
            {isAllAccess ? (
              <Badge size="sm" variant="accent">Full Super Access (*:*)</Badge>
            ) : (
              <Badge size="sm" variant="neutral">Restricted Role</Badge>
            )}
          </div>

          <div className="space-y-3">
            {Object.entries(permissions).map(([resource, actions]) => (
              <div key={resource} className="p-3 bg-background border border-border rounded-lg">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                    {resource.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] text-text-tertiary font-mono">{actions.length} actions</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  {actions.map((act) => {
                    const hasPerm = isAllAccess || rolePermissionKeys.has(`${resource}:${act.action}`);
                    return (
                      <div
                        key={act.id}
                        className={`flex items-center gap-1.5 p-1.5 rounded text-xs border ${
                          hasPerm
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-surface-secondary text-text-tertiary border-border opacity-60'
                        }`}
                      >
                        {hasPerm ? (
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                          <span className="w-3 h-3 rounded-full border border-border shrink-0" />
                        )}
                        <span className="capitalize font-mono text-[11px]">{act.action}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
