'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { UserPlus, Search, RefreshCw, Shield, Store, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function UsersSettingsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    roleId: '',
    branchId: '',
  });

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes, businessesRes] = await Promise.all([
        apiFetch('/users', { params: { search } }),
        apiFetch('/roles'),
        apiFetch('/businesses'),
      ]);

      setUsers(usersRes?.data || (Array.isArray(usersRes) ? usersRes : []));
      setRoles(rolesRes || []);

      if (businessesRes?.[0]?.id) {
        const branchList = await apiFetch(`/businesses/${businessesRes[0].id}/branches`);
        setBranches(branchList || []);
        if (branchList?.[0]?.id) {
          setFormData((prev) => ({ ...prev, branchId: branchList[0].id }));
        }
      }

      if (rolesRes?.[0]?.id) {
        setFormData((prev) => ({ ...prev, roleId: rolesRes[0].id }));
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to load users', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.email || !formData.password || !formData.roleId) {
      toast({ type: 'warning', title: 'Missing fields', message: 'Please complete all required fields.' });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          roleIds: [formData.roleId],
          branchIds: formData.branchId ? [formData.branchId] : [],
        }),
      });

      toast({ type: 'success', title: 'User created', message: `${formData.firstName} has been onboarded.` });
      setIsModalOpen(false);
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        phone: '',
        roleId: roles[0]?.id || '',
        branchId: branches[0]?.id || '',
      });
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Error creating user', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Team Members & Access</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage staff accounts, assign granular role permissions and allocate branch work locations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            icon={<UserPlus className="w-3.5 h-3.5" />}
          >
            Add Team Member
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-2 max-w-sm">
        <Input
          placeholder="Filter by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefixIcon={<Search className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Name</TableHead>
              <TableHead>Email Address</TableHead>
              <TableHead>Assigned Roles</TableHead>
              <TableHead>Branch Scope</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableEmptyState message="No team members match the search query." />
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-text-primary">
                    {u.firstName} {u.lastName}
                  </TableCell>
                  <TableCell className="font-mono text-text-secondary">{u.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.userRoles?.map((ur: any, idx: number) => (
                        <Badge key={idx} size="sm" variant="accent">
                          <Shield className="w-2.5 h-2.5" />
                          {ur.role.name}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs text-text-secondary">
                      <Store className="w-3 h-3 text-text-tertiary" />
                      <span>{u.branchAssignments?.[0]?.branch?.name || 'All Branches'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-text-tertiary font-mono text-[11px]">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge size="sm" variant={u.isActive ? 'success' : 'danger'}>
                      {u.isActive ? 'Active' : 'Deactivated'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Add User Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Onboard New Team Member"
        description="Create credentials and grant role permissions."
      >
        <form onSubmit={handleCreateUser} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="First Name *"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              placeholder="e.g. Suresh"
              required
            />
            <Input
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              placeholder="e.g. Mani"
            />
          </div>

          <Input
            label="Email Address *"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="suresh@durozen.com"
            prefixIcon={<Mail className="w-3.5 h-3.5" />}
            required
          />

          <Input
            label="Initial Password *"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Min 8 characters"
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Select
              label="Designated Role *"
              value={formData.roleId}
              onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>

            <Select
              label="Assigned Branch"
              value={formData.branchId}
              onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </Select>
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Create Team Member
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
