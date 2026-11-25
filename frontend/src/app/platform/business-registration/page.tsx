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
  Edit3,
  Plus,
  Trash2,
  Upload,
  Search,
  X,
  Sliders,
  Check,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { Modal } from '@/components/ui/modal';

interface Branch {
  id?: string;
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

interface RegistrationForm {
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
  ownerName: string;
  username: string;
  temporaryPassword: string;
  requirePasswordChange: boolean;
}

interface Workspace {
  tenants: Array<{ id: string; slug: string; displayName: string; status: string }>;
  supportedModules: string[];
  moduleDefaults: Record<string, string[]>;
}

interface RegistrationReceipt {
  tenantId: string;
  tenantSlug: string;
  ownerName: string;
  ownerEmail: string;
  temporaryPassword: string;
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

function emptyBranch(): Branch {
  return {
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
  };
}

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
    ownerName: '',
    username: '',
    temporaryPassword: '',
    requirePasswordChange: true,
  };
}

export default function PlatformBusinessRegistrationPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Workspace['tenants'][number] | null>(null);
  const [originalForm, setOriginalForm] = useState<RegistrationForm | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [registrationReceipt, setRegistrationReceipt] = useState<RegistrationReceipt | null>(null);
  const [form, setForm] = useState<RegistrationForm>(() => emptyForm());
  const [branchEditIndex, setBranchEditIndex] = useState<number | null>(null);
  const [activeFormTab, setActiveFormTab] = useState<'IDENTITY' | 'STATUTORY' | 'TAX_BRANDING' | 'BRANCHES' | 'MODULES' | 'SETTINGS'>('IDENTITY');
  const [pinLookupMessage, setPinLookupMessage] = useState('Enter a 6-digit PIN to auto-fill the location.');
  const [branchPinLookupMessage, setBranchPinLookupMessage] = useState('Enter a 6-digit PIN to auto-fill the branch location.');

  // Branch draft state
  const [branchDraft, setBranchDraft] = useState<Branch>(emptyBranch);

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
      const data = await apiFetch<Workspace>('/platform/business-registration');
      setWorkspace(data);
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Failed to load business registration data',
        message: err.message || 'Please check network connection',
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openNewRegistration = () => {
    const defaults = workspace?.moduleDefaults[IndustryType.RETAIL] || [];
    const newForm = emptyForm(defaults);
    setForm(newForm);
    setOriginalForm(null);
    setEditingTenant(null);
    setBranchEditIndex(null);
    setBranchDraft(emptyBranch());
    setActiveFormTab('IDENTITY');
    setIsModalOpen(true);
  };

  const handleDeleteTenant = async (tenantId: string, name: string) => {
    if (!window.confirm(
      `Permanently delete the tenant workspace "${name}" and all its tenant data and login accounts? This cannot be undone.`
    )) {
      return;
    }
    try {
      await apiFetch(`/platform/business-registration/tenants/${tenantId}`, { method: 'DELETE' });
      toast({ type: 'success', title: 'Tenant deleted', message: `"${name}" and its tenant workspace were permanently deleted.` });
      await loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Delete failed', message: err.message || 'Could not delete tenant' });
    }
  };

  const openEditTenant = async (tenant: Workspace['tenants'][number]) => {
    setEditingTenant(tenant);
    try {
      setLoadingProfile(true);
      const profile = await apiFetch<RegistrationForm>(
        `/platform/business-registration/tenants/${tenant.id}`
      );
      const defaults = emptyForm(workspace?.moduleDefaults[profile.industry] || []);
      const loadedForm: RegistrationForm = {
        ...defaults,
        ...profile,
        gstin: profile.gstin || '',
        pan: profile.pan || '',
        addressLine2: profile.addressLine2 || '',
        district: profile.district || '',
        jurisdiction: profile.jurisdiction || '',
        logoUrl: profile.logoUrl || '',
        digitalSignatureUrl: profile.digitalSignatureUrl || '',
        enabledModules: profile.enabledModules || [],
        taxSettings: { ...defaults.taxSettings, ...profile.taxSettings },
        temporaryPassword: '',
        branches: (profile.branches || []).map((branch) => ({
          ...branch,
          gstin: branch.gstin || '',
          addressLine2: branch.addressLine2 || '',
          district: branch.district || '',
        })),
      };
      setForm(loadedForm);
      setOriginalForm(loadedForm);
      setBranchEditIndex(null);
      setBranchDraft(emptyBranch());
      setActiveFormTab('IDENTITY');
      setIsModalOpen(true);
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Could not load business registration',
        message: err.message || 'Could not load this tenant’s business settings.',
      });
      setEditingTenant(null);
    } finally {
      setLoadingProfile(false);
    }
  };

  const closeRegistrationModal = () => {
    if (saving) return;
    setIsModalOpen(false);
    setEditingTenant(null);
    setOriginalForm(null);
    setBranchEditIndex(null);
    setBranchDraft(emptyBranch());
  };

  const handleTenantStatusChange = async (
    tenant: Workspace['tenants'][number],
    nextStatus: 'active' | 'suspended'
  ) => {
    const action = nextStatus === 'suspended' ? 'suspend' : 'resume';
    try {
      await apiFetch(`/platform/tenants/${tenant.id}/${action}`, {
        method: 'POST',
        ...(nextStatus === 'suspended'
          ? { body: JSON.stringify({ reason: 'Administrative suspension' }) }
          : {}),
      });
      toast({
        type: 'success',
        title: nextStatus === 'active' ? 'Tenant activated' : 'Tenant suspended',
        message: `${tenant.displayName} is now ${nextStatus}.`,
      });
      await loadData();
    } catch (err: any) {
      toast({
        type: 'error',
        title: 'Tenant status update failed',
        message: err.message || 'Could not change tenant status.',
      });
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
    if (form.branches.some((b, index) =>
      index !== branchEditIndex && b.code.toUpperCase() === branchDraft.code.trim().toUpperCase()
    )) {
      toast({ type: 'warning', title: 'Duplicate branch code', message: 'A branch with this code already exists.' });
      return;
    }

    setForm((prev) => {
      const isHeadOffice = branchDraft.isHeadOffice;
      const updatedBranch = {
        ...branchDraft,
        code: branchDraft.code.trim().toUpperCase(),
        name: branchDraft.name.trim(),
        isHeadOffice,
      };
      const branches = prev.branches.map((branch, index) => ({
        ...branch,
        ...(isHeadOffice ? { isHeadOffice: false } : {}),
        ...(index === branchEditIndex ? updatedBranch : {}),
      }));
      if (branchEditIndex === null) branches.push(updatedBranch);
      return {
        ...prev,
        branches,
      };
    });

    setBranchEditIndex(null);
    setBranchDraft(emptyBranch());
  };

  const removeBranchFromForm = (index: number) => {
    setForm((prev) => {
      const branches = prev.branches.filter((_, i) => i !== index);
      return { ...prev, branches };
    });
    setBranchEditIndex((current) =>
      current === null ? null : current === index ? null : current > index ? current - 1 : current
    );
    if (branchEditIndex === index) setBranchDraft(emptyBranch());
  };

  const editBranchInForm = (index: number) => {
    setBranchDraft(form.branches[index]);
    setBranchEditIndex(index);
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
      if (draftHasValues && (!branchDraft.code.trim() || !branchDraft.name.trim() || !branchDraft.addressLine1.trim() || !branchDraft.city.trim() || !branchDraft.district.trim() || !branchDraft.state.trim() || !/^\d{2}$/.test(branchDraft.stateCode) || !/^\d{6}$/.test(branchDraft.pincode))) {
        missing.push('Complete the branch details or clear the branch form');
      }
      if (editingTenant && !form.branches.length) missing.push('At least one branch');
    }
    if (step === 'MODULES' && form.enabledModules.length === 0) missing.push('At least one module');
    if (step === 'SETTINGS') {
      if (!form.ownerName.trim()) missing.push('Business Owner Name');
      if (!form.username.trim() || (!editingTenant && !form.temporaryPassword)) {
        missing.push(editingTenant ? 'Owner Username' : 'Owner Username and Temporary Password');
      }
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
    if (editingTenant && originalForm && JSON.stringify(form) === JSON.stringify(originalForm)) {
      return;
    }

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
    if (!form.ownerName.trim()) {
      toast({ type: 'warning', title: 'Business owner name required', message: 'Enter the business owner name to complete registration.' });
      setActiveFormTab('SETTINGS');
      return;
    }
    if (!form.username.trim() || (!editingTenant && !form.temporaryPassword)) {
      toast({
        type: 'warning',
        title: 'Owner credentials required',
        message: editingTenant
          ? 'Enter the business owner email to save this registration.'
          : 'Enter the owner username and temporary password to complete registration.',
      });
      setActiveFormTab('SETTINGS');
      return;
    }

    try {
      setSaving(true);
      const payload = {
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
        ownerName: form.ownerName.trim(),
        username: form.username.trim(),
        temporaryPassword: form.temporaryPassword || undefined,
        requirePasswordChange: form.requirePasswordChange,
      };

      if (editingTenant) {
        await apiFetch(`/platform/business-registration/tenants/${editingTenant.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast({ type: 'success', title: 'Business settings saved', message: 'The tenant registration was updated.' });
      } else {
        const created = await apiFetch<{
          tenantId: string;
          tenantSlug: string;
          ownerEmail: string;
        }>('/platform/business-registration', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setRegistrationReceipt({
          ...created,
          ownerName: form.ownerName.trim(),
          temporaryPassword: form.temporaryPassword,
        });
        toast({ type: 'success', title: 'Registered', message: 'Tenant account created successfully.' });
      }
      setForm((current) => ({ ...current, temporaryPassword: '' }));

      setIsModalOpen(false);
      setEditingTenant(null);
      setOriginalForm(null);
      await loadData();
    } catch (err: any) {
      toast({
        type: 'error',
        title: editingTenant ? 'Business update failed' : 'Registration failed',
        message: err.message || 'Could not save business registration.',
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredTenants = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return (workspace?.tenants || []).filter((tenant) =>
      !query ||
      tenant.displayName.toLowerCase().includes(query) ||
      tenant.slug.toLowerCase().includes(query)
    );
  }, [workspace?.tenants, searchQuery]);
  const formHasChanges =
    !editingTenant ||
    !originalForm ||
    JSON.stringify(form) !== JSON.stringify(originalForm);

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
            Register isolated tenant workspaces and manage their access status. Tenant business records remain private to each workspace.
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
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Registered Tenants</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{workspace?.tenants.length || 0}</p>
          <span className="mt-1 block text-xs text-text-tertiary">Isolated schemas</span>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Active Tenants</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{workspace?.tenants.filter((tenant) => tenant.status === 'active').length || 0}</p>
          <span className="mt-1 block text-xs text-text-tertiary">Can sign in</span>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Suspended Tenants</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{workspace?.tenants.filter((tenant) => tenant.status === 'suspended').length || 0}</p>
          <span className="mt-1 block text-xs text-text-tertiary">Login disabled</span>
        </div>
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-secondary">Other Status</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-accent">
            {workspace?.tenants.filter((tenant) => !['active', 'suspended'].includes(tenant.status)).length || 0}
          </p>
          <span className="mt-1 block text-xs text-text-tertiary">Provisioning or inactive</span>
        </div>
      </div>

      {canManageTenants && (
        <div className="rounded-xl border border-border/80 bg-surface p-4 shadow-subtle">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Tenant workspaces</h2>
              <p className="mt-1 text-xs text-text-secondary">
                Only workspace identity and status are shown here; business data stays in each tenant schema.
              </p>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
              <input
                type="search"
                aria-label="Search tenant workspaces"
                placeholder="Search name or workspace slug"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-9 w-full rounded-lg border border-border/80 bg-background pl-9 pr-3 text-xs text-text-primary"
              />
            </div>
          </div>
          {filteredTenants.length === 0 ? (
            <p className="py-5 text-center text-xs text-text-secondary">No tenant workspaces found.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {filteredTenants.map((tenant) => (
                <div key={tenant.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-text-primary">{tenant.displayName}</p>
                    <p className="mt-1 truncate font-mono text-[11px] text-text-tertiary">
                      {tenant.slug}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge size="sm" variant={tenant.status === 'active' ? 'success' : 'neutral'}>
                      {tenant.status}
                    </Badge>
                    {tenant.status === 'active' && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => handleTenantStatusChange(tenant, 'suspended')}>
                        Suspend
                      </Button>
                    )}
                    {tenant.status === 'suspended' && (
                      <Button type="button" variant="secondary" size="sm" onClick={() => handleTenantStatusChange(tenant, 'active')}>
                        Activate
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      loading={loadingProfile && editingTenant?.id === tenant.id}
                      disabled={loadingProfile && editingTenant?.id !== tenant.id}
                      onClick={() => void openEditTenant(tenant)}
                      icon={<Edit3 className="h-3.5 w-3.5" />}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleDeleteTenant(tenant.id, tenant.displayName)}
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* REGISTRATION MODAL FORM */}
      {isModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-3 animate-fade-in sm:p-4"
          onClick={closeRegistrationModal}
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
                    {editingTenant ? `Edit Business: ${form.tradeName}` : 'Register New Business'}
                  </h2>
                  <p className="text-[11px] text-text-secondary">
                    {editingTenant
                      ? 'Update this tenant’s business profile, branches, and owner details.'
                      : 'Statutory registration, jurisdiction, tax setup, multiple branches, and category workflows.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRegistrationModal}
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
                      No branches added. You can add branches here or later in tenant settings.
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
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              aria-label={`Edit ${b.name}`}
                              onClick={() => editBranchInForm(idx)}
                              className="p-1.5 text-text-tertiary hover:text-accent rounded hover:bg-accent/10 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${b.name}`}
                              onClick={() => removeBranchFromForm(idx)}
                              className="p-1.5 text-text-tertiary hover:text-danger rounded hover:bg-danger/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Branch Builder Box */}
                  <div className="macos-card p-4 space-y-3 bg-surface-secondary/40">
                    <p className="text-xs font-semibold text-text-primary">
                      {branchEditIndex === null ? 'Add New Branch Location' : 'Edit Branch Location'}
                    </p>
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
                      <div>
                        <Switch
                          label="Mark as Head Office Branch"
                          checked={branchDraft.isHeadOffice}
                          disabled={form.branches.some((branch, index) =>
                            branch.isHeadOffice && index !== branchEditIndex
                          )}
                          onChange={(v) => setBranchDraft({ ...branchDraft, isHeadOffice: v })}
                        />
                        {form.branches.some((branch, index) =>
                          branch.isHeadOffice && index !== branchEditIndex
                        ) && (
                          <p className="mt-1 text-[11px] text-text-tertiary">
                            This business already has a head office branch.
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {branchEditIndex !== null && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBranchDraft(emptyBranch());
                              setBranchEditIndex(null);
                            }}
                          >
                            Cancel Edit
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={addBranchToForm}
                          icon={branchEditIndex === null
                            ? <Plus className="w-3.5 h-3.5" />
                            : <Check className="w-3.5 h-3.5" />}
                        >
                          {branchEditIndex === null ? 'Add Branch' : 'Save Branch'}
                        </Button>
                      </div>
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
                      {editingTenant
                        ? 'Update the owner name and email for this workspace. The existing password is not changed here.'
                        : 'Set the business owner account used to sign in to this workspace.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Business Owner Name *"
                      autoComplete="name"
                      placeholder="Full name of the business owner"
                      maxLength={200}
                      value={form.ownerName}
                      required
                      onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                    />
                    <Input
                      label="Owner email *"
                      type="email"
                      autoComplete="username"
                      placeholder="owner@company.com"
                      value={form.username}
                      required
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                    />
                    {!editingTenant && (
                      <PasswordInput
                        label="Temporary Password *"
                        autoComplete="new-password"
                        minLength={8}
                        placeholder="Enter a temporary owner password"
                        value={form.temporaryPassword}
                        required
                        onChange={(e) => setForm({ ...form, temporaryPassword: e.target.value })}
                      />
                    )}
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
                  onClick={closeRegistrationModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  disabled={activeFormTab === 'SETTINGS' && editingTenant !== null && !formHasChanges}
                  icon={activeFormTab === 'SETTINGS' ? <Check className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                >
                  {activeFormTab === 'SETTINGS'
                    ? editingTenant
                      ? (formHasChanges ? 'Save Business Settings' : 'No Changes')
                      : 'Complete Business Registration'
                    : 'Save changes and next page'}
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
      <Modal
        isOpen={Boolean(registrationReceipt)}
        onClose={() => setRegistrationReceipt(null)}
        title="Business workspace created"
        description="Share the owner email and temporary password with the business owner."
        maxWidth="md"
      >
        {registrationReceipt && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-surface-secondary/30 p-3 text-sm">
              <p className="text-xs text-text-tertiary">Business owner</p>
              <p className="mt-1 break-all font-medium text-text-primary">{registrationReceipt.ownerName}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-secondary/30 p-3 text-sm">
              <p className="text-xs text-text-tertiary">Owner email</p>
              <p className="mt-1 break-all font-medium text-text-primary">{registrationReceipt.ownerEmail}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-secondary/30 p-3 text-sm">
              <p className="text-xs text-text-tertiary">Temporary password</p>
              <p className="mt-1 break-all font-mono text-text-primary">{registrationReceipt.temporaryPassword}</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-secondary/30 p-3 text-sm">
              <p className="text-xs text-text-tertiary">Tenant ID</p>
              <p className="mt-1 break-all font-mono text-text-primary">{registrationReceipt.tenantId}</p>
              <p className="mt-2 text-xs text-text-tertiary">Workspace: {registrationReceipt.tenantSlug}</p>
            </div>
            <p className="text-xs text-text-secondary">
              The owner signs in with the email and temporary password above, then changes the password
              at first sign-in. Tenant ID is for reference; it is not required at login.
            </p>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setRegistrationReceipt(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
