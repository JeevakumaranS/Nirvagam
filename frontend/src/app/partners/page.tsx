'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { UserPlus, Building, Search, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const EMPTY_CUSTOMER_FORM = {
  name: '',
  companyName: '',
  phone: '',
  email: '',
  gstin: '',
  billingStreet: '',
  billingCity: '',
  billingState: '',
  billingStateCode: '',
  billingPincode: '',
  creditLimit: '0',
  openingBalance: '0',
};

const EMPTY_SUPPLIER_FORM = {
  name: '',
  companyName: '',
  phone: '',
  email: '',
  gstin: '',
  addressStreet: '',
  city: '',
  state: '',
  stateCode: '',
  pincode: '',
  openingBalance: '0',
};

function getPartnerValidationError(phone: string, gstin: string) {
  if (!/^\d{10}$/.test(phone)) {
    return 'Phone number must contain exactly 10 digits.';
  }
  if (gstin && !/^[A-Z0-9]{15}$/.test(gstin)) {
    return 'GSTIN must contain exactly 15 letters and digits.';
  }
  return null;
}

export default function PartnersPage() {
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [custForm, setCustForm] = useState({ ...EMPTY_CUSTOMER_FORM });
  const [suppForm, setSuppForm] = useState({ ...EMPTY_SUPPLIER_FORM });

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [custRes, suppRes] = await Promise.all([
        apiFetch('/customers', { params: { search } }),
        apiFetch('/suppliers', { params: { search } }),
      ]);
      setCustomers(custRes?.data || []);
      setSuppliers(suppRes?.data || []);
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const openNewCustomerForm = () => {
    setEditingCustomerId(null);
    setCustForm({ ...EMPTY_CUSTOMER_FORM });
    setCustomerModalOpen(true);
  };

  const openCustomerEditForm = (customer: any) => {
    setEditingCustomerId(customer.id);
    setCustForm({
      name: customer.name || '',
      companyName: customer.companyName || '',
      phone: String(customer.phone || '').replace(/\D/g, '').slice(-10),
      email: customer.email || '',
      gstin: customer.gstin || '',
      billingStreet: customer.billingStreet || '',
      billingCity: customer.billingCity || '',
      billingState: customer.billingState || '',
      billingStateCode: customer.billingStateCode || '',
      billingPincode: customer.billingPincode || '',
      creditLimit: String(customer.creditLimit ?? 0),
      openingBalance: String(customer.openingBalance ?? 0),
    });
    setCustomerModalOpen(true);
  };

  const openNewSupplierForm = () => {
    setEditingSupplierId(null);
    setSuppForm({ ...EMPTY_SUPPLIER_FORM });
    setSupplierModalOpen(true);
  };

  const openSupplierEditForm = (supplier: any) => {
    setEditingSupplierId(supplier.id);
    setSuppForm({
      name: supplier.name || '',
      companyName: supplier.companyName || '',
      phone: String(supplier.phone || '').replace(/\D/g, '').slice(-10),
      email: supplier.email || '',
      gstin: supplier.gstin || '',
      addressStreet: supplier.addressStreet || '',
      city: supplier.city || '',
      state: supplier.state || '',
      stateCode: supplier.stateCode || '',
      pincode: supplier.pincode || '',
      openingBalance: String(supplier.openingBalance ?? 0),
    });
    setSupplierModalOpen(true);
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name.trim() || !custForm.phone) {
      toast({ type: 'warning', title: 'Missing details', message: 'Name and Phone number are required.' });
      return;
    }
    const validationError = getPartnerValidationError(custForm.phone, custForm.gstin);
    if (validationError) {
      toast({ type: 'warning', title: 'Invalid details', message: validationError });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch(editingCustomerId ? `/customers/${editingCustomerId}` : '/customers', {
        method: editingCustomerId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...custForm,
          name: custForm.name.trim(),
          gstin: custForm.gstin || (editingCustomerId ? null : undefined),
          creditLimit: Number(custForm.creditLimit || 0),
          openingBalance: Number(custForm.openingBalance || 0),
        }),
      });
      toast({
        type: 'success',
        title: editingCustomerId ? 'Customer Updated' : 'Customer Registered',
        message: editingCustomerId ? `${custForm.name} updated.` : `${custForm.name} added.`,
      });
      setCustomerModalOpen(false);
      setEditingCustomerId(null);
      setCustForm({ ...EMPTY_CUSTOMER_FORM });
      loadData();
    } catch (err: any) {
      toast({
        type: 'error',
        title: editingCustomerId ? 'Failed to update customer' : 'Failed to add customer',
        message: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppForm.name.trim() || !suppForm.companyName.trim() || !suppForm.phone) {
      toast({
        type: 'warning',
        title: 'Missing details',
        message: 'Supplier name, company name, and phone are required.',
      });
      return;
    }
    const validationError = getPartnerValidationError(suppForm.phone, suppForm.gstin);
    if (validationError) {
      toast({ type: 'warning', title: 'Invalid details', message: validationError });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch(editingSupplierId ? `/suppliers/${editingSupplierId}` : '/suppliers', {
        method: editingSupplierId ? 'PATCH' : 'POST',
        body: JSON.stringify({
          ...suppForm,
          name: suppForm.name.trim(),
          companyName: suppForm.companyName.trim(),
          gstin: suppForm.gstin || (editingSupplierId ? null : undefined),
          openingBalance: Number(suppForm.openingBalance || 0),
        }),
      });
      toast({
        type: 'success',
        title: editingSupplierId ? 'Supplier Updated' : 'Supplier Registered',
        message: editingSupplierId ? `${suppForm.name} updated.` : `${suppForm.name} added.`,
      });
      setSupplierModalOpen(false);
      setEditingSupplierId(null);
      setSuppForm({ ...EMPTY_SUPPLIER_FORM });
      loadData();
    } catch (err: any) {
      toast({
        type: 'error',
        title: editingSupplierId ? 'Failed to update supplier' : 'Failed to add supplier',
        message: err.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCustomer = async (customer: any) => {
    if (!window.confirm(`Delete ${customer.name} from the active customer list? Existing invoices will be kept.`)) {
      return;
    }

    try {
      await apiFetch(`/customers/${customer.id}`, { method: 'DELETE' });
      toast({ type: 'success', title: 'Customer Deleted', message: `${customer.name} was removed.` });
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to delete customer', message: err.message });
    }
  };

  const handleDeleteSupplier = async (supplier: any) => {
    if (!window.confirm(`Delete ${supplier.name} from the active supplier list? Existing invoices will be kept.`)) {
      return;
    }

    try {
      await apiFetch(`/suppliers/${supplier.id}`, { method: 'DELETE' });
      toast({ type: 'success', title: 'Supplier Deleted', message: `${supplier.name} was removed.` });
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to delete supplier', message: err.message });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Commercial Partners Directory</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Customer receivables, supplier payables, credit limits, and running ledger statements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          {activeTab === 'customers' ? (
            <Button
              size="sm"
              variant="primary"
              onClick={openNewCustomerForm}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Add Customer
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={openNewSupplierForm}
              icon={<Building className="w-3.5 h-3.5" />}
            >
              Add Supplier
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'customers', label: 'Customers (Debtors)', count: customers.length },
            { id: 'suppliers', label: 'Suppliers (Creditors)', count: suppliers.length },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />

        <div className="w-64">
          <Input
            placeholder="Search partners..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            prefixIcon={<Search className="w-3.5 h-3.5" />}
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : activeTab === 'customers' ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Name</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center whitespace-nowrap">Outstanding Due</TableHead>
              <TableHead className="min-w-[190px] pl-5 pr-3 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableEmptyState message="No customers found. Click 'Add Customer' to register a new buyer." />
            ) : (
              customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-text-primary">{c.name}</TableCell>
                  <TableCell className="font-mono text-text-secondary">{c.gstin || 'Unregistered'}</TableCell>
                  <TableCell className="text-xs font-mono">{c.phone}</TableCell>
                  <TableCell className="text-text-secondary">
                    {[c.billingCity, c.billingStateCode].filter(Boolean).join(', ') || '-'}
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold text-accent">
                    ₹ {Number(c.outstandingBalance).toFixed(2)}
                  </TableCell>
                  <TableCell className="min-w-[190px] pl-5 pr-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={() => openCustomerEditForm(c)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleDeleteCustomer(c)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Supplier Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center">Payable Balance</TableHead>
              <TableHead className="min-w-[190px] pl-5 pr-3 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.length === 0 ? (
              <TableEmptyState message="No suppliers found. Click 'Add Supplier' to register a vendor." />
            ) : (
              suppliers.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium text-text-primary">{s.name}</TableCell>
                  <TableCell className="text-text-secondary">{s.companyName || '-'}</TableCell>
                  <TableCell className="font-mono text-text-secondary">{s.gstin || 'Unregistered'}</TableCell>
                  <TableCell className="text-xs font-mono">{s.phone}</TableCell>
                  <TableCell className="text-text-secondary">
                    {[s.city, s.stateCode].filter(Boolean).join(', ') || '-'}
                  </TableCell>
                  <TableCell className="text-center font-mono font-semibold text-red-600 dark:text-red-400">
                    ₹ {Number(s.outstandingBalance).toFixed(2)}
                  </TableCell>
                  <TableCell className="min-w-[190px] pl-5 pr-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<Pencil className="h-3.5 w-3.5" />}
                        onClick={() => openSupplierEditForm(s)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        onClick={() => handleDeleteSupplier(s)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Add Customer Modal */}
      <Modal
        isOpen={customerModalOpen}
        onClose={() => {
          setCustomerModalOpen(false);
          setEditingCustomerId(null);
        }}
        title={editingCustomerId ? 'Edit Customer' : 'Register Customer (Debtor)'}
        description={editingCustomerId ? 'Update customer details.' : 'Creates customer profile with billing address and credit terms.'}
      >
        <form onSubmit={handleCreateCustomer} className="space-y-3">
          <div>
            <Input
              label="Customer *"
              maxLength={50}
              value={custForm.name}
              onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
              placeholder="e.g. Ramesh Textiles"
              required
            />
            {custForm.name.length === 50 && (
              <p className="mt-1 text-[11px] text-red-600">Maximum 50 characters reached.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Phone Number *"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              value={custForm.phone}
              onChange={(e) => setCustForm({ ...custForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="9876543210"
              required
            />
            <Input
              label="GSTIN"
              maxLength={15}
              pattern="[A-Za-z0-9]{15}"
              value={custForm.gstin}
              onChange={(e) => setCustForm({
                ...custForm,
                gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15),
              })}
              placeholder="33AAAAA0000A1Z5"
            />
          </div>

          <div>
            <Input
              label="Billing Street Address"
              maxLength={500}
              value={custForm.billingStreet}
              onChange={(e) => setCustForm({ ...custForm, billingStreet: e.target.value })}
              placeholder="Main Road"
            />
            {custForm.billingStreet.length === 500 && (
              <p className="mt-1 text-[11px] text-red-600">Maximum 500 characters reached.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <Input
                label="Location"
                maxLength={30}
                value={custForm.billingCity}
                onChange={(e) => setCustForm({ ...custForm, billingCity: e.target.value })}
              />
              {custForm.billingCity.length === 30 && (
                <p className="mt-1 text-[11px] text-red-600">Maximum 30 characters reached.</p>
              )}
            </div>
            <Input
              label="Credit Limit (₹)"
              type="number"
              step="0.01"
              value={custForm.creditLimit}
              onChange={(e) => setCustForm({ ...custForm, creditLimit: e.target.value })}
              onClick={(e) => e.currentTarget.select()}
            />
            <Input
              label="Opening Bal (₹)"
              type="number"
              step="0.01"
              value={custForm.openingBalance}
              onChange={(e) => setCustForm({ ...custForm, openingBalance: e.target.value })}
              onClick={(e) => e.currentTarget.select()}
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCustomerModalOpen(false);
                setEditingCustomerId(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {editingCustomerId ? 'Save Changes' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={supplierModalOpen}
        onClose={() => {
          setSupplierModalOpen(false);
          setEditingSupplierId(null);
        }}
        title={editingSupplierId ? 'Edit Supplier' : 'Register Vendor / Supplier (Creditor)'}
        description={editingSupplierId ? 'Update supplier details.' : 'Creates supplier profile for purchasing and Accounts Payable tracking.'}
      >
        <form onSubmit={handleCreateSupplier} className="space-y-3">
          <div>
            <Input
              label="Supplier Name *"
              maxLength={50}
              value={suppForm.name}
              onChange={(e) => setSuppForm({ ...suppForm, name: e.target.value })}
              placeholder="e.g. Tirupur Cotton Mills"
              required
            />
            {suppForm.name.length === 50 && (
              <p className="mt-1 text-[11px] text-red-600">Maximum 50 characters reached.</p>
            )}
          </div>

          <Input
            label="Company Name *"
            value={suppForm.companyName}
            onChange={(e) => setSuppForm({ ...suppForm, companyName: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Phone Number *"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              pattern="[0-9]{10}"
              value={suppForm.phone}
              onChange={(e) => setSuppForm({ ...suppForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              placeholder="9789012345"
              required
            />
            <Input
              label="GSTIN"
              maxLength={15}
              pattern="[A-Za-z0-9]{15}"
              value={suppForm.gstin}
              onChange={(e) => setSuppForm({
                ...suppForm,
                gstin: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15),
              })}
              placeholder="33AABCS5432G1Z1"
            />
          </div>

          <div>
            <Input
              label="Address"
              maxLength={500}
              value={suppForm.addressStreet}
              onChange={(e) => setSuppForm({ ...suppForm, addressStreet: e.target.value })}
              placeholder="Optional"
            />
            {suppForm.addressStreet.length === 500 && (
              <p className="mt-1 text-[11px] text-red-600">Maximum 500 characters reached.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <Input
                label="Location"
                maxLength={30}
                value={suppForm.city}
                onChange={(e) => setSuppForm({ ...suppForm, city: e.target.value })}
              />
              {suppForm.city.length === 30 && (
                <p className="mt-1 text-[11px] text-red-600">Maximum 30 characters reached.</p>
              )}
            </div>
            <Input
              label="Payable Balance (₹)"
              type="number"
              step="0.01"
              value={suppForm.openingBalance}
              onChange={(e) => setSuppForm({ ...suppForm, openingBalance: e.target.value })}
              onClick={(e) => e.currentTarget.select()}
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSupplierModalOpen(false);
                setEditingSupplierId(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {editingSupplierId ? 'Save Changes' : 'Save Supplier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
