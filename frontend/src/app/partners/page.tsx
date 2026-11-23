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
import { Users2, UserPlus, Building, Search, RefreshCw, Phone, Mail } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PartnersPage() {
  const [activeTab, setActiveTab] = useState('customers');
  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Forms
  const [custForm, setCustForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    gstin: '',
    billingStreet: '',
    billingCity: 'Chennai',
    billingState: 'Tamil Nadu',
    billingStateCode: '33',
    billingPincode: '600001',
    creditLimit: 50000,
    openingBalance: 0,
  });

  const [suppForm, setSuppForm] = useState({
    name: '',
    companyName: '',
    phone: '',
    email: '',
    gstin: '',
    addressStreet: '',
    city: 'Tirupur',
    state: 'Tamil Nadu',
    stateCode: '33',
    pincode: '641604',
    creditPeriodDays: 30,
    openingBalance: 0,
  });

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

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name || !custForm.phone) {
      toast({ type: 'warning', title: 'Missing details', message: 'Name and Phone number are required.' });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/customers', {
        method: 'POST',
        body: JSON.stringify(custForm),
      });
      toast({ type: 'success', title: 'Customer Registered', message: `${custForm.name} added.` });
      setCustomerModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to add customer', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suppForm.name || !suppForm.phone) {
      toast({ type: 'warning', title: 'Missing details', message: 'Vendor name and Phone are required.' });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/suppliers', {
        method: 'POST',
        body: JSON.stringify(suppForm),
      });
      toast({ type: 'success', title: 'Supplier Registered', message: `${suppForm.name} added.` });
      setSupplierModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to add supplier', message: err.message });
    } finally {
      setSubmitting(false);
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
              onClick={() => setCustomerModalOpen(true)}
              icon={<UserPlus className="w-3.5 h-3.5" />}
            >
              Add Customer
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setSupplierModalOpen(true)}
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
              <TableHead>Company / Trade</TableHead>
              <TableHead>GSTIN</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Credit Limit</TableHead>
              <TableHead className="text-right">Outstanding Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.length === 0 ? (
              <TableEmptyState message="No customers found. Click 'Add Customer' to register a new buyer." />
            ) : (
              customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium text-text-primary">{c.name}</TableCell>
                  <TableCell className="text-text-secondary">{c.companyName || '-'}</TableCell>
                  <TableCell className="font-mono text-text-secondary">{c.gstin || 'Unregistered'}</TableCell>
                  <TableCell className="text-xs font-mono">{c.phone}</TableCell>
                  <TableCell className="text-text-secondary">{c.billingCity}, {c.billingStateCode}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    ₹ {Number(c.creditLimit).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-accent">
                    ₹ {Number(c.outstandingBalance).toFixed(2)}
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
              <TableHead className="text-right">Credit Period</TableHead>
              <TableHead className="text-right">Payable Balance</TableHead>
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
                  <TableCell className="text-text-secondary">{s.city}, {s.stateCode}</TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {s.creditPeriodDays} Days
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-red-600 dark:text-red-400">
                    ₹ {Number(s.outstandingBalance).toFixed(2)}
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
        onClose={() => setCustomerModalOpen(false)}
        title="Register Customer (Debtor)"
        description="Creates customer profile with billing address and credit terms."
      >
        <form onSubmit={handleCreateCustomer} className="space-y-3">
          <Input
            label="Customer / Trade Name *"
            value={custForm.name}
            onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
            placeholder="e.g. Ramesh Textiles"
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Phone Number *"
              value={custForm.phone}
              onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
              placeholder="+91 9876543210"
              required
            />
            <Input
              label="GSTIN"
              value={custForm.gstin}
              onChange={(e) => setCustForm({ ...custForm, gstin: e.target.value.toUpperCase() })}
              placeholder="33AAAAA0000A1Z5"
            />
          </div>

          <Input
            label="Billing Street Address"
            value={custForm.billingStreet}
            onChange={(e) => setCustForm({ ...custForm, billingStreet: e.target.value })}
            placeholder="Main Road"
          />

          <div className="grid grid-cols-3 gap-2.5">
            <Input
              label="City"
              value={custForm.billingCity}
              onChange={(e) => setCustForm({ ...custForm, billingCity: e.target.value })}
            />
            <Input
              label="Credit Limit (₹)"
              type="number"
              value={custForm.creditLimit}
              onChange={(e) => setCustForm({ ...custForm, creditLimit: Number(e.target.value) })}
            />
            <Input
              label="Opening Bal (₹)"
              type="number"
              value={custForm.openingBalance}
              onChange={(e) => setCustForm({ ...custForm, openingBalance: Number(e.target.value) })}
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setCustomerModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={supplierModalOpen}
        onClose={() => setSupplierModalOpen(false)}
        title="Register Vendor / Supplier (Creditor)"
        description="Creates supplier profile for purchasing and Accounts Payable tracking."
      >
        <form onSubmit={handleCreateSupplier} className="space-y-3">
          <Input
            label="Supplier / Vendor Name *"
            value={suppForm.name}
            onChange={(e) => setSuppForm({ ...suppForm, name: e.target.value })}
            placeholder="e.g. Tirupur Cotton Mills"
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Phone Number *"
              value={suppForm.phone}
              onChange={(e) => setSuppForm({ ...suppForm, phone: e.target.value })}
              placeholder="+91 9789012345"
              required
            />
            <Input
              label="GSTIN"
              value={suppForm.gstin}
              onChange={(e) => setSuppForm({ ...suppForm, gstin: e.target.value.toUpperCase() })}
              placeholder="33AABCS5432G1Z1"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Input
              label="City"
              value={suppForm.city}
              onChange={(e) => setSuppForm({ ...suppForm, city: e.target.value })}
            />
            <Input
              label="Credit Period (Days)"
              type="number"
              value={suppForm.creditPeriodDays}
              onChange={(e) => setSuppForm({ ...suppForm, creditPeriodDays: Number(e.target.value) })}
            />
            <Input
              label="Opening Bal (₹)"
              type="number"
              value={suppForm.openingBalance}
              onChange={(e) => setSuppForm({ ...suppForm, openingBalance: Number(e.target.value) })}
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setSupplierModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Supplier
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
