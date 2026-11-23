'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { BusinessType, IndustryType } from '@nirvagam/shared';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Plus,
  Trash2,
  Upload,
  Search,
  Filter,
  CheckCircle2,
  Store,
  Layers,
  MapPin,
  Calendar,
  CreditCard,
  FileText,
  X,
  Edit3,
  Sliders,
  ShieldCheck,
  Check,
  Briefcase,
} from 'lucide-react';

interface Branch {
  code: string;
  name: string;
  isHeadOffice: boolean;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
}

interface Profile {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  legalName: string;
  tradeName: string;
  businessType: BusinessType;
  industry: IndustryType;
  gstin: string | null;
  pan: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  stateCode: string;
  jurisdiction: string | null;
  pincode: string;
  financialYearStart: string;
  financialYearEnd: string;
  invoicePrefix: string;
  currency: string;
  taxSettings: Record<string, boolean>;
  logoUrl: string | null;
  digitalSignatureUrl: string | null;
  enabledModules: string[];
  branches: Branch[];
  createdAt: string;
}

interface RegistrationForm {
  profileId: string;
  tenantId: string;
  legalName: string;
  tradeName: string;
  businessType: BusinessType;
  industry: IndustryType;
  gstin: string;
  pan: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  stateCode: string;
  jurisdiction: string;
  pincode: string;
  financialYearStart: string;
  financialYearEnd: string;
  invoicePrefix: string;
  currency: string;
  taxSettings: Record<string, boolean>;
  logoUrl: string;
  digitalSignatureUrl: string;
  enabledModules: string[];
  branches: Branch[];
}

interface Workspace {
  tenants: Array<{ id: string; slug: string; displayName: string; status: string }>;
  profiles: Profile[];
  supportedModules: string[];
  moduleDefaults: Record<string, string[]>;
}

const businessTypes: Array<{ value: BusinessType; label: string }> = [
  { value: BusinessType.PROPRIETORSHIP, label: 'Proprietorship' },
  { value: BusinessType.PARTNERSHIP, label: 'Partnership' },
  { value: BusinessType.LLP, label: 'LLP' },
  { value: BusinessType.PRIVATE_LIMITED, label: 'Private Limited' },
  { value: BusinessType.PUBLIC_LIMITED, label: 'Public Limited' },
  { value: BusinessType.INDIVIDUAL, label: 'Individual' },
  { value: BusinessType.OTHER, label: 'Other' },
];

const industries: Array<{ value: IndustryType; label: string }> = [
  { value: IndustryType.RETAIL, label: 'Retail' },
  { value: IndustryType.WHOLESALE, label: 'Wholesale' },
  { value: IndustryType.SUPERMARKET, label: 'Supermarket' },
  { value: IndustryType.TEXTILE, label: 'Textile' },
  { value: IndustryType.GROCERY, label: 'Grocery' },
  { value: IndustryType.ELECTRICAL, label: 'Electrical' },
  { value: IndustryType.HARDWARE, label: 'Hardware' },
  { value: IndustryType.MEDICAL, label: 'Medical' },
  { value: IndustryType.RESTAURANT, label: 'Restaurant' },
  { value: IndustryType.MANUFACTURING, label: 'Manufacturing' },
  { value: IndustryType.DISTRIBUTOR, label: 'Distributor' },
  { value: IndustryType.SERVICE, label: 'Service' },
  { value: IndustryType.TRADING, label: 'Trading' },
  { value: IndustryType.OTHER, label: 'Other' },
];

const MODULE_DESCRIPTIONS: Record<string, string> = {
  sales: 'Estimates, Sales Orders, Tax Invoices & Delivery Challans',
  purchases: 'Vendor Purchase Orders, Goods Receipt (GRN) & Bills',
  inventory: 'Multi-Warehouse Stock, Batch Numbers & Barcode Tracking',
  accounting: 'General Ledger, Chart of Accounts, Trial Balance & Vouchers',
  pos: 'High-speed Counter Checkout, Touchscreen, Barcode & Receipts',
  gst: 'GSTR-1, GSTR-3B Tax Filing Workflows & E-Invoicing Prep',
  reports: 'Profit & Loss, Balance Sheet, Cash Flow & Stock Aging',
  crm: 'Customer Profiles, Lead Management & Communication History',
};

function getFinancialYear() {
  const today = new Date();
  const startYear = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return {
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
  };
}

function emptyForm(defaultModules: string[] = []): RegistrationForm {
  const fy = getFinancialYear();
  return {
    profileId: '',
    tenantId: '',
    legalName: '',
    tradeName: '',
    businessType: BusinessType.PROPRIETORSHIP,
    industry: IndustryType.RETAIL,
    gstin: '',
    pan: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'Tamil Nadu',
    stateCode: '33',
    jurisdiction: 'State Ward',
    pincode: '',
    financialYearStart: fy.start,
    financialYearEnd: fy.end,
    invoicePrefix: 'INV-',
    currency: 'INR',
    taxSettings: {
      gstRegistered: true,
      compositionScheme: false,
      eInvoicingEnabled: false,
      eWayBillEnabled: false,
    },
    logoUrl: '',
    digitalSignatureUrl: '',
    enabledModules: defaultModules.length ? defaultModules : ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
    branches: [],
  };
}

function dateValue(val?: string) {
  return val ? val.slice(0, 10) : '';
}

export default function PlatformBusinessRegistrationPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<RegistrationForm>(() => emptyForm());
  const [activeFormTab, setActiveFormTab] = useState<'IDENTITY' | 'STATUTORY' | 'TAX_BRANDING' | 'BRANCHES' | 'MODULES'>('IDENTITY');

  // Branch draft state
  const [branchDraft, setBranchDraft] = useState<Branch>({
    code: '',
    name: '',
    isHeadOffice: false,
    gstin: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '',
  });

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<Workspace>('/platform/business-registration');
      setWorkspace(data);
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Failed to load business registration data',
        message: err.message || 'Please check network connection',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewRegistration = () => {
    const defaults = workspace?.moduleDefaults[IndustryType.RETAIL] || [];
    setForm(emptyForm(defaults));
    setActiveFormTab('IDENTITY');
    setIsModalOpen(true);
  };

  const openEditRegistration = (profile: Profile) => {
    setForm({
      profileId: profile.id,
      tenantId: profile.tenantId,
      legalName: profile.legalName,
      tradeName: profile.tradeName,
      businessType: profile.businessType,
      industry: profile.industry,
      gstin: profile.gstin || '',
      pan: profile.pan || '',
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2 || '',
      city: profile.city,
      state: profile.state,
      stateCode: profile.stateCode,
      jurisdiction: profile.jurisdiction || '',
      pincode: profile.pincode,
      financialYearStart: dateValue(profile.financialYearStart),
      financialYearEnd: dateValue(profile.financialYearEnd),
      invoicePrefix: profile.invoicePrefix,
      currency: profile.currency || 'INR',
      taxSettings: {
        gstRegistered: true,
        compositionScheme: false,
        eInvoicingEnabled: false,
        eWayBillEnabled: false,
        ...(profile.taxSettings || {}),
      },
      logoUrl: profile.logoUrl || '',
      digitalSignatureUrl: profile.digitalSignatureUrl || '',
      enabledModules: profile.enabledModules || [],
      branches: profile.branches || [],
    });
    setActiveFormTab('IDENTITY');
    setIsModalOpen(true);
  };

  const handleDeleteProfile = async (profileId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete business registration "${name}"?`)) {
      return;
    }
    try {
      await apiFetch(`/platform/business-registration/${profileId}`, { method: 'DELETE' });
      toast({ type: 'success', title: 'Deleted', message: `Business profile "${name}" deleted.` });
      await loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Delete failed', message: err.message || 'Could not delete profile' });
    }
  };

  // Automated category-driven defaults
  const handleCategoryChange = (newIndustry: IndustryType) => {
    const defaults = workspace?.moduleDefaults?.[newIndustry] || [];
    setForm((current) => ({
      ...current,
      industry: newIndustry,
      enabledModules: defaults.length ? defaults : current.enabledModules,
    }));
  };

  // Auto-extract PAN from GSTIN if 15 chars
  const handleGstinChange = (val: string) => {
    const upper = val.toUpperCase().trim();
    let pan = form.pan;
    if (upper.length >= 12) {
      const extractedPan = upper.substring(2, 12);
      if (/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(extractedPan)) {
        pan = extractedPan;
      }
    }
    setForm((prev) => ({ ...prev, gstin: upper, pan }));
  };

  const handleImageUpload = (field: 'logoUrl' | 'digitalSignatureUrl', file?: File) => {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 1024 * 1024) {
      toast({
        type: 'error',
        title: 'Unsupported file',
        message: 'Please choose a PNG, JPEG, or WebP image under 1 MB.',
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((prev) => ({ ...prev, [field]: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const addBranchToForm = () => {
    if (!branchDraft.code.trim() || !branchDraft.name.trim() || !branchDraft.addressLine1.trim() || !branchDraft.city.trim() || !branchDraft.pincode.trim()) {
      toast({
        type: 'warning',
        title: 'Incomplete branch',
        message: 'Branch code, name, address, city, and pincode are required.',
      });
      return;
    }
    if (form.branches.some((b) => b.code.toUpperCase() === branchDraft.code.trim().toUpperCase())) {
      toast({ type: 'warning', title: 'Duplicate code', message: 'A branch with this code already exists.' });
      return;
    }

    setForm((prev) => ({
      ...prev,
      branches: [
        ...prev.branches,
        {
          ...branchDraft,
          code: branchDraft.code.trim().toUpperCase(),
          name: branchDraft.name.trim(),
        },
      ],
    }));

    setBranchDraft({
      code: '',
      name: '',
      isHeadOffice: false,
      gstin: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '',
    });
  };

  const removeBranchFromForm = (index: number) => {
    setForm((prev) => ({
      ...prev,
      branches: prev.branches.filter((_, i) => i !== index),
    }));
  };

  const toggleModuleInForm = (mod: string) => {
    setForm((prev) => {
      const exists = prev.enabledModules.includes(mod);
      return {
        ...prev,
        enabledModules: exists ? prev.enabledModules.filter((m) => m !== mod) : [...prev.enabledModules, mod],
      };
    });
  };

  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tradeName.trim() || !form.legalName.trim()) {
      toast({ type: 'warning', title: 'Missing details', message: 'Trade name and legal name are required.' });
      return;
    }
    if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      toast({ type: 'warning', title: 'Missing address', message: 'Complete the registered address.' });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        tenantId: form.tenantId || undefined,
        legalName: form.legalName.trim(),
        tradeName: form.tradeName.trim(),
        businessType: form.businessType,
        industry: form.industry,
        gstin: form.gstin.trim() || undefined,
        pan: form.pan.trim() || undefined,
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        stateCode: form.stateCode.trim(),
        jurisdiction: form.jurisdiction.trim() || undefined,
        pincode: form.pincode.trim(),
        financialYearStart: form.financialYearStart,
        financialYearEnd: form.financialYearEnd,
        invoicePrefix: form.invoicePrefix.trim() || 'INV-',
        currency: form.currency.trim() || 'INR',
        taxSettings: form.taxSettings,
        logoUrl: form.logoUrl || null,
        digitalSignatureUrl: form.digitalSignatureUrl || null,
        enabledModules: form.enabledModules,
        branches: form.branches,
      };

      if (form.profileId) {
        await apiFetch(`/platform/business-registration/${form.profileId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast({ type: 'success', title: 'Updated', message: 'Business registration updated successfully.' });
      } else {
        await apiFetch('/platform/business-registration', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast({ type: 'success', title: 'Registered', message: 'New business profile registered successfully.' });
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Registration failed',
        message: err.message || 'Could not save business registration',
      });
    } finally {
      setSaving(false);
    }
  };

  // Filter profiles
  const filteredProfiles = useMemo(() => {
    if (!workspace?.profiles) return [];
    return workspace.profiles.filter((p) => {
      const matchSearch =
        searchQuery === '' ||
        p.tradeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.legalName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.gstin && p.gstin.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.pan && p.pan.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType = selectedTypeFilter === 'ALL' || p.businessType === selectedTypeFilter;
      const matchCat = selectedCategoryFilter === 'ALL' || p.industry === selectedCategoryFilter;

      return matchSearch && matchType && matchCat;
    });
  }, [workspace?.profiles, searchQuery, selectedTypeFilter, selectedCategoryFilter]);

  const totalBranches = useMemo(() => {
    return workspace?.profiles.reduce((acc, p) => acc + (p.branches?.length || 0), 0) || 0;
  }, [workspace?.profiles]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Module Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              <Briefcase className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-semibold text-text-primary tracking-[-0.01em]">
              MODULE 1: BUSINESS REGISTRATION
            </h1>
            <Badge variant="accent" size="sm">Platform Super Admin</Badge>
          </div>
          <p className="text-xs text-text-secondary mt-1 max-w-2xl">
            Register and configure multiple business profiles, legal structures, state tax jurisdictions,
            multi-branch topologies, and category-tailored ERP workflows.
          </p>
        </div>

        {/* Primary Action Button */}
        <Button
          type="button"
          variant="primary"
          onClick={openNewRegistration}
          icon={<Plus className="w-4 h-4" />}
          className="shadow-sm"
        >
          Register New Business
        </Button>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="macos-card p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Registered Businesses</p>
          <p className="text-xl font-bold text-text-primary">{workspace?.profiles.length || 0}</p>
          <span className="text-[11px] text-text-tertiary">Multi-profile support active</span>
        </div>
        <div className="macos-card p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Operating Branches</p>
          <p className="text-xl font-bold text-text-primary">{totalBranches}</p>
          <span className="text-[11px] text-text-tertiary">Across head offices & retail</span>
        </div>
        <div className="macos-card p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">Active Categories</p>
          <p className="text-xl font-bold text-text-primary">{new Set(workspace?.profiles.map((p) => p.industry)).size}</p>
          <span className="text-[11px] text-text-tertiary">Tailored workflows & templates</span>
        </div>
        <div className="macos-card p-3.5 space-y-1">
          <p className="text-[11px] font-medium text-text-secondary uppercase tracking-wider">GST Registered</p>
          <p className="text-xl font-bold text-accent">
            {workspace?.profiles.filter((p) => p.taxSettings?.gstRegistered).length || 0}
          </p>
          <span className="text-[11px] text-text-tertiary">Statutory compliance verified</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="macos-card p-3 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search registered businesses by trade name, legal name, GSTIN, PAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-surface border border-border/80 rounded-md text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-text-secondary shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Type:</span>
          </div>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="text-xs bg-surface border border-border/80 rounded-md px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="ALL">All Business Types</option>
            {businessTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5 text-xs text-text-secondary shrink-0 ml-1">
            <span>Category:</span>
          </div>
          <select
            value={selectedCategoryFilter}
            onChange={(e) => setSelectedCategoryFilter(e.target.value)}
            className="text-xs bg-surface border border-border/80 rounded-md px-2 py-1.5 text-text-primary focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="ALL">All Categories</option>
            {industries.map((ind) => (
              <option key={ind.value} value={ind.value}>{ind.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main List: Registered Businesses */}
      {loading ? (
        <div className="macos-card p-12 text-center text-text-secondary space-y-3">
          <div className="w-8 h-8 rounded-lg bg-accent animate-pulse mx-auto" />
          <p className="text-xs font-mono">Loading registered business profiles...</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="macos-card p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mx-auto">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-primary">No Business Registrations Found</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              {workspace?.profiles.length === 0
                ? 'Get started by clicking the Register New Business button to register your first enterprise profile.'
                : 'No registered businesses match your search or filter criteria.'}
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openNewRegistration}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Register New Business
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              className="macos-card p-4 hover:border-accent/40 transition-all duration-150 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                {profile.logoUrl ? (
                  <img
                    src={profile.logoUrl}
                    alt={profile.tradeName}
                    className="w-12 h-12 rounded-lg object-contain border border-border/80 bg-surface shrink-0 p-1"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-bold text-base shrink-0">
                    {profile.tradeName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary tracking-tight">
                      {profile.tradeName}
                    </h3>
                    <Badge variant="neutral" size="sm">{profile.businessType}</Badge>
                    <Badge variant="accent" size="sm">{profile.industry}</Badge>
                    {profile.taxSettings?.gstRegistered && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success bg-success/10 px-2 py-0.5 rounded">
                        <CheckCircle2 className="w-3 h-3" /> GST Active
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-text-secondary">
                    Legal: <span className="text-text-primary font-medium">{profile.legalName}</span>
                    {profile.gstin && (
                      <span className="ml-2 font-mono">GSTIN: {profile.gstin}</span>
                    )}
                    {profile.pan && (
                      <span className="ml-2 font-mono">PAN: {profile.pan}</span>
                    )}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-text-tertiary pt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {profile.city}, {profile.state} ({profile.pincode})
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      FY: {profile.financialYearStart} to {profile.financialYearEnd}
                    </span>
                    <span className="flex items-center gap-1">
                      <Store className="w-3 h-3" />
                      {profile.branches?.length || 0} Branches
                    </span>
                    <span className="font-mono text-text-secondary">Prefix: {profile.invoicePrefix}</span>
                  </div>

                  {/* Modules Pills */}
                  <div className="flex flex-wrap gap-1 pt-1.5">
                    {profile.enabledModules?.map((mod) => (
                      <span
                        key={mod}
                        className="text-[10px] font-medium bg-surface-secondary border border-border/70 rounded px-1.5 py-0.5 text-text-secondary uppercase tracking-tight"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditRegistration(profile)}
                  icon={<Edit3 className="w-3.5 h-3.5" />}
                >
                  Edit Details
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => handleDeleteProfile(profile.id, profile.tradeName)}
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                  aria-label="Delete profile"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* REGISTRATION MODAL FORM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface-secondary/40 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary tracking-tight">
                    {form.profileId ? `Edit Business: ${form.tradeName}` : 'Register New Business'}
                  </h2>
                  <p className="text-[11px] text-text-secondary">
                    Module 1 statutory registration, jurisdiction, tax setup, multiple branches, and category workflows.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="flex border-b border-border bg-surface px-6 overflow-x-auto shrink-0 gap-1">
              {[
                { key: 'IDENTITY', label: '1. Identity & Structure' },
                { key: 'STATUTORY', label: '2. Address & Fiscal' },
                { key: 'TAX_BRANDING', label: '3. Tax & Branding' },
                { key: 'BRANCHES', label: `4. Branches (${form.branches.length})` },
                { key: 'MODULES', label: `5. Modules & Workflows (${form.enabledModules.length})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveFormTab(tab.key as any)}
                  className={`py-2.5 px-3 text-xs font-medium border-b-2 transition-all whitespace-nowrap ${
                    activeFormTab === tab.key
                      ? 'border-accent text-accent font-semibold'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Form Scrollable Content */}
            <form onSubmit={handleSaveRegistration} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: IDENTITY */}
              {activeFormTab === 'IDENTITY' && (
                <div className="space-y-4">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Business Identity & Structural Classification
                    </h3>
                    <p className="text-[11px] text-text-tertiary">
                      Select legal constitution and business category to automatically configure workflows.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Business / Trade Name *"
                      placeholder="e.g. Kavitha Textiles India"
                      value={form.tradeName}
                      required
                      onChange={(e) => setForm({ ...form, tradeName: e.target.value })}
                    />
                    <Input
                      label="Legal Registered Business Name *"
                      placeholder="e.g. Kavitha Textiles India Private Limited"
                      value={form.legalName}
                      required
                      onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select
                      label="Business Type (Constitution) *"
                      value={form.businessType}
                      onChange={(e) => setForm({ ...form, businessType: e.target.value as BusinessType })}
                    >
                      {businessTypes.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </Select>

                    <Select
                      label="Business Category / Industry Selection *"
                      value={form.industry}
                      onChange={(e) => handleCategoryChange(e.target.value as IndustryType)}
                    >
                      {industries.map((ind) => (
                        <option key={ind.value} value={ind.value}>{ind.label}</option>
                      ))}
                    </Select>
                  </div>

                  {/* Informational banner regarding category-driven defaults */}
                  <div className="p-3 bg-accent/5 border border-accent/20 rounded-lg flex items-start gap-2.5">
                    <Sliders className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="text-[11px] space-y-0.5">
                      <p className="font-semibold text-text-primary">
                        Automated Category Workflow Applied: {form.industry}
                      </p>
                      <p className="text-text-secondary">
                        Document templates, default invoicing rules, and relevant ERP modules are automatically pre-configured.
                        You can customize individual modules in Tab 5.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <Input
                      label="GSTIN Registration (15 Characters)"
                      placeholder="e.g. 33AAAAA0000A1Z5"
                      value={form.gstin}
                      maxLength={15}
                      onChange={(e) => handleGstinChange(e.target.value)}
                    />
                    <Input
                      label="PAN (Permanent Account Number)"
                      placeholder="e.g. AAAAA0000A"
                      value={form.pan}
                      maxLength={10}
                      onChange={(e) => setForm({ ...form, pan: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: STATUTORY & ADDRESS */}
              {activeFormTab === 'STATUTORY' && (
                <div className="space-y-4">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Registered Address & Fiscal Configuration
                    </h3>
                    <p className="text-[11px] text-text-tertiary">
                      Official correspondence address, state jurisdiction, and financial year boundaries.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Address Line 1 (Street / Building) *"
                      placeholder="e.g. 142 Salem Main Road"
                      value={form.addressLine1}
                      required
                      onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                    />
                    <Input
                      label="Address Line 2 (Area / Landmark)"
                      placeholder="e.g. Near Bus Stand, Gandhi Nagar"
                      value={form.addressLine2}
                      onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input
                      label="City *"
                      placeholder="e.g. Namakkal"
                      value={form.city}
                      required
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                    <Input
                      label="Operating State *"
                      placeholder="e.g. Tamil Nadu"
                      value={form.state}
                      required
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                    />
                    <Input
                      label="State Code (2-digit GST) *"
                      placeholder="e.g. 33"
                      value={form.stateCode}
                      maxLength={2}
                      required
                      onChange={(e) => setForm({ ...form, stateCode: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="PIN / Postal Code *"
                      placeholder="e.g. 637001"
                      value={form.pincode}
                      maxLength={10}
                      required
                      onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                    />
                    <Input
                      label="Tax Jurisdiction / Assessment Ward"
                      placeholder="e.g. Ward 4 / Range II - Central Division"
                      value={form.jurisdiction}
                      onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })}
                    />
                  </div>

                  <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <Input
                      label="Financial Year Starts *"
                      type="date"
                      value={form.financialYearStart}
                      required
                      onChange={(e) => setForm({ ...form, financialYearStart: e.target.value })}
                    />
                    <Input
                      label="Financial Year Ends *"
                      type="date"
                      value={form.financialYearEnd}
                      required
                      onChange={(e) => setForm({ ...form, financialYearEnd: e.target.value })}
                    />
                    <Input
                      label="Invoice Prefix *"
                      placeholder="e.g. INV-"
                      value={form.invoicePrefix}
                      required
                      onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })}
                    />
                    <Input
                      label="Currency Code *"
                      placeholder="INR"
                      value={form.currency}
                      maxLength={10}
                      required
                      onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: TAX SETTINGS & BRANDING */}
              {activeFormTab === 'TAX_BRANDING' && (
                <div className="space-y-5">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Statutory Tax Flags & Brand Assets
                    </h3>
                    <p className="text-[11px] text-text-tertiary">
                      Configure GST compliance modes, e-way bills, business logo, and digital signature for invoices.
                    </p>
                  </div>

                  {/* Tax Toggles */}
                  <div className="macos-card p-4 space-y-3">
                    <p className="text-xs font-semibold text-text-primary">Tax & Regulatory Configuration</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Switch
                          label="GST Registered Business"
                          checked={form.taxSettings.gstRegistered || false}
                          onChange={(v) => setForm({ ...form, taxSettings: { ...form.taxSettings, gstRegistered: v } })}
                        />
                        <p className="text-[11px] text-text-tertiary pl-11">Enables CGST, SGST, IGST tax breakdown on invoices</p>
                      </div>
                      <div className="space-y-1">
                        <Switch
                          label="Composition Scheme"
                          checked={form.taxSettings.compositionScheme || false}
                          onChange={(v) => setForm({ ...form, taxSettings: { ...form.taxSettings, compositionScheme: v } })}
                        />
                        <p className="text-[11px] text-text-tertiary pl-11">Simplified tax filing with fixed turnover percentage</p>
                      </div>
                      <div className="space-y-1">
                        <Switch
                          label="E-Invoicing Enabled"
                          checked={form.taxSettings.eInvoicingEnabled || false}
                          onChange={(v) => setForm({ ...form, taxSettings: { ...form.taxSettings, eInvoicingEnabled: v } })}
                        />
                        <p className="text-[11px] text-text-tertiary pl-11">Direct QR-code and IRN generation for invoices</p>
                      </div>
                      <div className="space-y-1">
                        <Switch
                          label="E-Way Bill Generation"
                          checked={form.taxSettings.eWayBillEnabled || false}
                          onChange={(v) => setForm({ ...form, taxSettings: { ...form.taxSettings, eWayBillEnabled: v } })}
                        />
                        <p className="text-[11px] text-text-tertiary pl-11">Consignment tracking for shipments &gt; ₹50,000</p>
                      </div>
                    </div>
                  </div>

                  {/* Branding Uploads */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Logo */}
                    <div className="macos-card p-4 space-y-3">
                      <p className="text-xs font-semibold text-text-primary">Business Brand Logo</p>
                      <p className="text-[11px] text-text-secondary">
                        Appears on printed invoices, delivery challans, and customer receipts.
                      </p>
                      <div className="flex items-center gap-3">
                        <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-secondary shrink-0 hover:border-accent">
                          {form.logoUrl ? (
                            <img src={form.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
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
                          <p className="text-xs font-medium text-text-primary">Upload Logo (PNG, JPG, WebP)</p>
                          <p className="text-[11px] text-text-tertiary">Max size: 1 MB</p>
                          {form.logoUrl && (
                            <button
                              type="button"
                              className="text-[11px] text-danger font-medium hover:underline"
                              onClick={() => setForm({ ...form, logoUrl: '' })}
                            >
                              Remove Logo
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Signature */}
                    <div className="macos-card p-4 space-y-3">
                      <p className="text-xs font-semibold text-text-primary">Authorized Digital Signature</p>
                      <p className="text-[11px] text-text-secondary">
                        Auto-signed on tax invoice PDF exports and debit/credit notes.
                      </p>
                      <div className="flex items-center gap-3">
                        <label className="flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-secondary shrink-0 hover:border-accent">
                          {form.digitalSignatureUrl ? (
                            <img src={form.digitalSignatureUrl} alt="Signature" className="h-full w-full object-contain p-1" />
                          ) : (
                            <Upload className="h-5 w-5 text-text-tertiary" />
                          )}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="sr-only"
                            onChange={(e) => handleImageUpload('digitalSignatureUrl', e.target.files?.[0])}
                          />
                        </label>
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-text-primary">Upload Signature Image</p>
                          <p className="text-[11px] text-text-tertiary">Max size: 1 MB</p>
                          {form.digitalSignatureUrl && (
                            <button
                              type="button"
                              className="text-[11px] text-danger font-medium hover:underline"
                              onClick={() => setForm({ ...form, digitalSignatureUrl: '' })}
                            >
                              Remove Signature
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: BRANCHES CONFIGURATION */}
              {activeFormTab === 'BRANCHES' && (
                <div className="space-y-4">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Multiple Branch & Warehouse Configuration
                    </h3>
                    <p className="text-[11px] text-text-tertiary">
                      Configure multiple retail branches, fulfillment centers, and head office operating locations.
                    </p>
                  </div>

                  {/* List of existing branches */}
                  {form.branches.length === 0 ? (
                    <div className="p-4 rounded-lg border border-dashed border-border text-center text-xs text-text-secondary">
                      No branches added yet. Configure your primary head office branch below.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {form.branches.map((b, idx) => (
                        <div
                          key={`${b.code}-${idx}`}
                          className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-text-primary">{b.name}</span>
                              <span className="font-mono text-[11px] text-text-secondary">({b.code})</span>
                              {b.isHeadOffice && (
                                <Badge variant="accent" size="sm">Head Office</Badge>
                              )}
                            </div>
                            <p className="text-[11px] text-text-secondary">
                              {b.addressLine1}, {b.city}, {b.state} ({b.pincode})
                              {b.gstin && <span className="ml-2 font-mono">GSTIN: {b.gstin}</span>}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeBranchFromForm(idx)}
                            className="p-1.5 text-text-tertiary hover:text-danger rounded hover:bg-danger/10 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Branch Builder Box */}
                  <div className="macos-card p-4 space-y-3 bg-surface-secondary/40">
                    <p className="text-xs font-semibold text-text-primary">Add New Branch Location</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input
                        label="Branch Code *"
                        placeholder="e.g. HO-01"
                        value={branchDraft.code}
                        onChange={(e) => setBranchDraft({ ...branchDraft, code: e.target.value.toUpperCase() })}
                      />
                      <Input
                        label="Branch Name *"
                        placeholder="e.g. Namakkal Head Office"
                        value={branchDraft.name}
                        onChange={(e) => setBranchDraft({ ...branchDraft, name: e.target.value })}
                      />
                      <Input
                        label="Branch GSTIN (Optional)"
                        placeholder="Leave blank if shared"
                        value={branchDraft.gstin}
                        onChange={(e) => setBranchDraft({ ...branchDraft, gstin: e.target.value.toUpperCase() })}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <Input
                        label="Branch Address *"
                        placeholder="Street / Locality"
                        value={branchDraft.addressLine1}
                        onChange={(e) => setBranchDraft({ ...branchDraft, addressLine1: e.target.value })}
                      />
                      <Input
                        label="City *"
                        placeholder="City"
                        value={branchDraft.city}
                        onChange={(e) => setBranchDraft({ ...branchDraft, city: e.target.value })}
                      />
                      <Input
                        label="State *"
                        placeholder="State"
                        value={branchDraft.state}
                        onChange={(e) => setBranchDraft({ ...branchDraft, state: e.target.value })}
                      />
                      <Input
                        label="PIN Code *"
                        placeholder="Pincode"
                        value={branchDraft.pincode}
                        onChange={(e) => setBranchDraft({ ...branchDraft, pincode: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <Switch
                        label="Mark as Head Office Branch"
                        checked={branchDraft.isHeadOffice}
                        onChange={(v) => setBranchDraft({ ...branchDraft, isHeadOffice: v })}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={addBranchToForm}
                        icon={<Plus className="w-3.5 h-3.5" />}
                      >
                        Add Branch
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: MODULES & WORKFLOWS */}
              {activeFormTab === 'MODULES' && (
                <div className="space-y-4">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Supported Business Modules & Workflow Permissions
                    </h3>
                    <p className="text-[11px] text-text-tertiary">
                      During onboarding, selecting category ({form.industry}) tailored these modules.
                      The business owner can manually enable or disable any module below.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(workspace?.supportedModules || Object.keys(MODULE_DESCRIPTIONS)).map((mod) => {
                      const isEnabled = form.enabledModules.includes(mod);
                      return (
                        <div
                          key={mod}
                          onClick={() => toggleModuleInForm(mod)}
                          className={`p-3.5 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                            isEnabled
                              ? 'border-accent bg-accent/5'
                              : 'border-border bg-surface hover:bg-surface-secondary/50'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-text-primary uppercase tracking-tight">
                              {mod}
                            </p>
                            <p className="text-[11px] text-text-secondary">
                              {MODULE_DESCRIPTIONS[mod] || 'Enterprise ERP functional capability'}
                            </p>
                          </div>
                          <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                            isEnabled ? 'bg-accent border-accent text-white' : 'border-border bg-surface'
                          }`}>
                            {isEnabled && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  icon={<Check className="w-4 h-4" />}
                >
                  {form.profileId ? 'Save Changes' : 'Complete Business Registration'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
