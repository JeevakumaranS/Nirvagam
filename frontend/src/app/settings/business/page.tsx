'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Building2, Plus, Store, Calendar, ShieldCheck, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function BusinessSettingsPage() {
  const [business, setBusiness] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchSubmitting, setBranchSubmitting] = useState(false);

  const [branchForm, setBranchForm] = useState({
    name: '',
    code: '',
    gstin: '',
    addressLine1: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '600001',
    isHeadOffice: false,
  });

  const { toast } = useToast();

  const loadBusiness = async () => {
    try {
      setLoading(true);
      const bizList = await apiFetch('/businesses');
      if (bizList && bizList.length > 0) {
        const fullBiz = await apiFetch(`/businesses/${bizList[0].id}`);
        setBusiness(fullBiz);
        const branchList = await apiFetch(`/businesses/${bizList[0].id}/branches`);
        setBranches(branchList || []);
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to load business', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusiness();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id) return;

    try {
      setSaving(true);
      await apiFetch(`/businesses/${business.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          legalName: business.legalName,
          tradeName: business.tradeName,
          pan: business.pan,
          phone: business.phone,
          email: business.email,
        }),
      });
      toast({ type: 'success', title: 'Saved', message: 'Business profile updated successfully.' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Update failed', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name || !branchForm.code || !business?.id) {
      toast({ type: 'warning', title: 'Missing fields', message: 'Branch name and unique code are required.' });
      return;
    }

    try {
      setBranchSubmitting(true);
      await apiFetch(`/businesses/${business.id}/branches`, {
        method: 'POST',
        body: JSON.stringify(branchForm),
      });

      toast({ type: 'success', title: 'Branch added', message: `Branch ${branchForm.name} registered.` });
      setIsBranchModalOpen(false);
      setBranchForm({
        name: '',
        code: '',
        gstin: '',
        addressLine1: '',
        city: 'Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        pincode: '600001',
        isHeadOffice: false,
      });
      loadBusiness();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to add branch', message: err.message });
    } finally {
      setBranchSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Business Entity & Branches</h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Configure statutory identifiers, multi-branch operations, and active GST registrations.
        </p>
      </div>

      {/* Legal Entity Profile Form */}
      <div className="p-4 bg-background border border-border rounded-lg shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Legal Entity Information
            </h3>
          </div>
          <Badge size="sm" variant="accent">{business?.businessType}</Badge>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Legal Name (As per GST / PAN)"
              value={business?.legalName || ''}
              onChange={(e) => setBusiness({ ...business, legalName: e.target.value })}
            />
            <Input
              label="Trade Name (Brand / Signboard)"
              value={business?.tradeName || ''}
              onChange={(e) => setBusiness({ ...business, tradeName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input
              label="Permanent Account Number (PAN)"
              value={business?.pan || ''}
              onChange={(e) => setBusiness({ ...business, pan: e.target.value })}
            />
            <Input
              label="Corporate Identity Number (CIN)"
              value={business?.cin || 'U62090TZ2026PTC038755'}
              readOnly
            />
            <Input
              label="Operating State"
              value={`${business?.state || 'Tamil Nadu'} (${business?.stateCode || '33'})`}
              readOnly
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" variant="primary" size="sm" loading={saving} icon={<Check className="w-3.5 h-3.5" />}>
              Save Profile Changes
            </Button>
          </div>
        </form>
      </div>

      {/* Branches List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Operating Branches & Outlets
            </h3>
            <p className="text-xs text-text-secondary">Each branch operates isolated stock and sequential billing.</p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsBranchModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Branch
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch Name</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center">Classification</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium text-text-primary flex items-center gap-2">
                  <Store className="w-3.5 h-3.5 text-text-tertiary" />
                  {b.name}
                </TableCell>
                <TableCell className="font-mono text-accent font-semibold">{b.code}</TableCell>
                <TableCell className="font-mono text-text-secondary">{b.gstin || 'Non-GST / Shared'}</TableCell>
                <TableCell className="text-text-secondary">{b.city}, {b.state}</TableCell>
                <TableCell className="text-center">
                  {b.isHeadOffice ? (
                    <Badge size="sm" variant="accent">Head Office</Badge>
                  ) : (
                    <Badge size="sm" variant="neutral">Branch Outlet</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Fiscal Period & Tax Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-surface-secondary border border-border rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-text-primary font-medium text-xs">
            <Calendar className="w-4 h-4 text-accent" />
            <span>Active Financial Year</span>
          </div>
          <p className="text-sm font-semibold font-mono text-text-primary">FY 2026-2027</p>
          <p className="text-[11px] text-text-secondary">01 April 2026 to 31 March 2027 • Status: Unlocked (Active Posting)</p>
        </div>

        <div className="p-4 bg-surface-secondary border border-border rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-text-primary font-medium text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>GST Statutory Registration</span>
          </div>
          <p className="text-sm font-semibold font-mono text-text-primary">33AAAAA0000A1Z5</p>
          <p className="text-[11px] text-text-secondary">State Code: 33 (Tamil Nadu) • Regular Taxpayer Scheme</p>
        </div>
      </div>

      {/* Add Branch Modal */}
      <Modal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        title="Register New Branch"
        description="Configure a new branch store, warehouse, or regional sales outlet."
      >
        <form onSubmit={handleCreateBranch} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Branch Name *"
              value={branchForm.name}
              onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
              placeholder="e.g. Coimbatore Branch"
              required
            />
            <Input
              label="Branch Code (Unique) *"
              value={branchForm.code}
              onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
              placeholder="e.g. CBE"
              required
            />
          </div>

          <Input
            label="Branch GSTIN (Leave empty if shared)"
            value={branchForm.gstin}
            onChange={(e) => setBranchForm({ ...branchForm, gstin: e.target.value.toUpperCase() })}
            placeholder="e.g. 33AAAAA0000A1Z5"
          />

          <Input
            label="Street Address *"
            value={branchForm.addressLine1}
            onChange={(e) => setBranchForm({ ...branchForm, addressLine1: e.target.value })}
            placeholder="Cross Cut Road, Gandhipuram"
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="City"
              value={branchForm.city}
              onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
            />
            <Input
              label="Pincode"
              value={branchForm.pincode}
              onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })}
            />
          </div>

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsBranchModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={branchSubmitting}>
              Register Branch
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
