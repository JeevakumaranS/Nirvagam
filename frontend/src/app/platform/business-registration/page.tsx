'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { BusinessType, IndustryType } from '@nirvagam/shared';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Plus,
  Trash2,
  Upload,
  Search,
  CheckCircle2,
  Eye,
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
  ArrowRight,
  Briefcase,
  ChevronDown,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface Branch {
  code: string;
  name: string;
  isHeadOffice: boolean;
  gstin: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
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
  district: string | null;
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
  username: string | null;
  requirePasswordChange: boolean;
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
  district: string;
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
  username: string;
  temporaryPassword: string;
  requirePasswordChange: boolean;
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

const REGISTRATION_STEPS = ['IDENTITY', 'STATUTORY', 'TAX_BRANDING', 'BRANCHES', 'MODULES', 'SETTINGS'] as const;

const STATE_GST_CODES: Record<string, string> = {
  'JAMMU AND KASHMIR': '01', 'HIMACHAL PRADESH': '02', PUNJAB: '03', CHANDIGARH: '04', UTTARAKHAND: '05',
  HARYANA: '06', DELHI: '07', RAJASTHAN: '08', 'UTTAR PRADESH': '09', BIHAR: '10', SIKKIM: '11',
  'ARUNACHAL PRADESH': '12', NAGALAND: '13', MANIPUR: '14', MIZORAM: '15', TRIPURA: '16', MEGHALAYA: '17',
  ASSAM: '18', 'WEST BENGAL': '19', JHARKHAND: '20', ODISHA: '21', CHHATTISGARH: '22', 'MADHYA PRADESH': '23',
  GUJARAT: '24', 'DADRA AND NAGAR HAVELI AND DAMAN AND DIU': '26', MAHARASHTRA: '27', KARNATAKA: '29',
  GOA: '30', LAKSHADWEEP: '31', KERALA: '32', 'TAMIL NADU': '33', PUDUCHERRY: '34', 'ANDAMAN AND NICOBAR ISLANDS': '35',
  TELANGANA: '36', 'ANDHRA PRADESH': '37', LADAKH: '38',
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
    district: '',
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
    username: '',
    temporaryPassword: '',
    requirePasswordChange: true,
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
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<RegistrationForm>(() => emptyForm());
  const [activeFormTab, setActiveFormTab] = useState<'IDENTITY' | 'STATUTORY' | 'TAX_BRANDING' | 'BRANCHES' | 'MODULES' | 'SETTINGS'>('IDENTITY');
  const [pinLookupMessage, setPinLookupMessage] = useState('Enter a 6-digit PIN to auto-fill the location.');
  const [branchPinLookupMessage, setBranchPinLookupMessage] = useState('Enter a 6-digit PIN to auto-fill the branch location.');

  // Branch draft state
  const [branchDraft, setBranchDraft] = useState<Branch>({
    code: '',
    name: '',
    isHeadOffice: false,
    gstin: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    district: '',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '',
  });

  const { toast } = useToast();
  const { user } = useAuth();
  const canManageTenants = Boolean(user?.roles?.some((role) => role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPER_ADMIN') || user?.permissions?.includes('platform_tenants:manage'));

  useEffect(() => {
    const pincode = form.pincode.replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6) {
      setPinLookupMessage('Enter a 6-digit PIN to auto-fill the location.');
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setPinLookupMessage('Looking up PIN location...');
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal });
        const result = await response.json();
        const office = result?.[0]?.Status === 'Success' ? result[0].PostOffice?.[0] : null;
        if (!office) {
          setPinLookupMessage('PIN location was not found. You can enter the address manually.');
          return;
        }
        const state = String(office.State || '').trim();
        const district = String(office.District || office.Division || '').trim();
        setForm((current) => ({
          ...current,
          pincode,
          city: String(office.Block || office.Name || district || current.city).trim(),
          district,
          state,
          stateCode: STATE_GST_CODES[state.toUpperCase()] || current.stateCode,
          currency: 'INR',
        }));
        setPinLookupMessage(`Location found: ${district}, ${state}. Currency set to INR.`);
      } catch (error: any) {
        if (error?.name !== 'AbortError') setPinLookupMessage('PIN lookup is unavailable. You can enter the address manually.');
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [form.pincode]);

  useEffect(() => {
    const pincode = branchDraft.pincode.replace(/\D/g, '').slice(0, 6);
    if (pincode.length !== 6) {
      setBranchPinLookupMessage('Enter a 6-digit PIN to auto-fill the branch location.');
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setBranchPinLookupMessage('Looking up branch PIN location...');
        const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, { signal: controller.signal });
        const result = await response.json();
        const office = result?.[0]?.Status === 'Success' ? result[0].PostOffice?.[0] : null;
        if (!office) {
          setBranchPinLookupMessage('Branch PIN was not found. Enter the location manually.');
          return;
        }
        const state = String(office.State || '').trim();
        setBranchDraft((current) => ({
          ...current,
          pincode,
          city: String(office.Block || office.Name || office.District || current.city).trim(),
          district: String(office.District || office.Division || current.district).trim(),
          state,
          stateCode: STATE_GST_CODES[state.toUpperCase()] || current.stateCode,
        }));
        setBranchPinLookupMessage(`Branch location found: ${office.District || office.Division || ''}, ${state}.`);
      } catch (error: any) {
        if (error?.name !== 'AbortError') setBranchPinLookupMessage('Branch PIN lookup is unavailable. Enter the location manually.');
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [branchDraft.pincode]);

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
      district: profile.district || '',
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
      username: profile.username || '',
      temporaryPassword: '',
      requirePasswordChange: profile.requirePasswordChange,
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
      toast({ type: 'error', title: 'Unsupported file', message: 'Please choose a PNG, JPEG, or WebP image under 1 MB.' });
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
    if (!branchDraft.code.trim() || !branchDraft.name.trim() || !branchDraft.addressLine1.trim() || !branchDraft.city.trim() || !branchDraft.district.trim() || !branchDraft.state.trim() || !/^\d{2}$/.test(branchDraft.stateCode) || !/^\d{6}$/.test(branchDraft.pincode)) {
      toast({ type: 'warning', title: 'Incomplete branch', message: 'Complete the branch code, name, address, city, district, state, state code, and 6-digit PIN.' });
      return;
    }
    if (form.branches.some((b) => b.code.toUpperCase() === branchDraft.code.trim().toUpperCase())) {
      toast({ type: 'warning', title: 'Duplicate branch code', message: 'A branch with this code already exists.' });
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
      district: '',
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

  const validateRegistrationStep = (step: typeof REGISTRATION_STEPS[number], notify = true) => {
    const missing: string[] = [];
    if (step === 'IDENTITY') {
      if (!form.tradeName.trim()) missing.push('Business / Trade Name');
      if (!form.legalName.trim()) missing.push('Legal Registered Business Name');
    }
    if (step === 'STATUTORY') {
      if (!form.addressLine1.trim()) missing.push('Address Line 1');
      if (!form.city.trim()) missing.push('City');
      if (!form.district.trim()) missing.push('District');
      if (!form.state.trim()) missing.push('State');
      if (!/^\d{2}$/.test(form.stateCode.trim())) missing.push('2-digit State Code');
      if (!/^\d{6}$/.test(form.pincode.trim())) missing.push('6-digit PIN Code');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.financialYearStart)) missing.push('Financial Year Start (YYYY-MM-DD)');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.financialYearEnd)) missing.push('Financial Year End (YYYY-MM-DD)');
      if (form.financialYearStart && form.financialYearEnd && new Date(form.financialYearEnd) <= new Date(form.financialYearStart)) {
        missing.push('Financial Year End must be after Start');
      }
      if (!form.invoicePrefix.trim()) missing.push('Invoice Prefix');
      if (!/^INR$/i.test(form.currency.trim())) missing.push('Currency Code (INR)');
    }
    if (step === 'BRANCHES') {
      // Default state/state-code values do not mean that the admin started a new branch.
      // An untouched draft is allowed once the minimum one branch has been added.
      const draftHasValues = [
        branchDraft.code,
        branchDraft.name,
        branchDraft.gstin,
        branchDraft.addressLine1,
        branchDraft.addressLine2,
        branchDraft.city,
        branchDraft.district,
        branchDraft.pincode,
      ].some((value) => value.trim());
      if (draftHasValues && (!branchDraft.code.trim() || !branchDraft.name.trim() || !branchDraft.addressLine1.trim() || !branchDraft.city.trim() || !branchDraft.state.trim() || !/^\d{2}$/.test(branchDraft.stateCode) || !/^\d{6}$/.test(branchDraft.pincode))) {
        missing.push('Complete the branch details or clear the branch form');
      } else if (form.branches.length === 0) {
        missing.push('At least one branch');
      }
    }
    if (step === 'MODULES' && form.enabledModules.length === 0) missing.push('At least one module');
    if (step === 'SETTINGS' && !form.profileId && (!form.username.trim() || !form.temporaryPassword)) {
      missing.push('Owner Username and Temporary Password');
    }
    if (missing.length && notify) {
      const message = `Please complete: ${missing.join(', ')}`;
      toast({ type: 'warning', title: 'Fill the required details', message });
    }
    return missing.length === 0;
  };

  const navigateToStep = (target: typeof REGISTRATION_STEPS[number]) => {
    const currentIndex = REGISTRATION_STEPS.indexOf(activeFormTab);
    const targetIndex = REGISTRATION_STEPS.indexOf(target);
    if (targetIndex > currentIndex) {
      for (let index = currentIndex; index < targetIndex; index += 1) {
        const step = REGISTRATION_STEPS[index];
        if (!validateRegistrationStep(step)) {
          setActiveFormTab(step);
          return;
        }
      }
    }
    setActiveFormTab(target);
  };

  const handleSaveRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    const currentStepIndex = REGISTRATION_STEPS.indexOf(activeFormTab);
    if (!validateRegistrationStep(activeFormTab)) return;
    if (currentStepIndex < REGISTRATION_STEPS.length - 1) {
      toast({ type: 'success', title: 'Page completed', message: `${activeFormTab.replace('_', ' ')} saved. Continue with the next page.` });
      setActiveFormTab(REGISTRATION_STEPS[currentStepIndex + 1]);
      return;
    }

    if (!form.tradeName.trim() || !form.legalName.trim()) {
      toast({ type: 'warning', title: 'Missing business details', message: 'Please complete the trade name and legal registered business name.' });
      return;
    }
    if (!form.addressLine1.trim() || !form.city.trim() || !form.state.trim() || !form.pincode.trim()) {
      toast({ type: 'warning', title: 'Missing address details', message: 'Please complete the registered address details.' });
      return;
    }
    if (!form.profileId && (!form.username.trim() || !form.temporaryPassword)) {
      toast({ type: 'warning', title: 'Owner credentials required', message: 'Enter the owner username and temporary password to complete registration.' });
      setActiveFormTab('SETTINGS');
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
        district: form.district.trim() || undefined,
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
        username: form.username.trim() || undefined,
        temporaryPassword: form.temporaryPassword || undefined,
        requirePasswordChange: form.requirePasswordChange,
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
      toast({ type: 'error', title: 'Registration failed', message: err.message || 'Could not save business registration.' });
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

  const formatProfileDate = (value: string) =>
    new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      {/* Top Banner & Module Header */}
      <div className="flex items-center justify-between gap-6 rounded-xl border border-border/80 bg-surface px-5 py-4 shadow-subtle">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
              <Briefcase className="h-4 w-4" />
            </div>
            <h1 className="text-lg font-semibold leading-tight tracking-[-0.02em] text-text-primary">
              BUSINESS REGISTRATION
            </h1>
            <Badge variant="accent" size="sm">Platform Super Admin</Badge>
          </div>
          <p className="ml-12 mt-1 max-w-3xl text-xs leading-5 text-text-secondary">
            Register and configure multiple business profiles, legal structures, state tax jurisdictions,
            multi-branch topologies, and category-tailored ERP workflows.
          </p>
        </div>

        {/* Primary Action Button */}
        {canManageTenants && <Button
          type="button"
          variant="primary"
          onClick={openNewRegistration}
          icon={<Plus className="w-4 h-4" />}
          className="shrink-0 shadow-sm"
        >
          Register New Business
        </Button>}
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Registered Businesses</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{workspace?.profiles.length || 0}</p>
          <span className="mt-1 block text-xs text-text-tertiary">Multi-profile support active</span>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Operating Branches</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{totalBranches}</p>
          <span className="mt-1 block text-xs text-text-tertiary">Across head offices & retail</span>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Active Categories</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{new Set(workspace?.profiles.map((p) => p.industry)).size}</p>
          <span className="mt-1 block text-xs text-text-tertiary">Tailored workflows & templates</span>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">GST Registered</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-accent">
            {workspace?.profiles.filter((p) => p.taxSettings?.gstRegistered).length || 0}
          </p>
          <span className="mt-1 block text-xs text-text-tertiary">Statutory compliance verified</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex items-center gap-4 rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search registered businesses by trade name, legal name, GSTIN, PAN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-border/80 bg-background pl-9 pr-4 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <label className="relative block w-48">
            <select
              aria-label="Filter by business type"
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-border/80 bg-background px-3 pr-9 text-xs leading-none text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/25"
            >
              <option value="ALL">All Business Types</option>
              {businessTypes.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              strokeWidth={1.8}
            />
          </label>

          <label className="relative block w-48">
            <select
              aria-label="Filter by business category"
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="h-9 w-full appearance-none rounded-lg border border-border/80 bg-background px-3 pr-9 text-xs leading-none text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/25"
            >
              <option value="ALL">All Categories</option>
              {industries.map((industry) => (
                <option key={industry.value} value={industry.value}>{industry.label}</option>
              ))}
            </select>
            <ChevronDown
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
              strokeWidth={1.8}
            />
          </label>
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
          {canManageTenants && <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openNewRegistration}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Register New Business
          </Button>}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProfiles.map((profile) => (
            <div
              key={profile.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-8 rounded-xl border border-border/80 bg-surface px-5 py-5 shadow-subtle transition-colors duration-150 hover:border-accent/40"
            >
              <div className="flex min-w-0 items-center gap-4">
                {profile.logoUrl ? (
                  <img
                    src={profile.logoUrl}
                    alt={profile.tradeName}
                    className="h-16 w-16 shrink-0 rounded-xl border border-border/80 bg-background object-contain p-1.5"
                  />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-xl font-semibold text-accent">
                    {profile.tradeName.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <h3 className="truncate text-base font-semibold tracking-tight text-text-primary">{profile.tradeName}</h3>
                    <Badge variant="neutral" size="sm">{profile.businessType.replaceAll('_', ' ')}</Badge>
                    <Badge variant="accent" size="sm">{profile.industry}</Badge>
                    {profile.taxSettings?.gstRegistered && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-medium text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> GST Active
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-6 text-xs text-text-secondary">
                    <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-text-tertiary" />{profile.city}, {profile.state} · {profile.pincode}</span>
                    <span className="flex items-center gap-1.5"><Store className="h-3.5 w-3.5 text-text-tertiary" />{profile.branches?.length || 0} branches</span>
                    <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-text-tertiary" />FY {formatProfileDate(profile.financialYearStart)} – {formatProfileDate(profile.financialYearEnd)}</span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-text-tertiary">
                    <span>Legal name: <strong className="font-medium text-text-secondary">{profile.legalName}</strong></span>
                    {profile.gstin && <span className="font-mono">GSTIN: {profile.gstin}</span>}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex shrink-0 items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => setViewingProfile(profile)}
                  icon={<Eye className="h-3.5 w-3.5" />}
                >
                  View
                </Button>
                {canManageTenants && <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => openEditRegistration(profile)}
                  icon={<Edit3 className="w-3.5 h-3.5" />}
                >
                  Edit
                </Button>}
                {canManageTenants && <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => handleDeleteProfile(profile.id, profile.tradeName)}
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                >
                  Delete
                </Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={Boolean(viewingProfile)}
        onClose={() => setViewingProfile(null)}
        title={viewingProfile?.tradeName || 'Business details'}
        description="Read-only registration, fiscal, branch, and enabled module details."
        maxWidth="xl"
      >
        {viewingProfile && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl border border-border/80 bg-surface-secondary/30 p-4">
              {viewingProfile.logoUrl ? (
                <img src={viewingProfile.logoUrl} alt={viewingProfile.tradeName} className="h-16 w-16 rounded-xl border border-border bg-background object-contain p-1.5" />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-accent/20 bg-accent/10 text-xl font-semibold text-accent">{viewingProfile.tradeName.charAt(0).toUpperCase()}</div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-text-primary">{viewingProfile.tradeName}</h3>
                  {viewingProfile.taxSettings?.gstRegistered && <Badge variant="success" size="sm">GST Active</Badge>}
                </div>
                <p className="mt-1 text-xs text-text-secondary">{viewingProfile.legalName}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                ['Business type', viewingProfile.businessType.replaceAll('_', ' ')],
                ['Industry', viewingProfile.industry],
                ['Currency', viewingProfile.currency],
                ['GSTIN', viewingProfile.gstin || 'Not provided'],
                ['PAN', viewingProfile.pan || 'Not provided'],
                ['Invoice prefix', viewingProfile.invoicePrefix],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/70 bg-surface p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>
                  <p className="mt-1 text-xs font-medium text-text-primary">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg border border-border/70 bg-surface p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Registered location</p>
                <p className="text-sm text-text-primary">{viewingProfile.addressLine1}</p>
                {viewingProfile.addressLine2 && <p className="text-xs text-text-secondary">{viewingProfile.addressLine2}</p>}
                <p className="mt-1 text-xs text-text-secondary">{viewingProfile.city}, {viewingProfile.district || viewingProfile.state} · {viewingProfile.state} · {viewingProfile.pincode}</p>
              </div>
              <div className="rounded-lg border border-border/70 bg-surface p-4">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Financial year</p>
                <p className="text-sm text-text-primary">{formatProfileDate(viewingProfile.financialYearStart)} – {formatProfileDate(viewingProfile.financialYearEnd)}</p>
                <p className="mt-1 text-xs text-text-secondary">Tax jurisdiction: {viewingProfile.jurisdiction || 'Not specified'}</p>
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Branches</p>
                <span className="text-xs text-text-secondary">{viewingProfile.branches?.length || 0} configured</span>
              </div>
              <div className="mt-3 space-y-2">
                {viewingProfile.branches?.length ? viewingProfile.branches.map((branch) => (
                  <div key={branch.code} className="flex items-center justify-between rounded-md border border-border/60 bg-surface-secondary/30 px-3 py-2 text-xs">
                    <span className="font-medium text-text-primary">{branch.name} <span className="font-mono text-text-tertiary">({branch.code})</span></span>
                    <span className="text-text-secondary">{branch.city}, {branch.state} · {branch.pincode}</span>
                  </div>
                )) : <p className="text-xs text-text-secondary">No branches configured.</p>}
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-surface p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">Enabled modules</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {viewingProfile.enabledModules?.map((module) => <Badge key={module} variant="neutral" size="sm">{module}</Badge>)}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* REGISTRATION MODAL FORM */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-3 animate-fade-in sm:p-4"
          onClick={() => !saving && setIsModalOpen(false)}
        >
          <div
            className="my-auto flex max-h-[90dvh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl animate-scale-up"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-surface-secondary/40 px-7 py-4">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-accent text-white flex items-center justify-center font-bold text-xs shadow-sm">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary tracking-tight">
                    {form.profileId ? `Edit Business: ${form.tradeName}` : 'Register New Business'}
                  </h2>
                  <p className="text-[11px] text-text-secondary">
                    Statutory registration, jurisdiction, tax setup, multiple branches, and category workflows.
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
            <div className="grid shrink-0 grid-cols-6 border-b border-border bg-surface px-5">
              {[
                { key: 'IDENTITY', label: '1. Identity & Structure' },
                { key: 'STATUTORY', label: '2. Address & Fiscal' },
                { key: 'TAX_BRANDING', label: '3. Tax & Branding' },
                { key: 'BRANCHES', label: `4. Branches (${form.branches.length})` },
                { key: 'MODULES', label: `5. Modules & Workflows (${form.enabledModules.length})` },
                { key: 'SETTINGS', label: '6. Settings' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => navigateToStep(tab.key as typeof REGISTRATION_STEPS[number])}
                  className={`min-w-0 border-b-2 px-3 py-3 text-center text-xs font-medium transition-all ${
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
            <form noValidate onSubmit={handleSaveRegistration} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">
              {/* TAB 1: IDENTITY */}
              {activeFormTab === 'IDENTITY' && (
                <div className="mx-auto w-full max-w-5xl space-y-6">
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
                <div className="mx-auto w-full max-w-5xl space-y-6">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    <Input
                      label="City *"
                      placeholder="e.g. Namakkal"
                      value={form.city}
                      required
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                    />
                    <Input
                      label="District *"
                      placeholder="e.g. Namakkal"
                      value={form.district}
                      required
                      onChange={(e) => setForm({ ...form, district: e.target.value })}
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
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      required
                      hint={pinLookupMessage}
                      onChange={(e) => setForm({ ...form, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
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
                      type="text"
                      placeholder="YYYY-MM-DD"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                      value={form.financialYearStart}
                      required
                      onChange={(e) => setForm({ ...form, financialYearStart: e.target.value.replace(/[^0-9-]/g, '').slice(0, 10) })}
                    />
                    <Input
                      label="Financial Year Ends *"
                      type="text"
                      placeholder="YYYY-MM-DD"
                      inputMode="numeric"
                      maxLength={10}
                      pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}"
                      value={form.financialYearEnd}
                      required
                      onChange={(e) => setForm({ ...form, financialYearEnd: e.target.value.replace(/[^0-9-]/g, '').slice(0, 10) })}
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
                      readOnly
                      hint="Automatically set to INR for Indian PIN codes."
                      required
                      onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: TAX SETTINGS & BRANDING */}
              {activeFormTab === 'TAX_BRANDING' && (
                <div className="mx-auto w-full max-w-5xl space-y-6">
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
                <div className="mx-auto w-full max-w-5xl space-y-6">
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
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
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
                        label="District *"
                        placeholder="District"
                        value={branchDraft.district}
                        onChange={(e) => setBranchDraft({ ...branchDraft, district: e.target.value })}
                      />
                      <Input
                        label="State *"
                        placeholder="State"
                        value={branchDraft.state}
                        onChange={(e) => setBranchDraft({ ...branchDraft, state: e.target.value })}
                      />
                      <Input
                        label="State Code *"
                        placeholder="e.g. 33"
                        value={branchDraft.stateCode}
                        maxLength={2}
                        onChange={(e) => setBranchDraft({ ...branchDraft, stateCode: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                      />
                      <Input
                        label="PIN Code *"
                        placeholder="Pincode"
                        value={branchDraft.pincode}
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        hint={branchPinLookupMessage}
                        onChange={(e) => setBranchDraft({ ...branchDraft, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
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
                <div className="mx-auto w-full max-w-5xl space-y-6">
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

              {/* TAB 6: OWNER LOGIN SETTINGS */}
              {activeFormTab === 'SETTINGS' && (
                <div className="mx-auto w-full max-w-5xl space-y-6">
                  <div className="border-b border-border pb-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Owner Login & Password Settings
                    </h3>
                    <p className="text-[11px] text-text-tertiary">
                      Set the business owner account used to sign in to this workspace.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label={`Username (email address)${form.profileId ? '' : ' *'}`}
                      type="email"
                      autoComplete="username"
                      placeholder="owner@company.com"
                      value={form.username}
                      required={!form.profileId}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                    <PasswordInput
                      label={`Temporary Password${form.profileId ? ' (leave blank to keep current)' : ' *'}`}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder={form.profileId ? 'Leave blank to keep the current password' : 'Enter a temporary owner password'}
                      value={form.temporaryPassword}
                      required={!form.profileId}
                      onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
                    />
                  </div>

                  <div className="macos-card p-4">
                    <Switch
                      label="Require password change at next sign-in"
                      checked={form.requirePasswordChange}
                      onChange={(value) => setForm({ ...form, requirePasswordChange: value })}
                    />
                    <p className="text-[11px] text-text-tertiary pl-11 mt-1">
                      The owner must set a new password before accessing the workspace.
                    </p>
                  </div>
                </div>
              )}

              {/* Modal Footer Controls */}
              </div>
              <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border bg-surface-secondary/30 px-7 py-4">
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
                  icon={activeFormTab === 'SETTINGS' ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                >
                  {activeFormTab === 'SETTINGS'
                    ? form.profileId ? 'Save Changes' : 'Complete Business Registration'
                    : 'Save changes and next page'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
