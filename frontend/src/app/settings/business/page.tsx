'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Switch } from '@/components/ui/switch';
import { Building2, Plus, Store, Calendar, ShieldCheck, Check, Edit3, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

function getProfileValues(business: any) {
  return {
    legalName: business?.legalName || '',
    tradeName: business?.tradeName || '',
    pan: business?.pan || '',
    phone: business?.phone || '',
    email: business?.email || '',
    logoUrl: business?.logoUrl || '',
    signatureUrl: business?.signatureUrl || '',
    taxSettings: { ...(business?.taxSettings || {}) },
  };
}

function emptyBranchForm() {
  return {
    name: '',
    code: '',
    gstin: '',
    phone: '',
    addressLine1: '',
    city: 'Chennai',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '600001',
    isHeadOffice: false,
  };
}

export default function BusinessSettingsPage() {
  const [business, setBusiness] = useState<any>(null);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [savedProfile, setSavedProfile] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchSubmitting, setBranchSubmitting] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchBusinessId, setEditingBranchBusinessId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState(emptyBranchForm);

  const { toast } = useToast();
  const profileHasChanges =
    !!business &&
    !!savedProfile &&
    JSON.stringify(getProfileValues(business)) !== JSON.stringify(savedProfile);

  const loadBusiness = async (preferredBusinessId?: string) => {
    try {
      setLoading(true);
      const bizList = await apiFetch<any[]>('/businesses');
      const businessList = Array.isArray(bizList) ? bizList : [];
      setBusinesses(businessList);
      setBranches(
        businessList.flatMap((item) =>
          (Array.isArray(item.branches) ? item.branches : []).map((branch: any) => ({
            ...branch,
            businessId: item.id,
            businessName: item.tradeName || item.legalName,
          })),
        ),
      );

      if (businessList.length > 0) {
        const selectedBusiness =
          businessList.find((item) => item.id === (preferredBusinessId || selectedBusinessId)) ||
          businessList[0];
        setSelectedBusinessId(selectedBusiness.id);
        const fullBiz = await apiFetch(`/businesses/${selectedBusiness.id}`);
        setBusiness(fullBiz);
        setSavedProfile(getProfileValues(fullBiz));
      } else {
        setBusiness(null);
        setSavedProfile(null);
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
          logoUrl: business.logoUrl || null,
          signatureUrl: business.signatureUrl || null,
          taxSettings: business.taxSettings || {},
        }),
      });
      setSavedProfile(getProfileValues(business));
      toast({ type: 'success', title: 'Saved', message: 'Business profile updated successfully.' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Update failed', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = (field: 'logoUrl' | 'signatureUrl', file?: File) => {
    if (!file) return;
    if (file.size > 1024 * 1024) {
      toast({ type: 'warning', title: 'Image is too large', message: 'Choose an image smaller than 1 MB.' });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        toast({ type: 'error', title: 'Upload failed', message: 'The selected image could not be read.' });
        return;
      }
      setBusiness((current: any) => ({ ...current, [field]: reader.result }));
    };
    reader.onerror = () => {
      toast({ type: 'error', title: 'Upload failed', message: 'The selected image could not be read.' });
    };
    reader.readAsDataURL(file);
  };

  const updateTaxSetting = (key: string, value: boolean) => {
    setBusiness((current: any) => ({
      ...current,
      taxSettings: { ...(current?.taxSettings || {}), [key]: value },
    }));
  };

  const openBranchEditor = (branch: any) => {
    setEditingBranchId(branch.id);
    setEditingBranchBusinessId(branch.businessId);
    setBranchForm({
      name: branch.name || '',
      code: branch.code || '',
      gstin: branch.gstin || '',
      phone: branch.phone || '',
      addressLine1: branch.addressLine1 || '',
      city: branch.city || '',
      state: branch.state || '',
      stateCode: branch.stateCode || '',
      pincode: branch.pincode || '',
      isHeadOffice: !!branch.isHeadOffice,
    });
    setIsBranchModalOpen(true);
  };

  const openNewBranchForm = () => {
    setEditingBranchId(null);
    setEditingBranchBusinessId(null);
    setBranchForm(emptyBranchForm());
    setIsBranchModalOpen(true);
  };

  const closeBranchForm = () => {
    setIsBranchModalOpen(false);
    setEditingBranchId(null);
    setEditingBranchBusinessId(null);
    setBranchForm(emptyBranchForm());
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchForm.name || !branchForm.code || !business?.id) {
      toast({ type: 'warning', title: 'Missing fields', message: 'Branch name and unique code are required.' });
      return;
    }

    try {
      setBranchSubmitting(true);
      const branchBusinessId = editingBranchBusinessId || business.id;
      await apiFetch(
        editingBranchId
          ? `/businesses/${branchBusinessId}/branches/${editingBranchId}`
          : `/businesses/${branchBusinessId}/branches`,
        {
          method: editingBranchId ? 'PUT' : 'POST',
          body: JSON.stringify(branchForm),
        },
      );

      toast({
        type: 'success',
        title: editingBranchId ? 'Branch updated' : 'Branch added',
        message: `Branch ${branchForm.name} ${editingBranchId ? 'updated' : 'registered'}.`,
      });
      closeBranchForm();
      await loadBusiness(selectedBusinessId);
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to save branch', message: err.message });
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

      {businesses.length > 1 && (
        <div className="max-w-sm">
          <Select
            label="Business Profile"
            value={selectedBusinessId}
            onChange={(e) => {
              const nextBusinessId = e.target.value;
              setSelectedBusinessId(nextBusinessId);
              loadBusiness(nextBusinessId);
            }}
          >
            {businesses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.tradeName || item.legalName}
              </option>
            ))}
          </Select>
        </div>
      )}

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="Business Email"
              type="email"
              value={business?.email || ''}
              onChange={(e) => setBusiness({ ...business, email: e.target.value })}
            />
            <Input
              label="Business Phone"
              type="tel"
              value={business?.phone || ''}
              onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border bg-surface-secondary/40 p-3">
              <p className="mb-2 text-xs font-semibold text-text-primary">Business Logo</p>
              <div className="flex items-center gap-3">
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-surface hover:border-accent">
                  {business?.logoUrl ? (
                    <img src={business.logoUrl} alt="Business logo" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Upload className="h-5 w-5 text-text-tertiary" />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => handleImageUpload('logoUrl', e.target.files?.[0])}
                  />
                </label>
                <div className="space-y-1">
                  <p className="text-[11px] text-text-secondary">PNG, JPG, or WebP up to 1 MB</p>
                  {business?.logoUrl && (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-danger hover:underline"
                      onClick={() => setBusiness({ ...business, logoUrl: '' })}
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface-secondary/40 p-3">
              <p className="mb-2 text-xs font-semibold text-text-primary">Authorized Digital Signature</p>
              <div className="flex items-center gap-3">
                <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-surface hover:border-accent">
                  {business?.signatureUrl ? (
                    <img src={business.signatureUrl} alt="Digital signature" className="h-full w-full object-contain p-1" />
                  ) : (
                    <Upload className="h-5 w-5 text-text-tertiary" />
                  )}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(e) => handleImageUpload('signatureUrl', e.target.files?.[0])}
                  />
                </label>
                <div className="space-y-1">
                  <p className="text-[11px] text-text-secondary">PNG, JPG, or WebP up to 1 MB</p>
                  {business?.signatureUrl && (
                    <button
                      type="button"
                      className="text-[11px] font-medium text-danger hover:underline"
                      onClick={() => setBusiness({ ...business, signatureUrl: '' })}
                    >
                      Remove signature
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-surface-secondary/40 p-3 space-y-3">
            <div>
              <h4 className="text-xs font-semibold text-text-primary">Tax Settings</h4>
              <p className="mt-0.5 text-[11px] text-text-secondary">
                GSTIN can be configured per branch. Changes here are included with profile changes.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Switch
                label="GST registered"
                checked={!!business?.taxSettings?.gstRegistered}
                onChange={(checked) => updateTaxSetting('gstRegistered', checked)}
              />
              <Switch
                label="Composition scheme"
                checked={!!business?.taxSettings?.compositionScheme}
                onChange={(checked) => updateTaxSetting('compositionScheme', checked)}
              />
              <Switch
                label="E-invoicing enabled"
                checked={!!business?.taxSettings?.eInvoicingEnabled}
                onChange={(checked) => updateTaxSetting('eInvoicingEnabled', checked)}
              />
              <Switch
                label="E-way bill enabled"
                checked={!!business?.taxSettings?.eWayBillEnabled}
                onChange={(checked) => updateTaxSetting('eWayBillEnabled', checked)}
              />
            </div>
          </div>

          {profileHasChanges && (
            <div className="flex justify-end pt-2">
              <Button type="submit" variant="primary" size="sm" loading={saving} icon={<Check className="w-3.5 h-3.5" />}>
                Save Profile Changes
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* Branches List Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Operating Branches & Outlets
            </h3>
            <p className="text-xs text-text-secondary">
              Showing branches from all business profiles. New branches are added to the selected profile.
            </p>
          </div>
          <Button
            size="sm"
            variant="primary"
            onClick={openNewBranchForm}
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
              <TableHead>Business</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center">Classification</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-text-secondary">
                  No branches configured yet.
                </TableCell>
              </TableRow>
            ) : branches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium text-text-primary flex items-center gap-2">
                  <Store className="w-3.5 h-3.5 text-text-tertiary" />
                  {b.name}
                </TableCell>
                <TableCell className="font-mono text-accent font-semibold">{b.code}</TableCell>
                <TableCell className="text-text-secondary">{b.businessName}</TableCell>
                <TableCell className="font-mono text-text-secondary">{b.gstin || 'Non-GST / Shared'}</TableCell>
                <TableCell className="text-text-secondary">{b.city}, {b.state}</TableCell>
                <TableCell className="text-center">
                  {b.isHeadOffice ? (
                    <Badge size="sm" variant="accent">Head Office</Badge>
                  ) : (
                    <Badge size="sm" variant="neutral">Branch Outlet</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    icon={<Edit3 className="h-3.5 w-3.5" />}
                    onClick={() => openBranchEditor(b)}
                  >
                    Edit
                  </Button>
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
          <p className="text-sm font-semibold font-mono text-text-primary">
            {branches.find((branch) => branch.gstin)?.gstin || 'No GSTIN configured'}
          </p>
          <p className="text-[11px] text-text-secondary">
            Edit a branch to update its GSTIN and statutory location.
          </p>
        </div>
      </div>

      {/* Add Branch Modal */}
      <Modal
        isOpen={isBranchModalOpen}
        onClose={closeBranchForm}
        title={editingBranchId ? 'Edit Branch Configuration' : 'Register New Branch'}
        description={editingBranchId
          ? 'Update branch details, tax registration, and location.'
          : 'Configure a new branch store or regional sales outlet.'}
      >
        <form onSubmit={handleSaveBranch} className="space-y-3">
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
              required
            />
            <Input
              label="State"
              value={branchForm.state}
              onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="State Code"
              value={branchForm.stateCode}
              onChange={(e) => setBranchForm({ ...branchForm, stateCode: e.target.value })}
              required
            />
            <Input
              label="Pincode"
              value={branchForm.pincode}
              onChange={(e) => setBranchForm({ ...branchForm, pincode: e.target.value })}
              required
            />
          </div>

          <Input
            label="Branch Phone"
            type="tel"
            value={branchForm.phone}
            onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
          />

          <Switch
            label="Set as head office"
            checked={branchForm.isHeadOffice}
            onChange={(isHeadOffice) => setBranchForm({ ...branchForm, isHeadOffice })}
          />

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={closeBranchForm}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={branchSubmitting}>
              {editingBranchId ? 'Save Branch Changes' : 'Register Branch'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
