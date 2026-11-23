'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Drawer } from '@/components/ui/drawer';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Receipt, Plus, Search, RefreshCw, FileText, XCircle, ShoppingBag, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function SalesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('Payment due in 30 days');
  const [items, setItems] = useState<
    Array<{ variantId: string; name: string; quantity: number; unitPrice: number; gstRate: number }>
  >([]);

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, custRes, prodRes] = await Promise.all([
        apiFetch('/sales/invoices', { params: { search } }),
        apiFetch('/customers'),
        apiFetch('/products'),
      ]);

      setInvoices(invRes?.data || []);
      setCustomers(custRes?.data || []);
      setProducts(prodRes?.data || []);

      if (custRes?.data?.[0]?.id && !customerId) {
        setCustomerId(custRes.data[0].id);
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const addItem = (prod: any) => {
    const variant = prod.variants?.[0];
    if (!variant) return;

    const existingIdx = items.findIndex((i) => i.variantId === variant.id);
    if (existingIdx >= 0) {
      const copy = [...items];
      copy[existingIdx].quantity += 1;
      setItems(copy);
    } else {
      setItems([
        ...items,
        {
          variantId: variant.id,
          name: prod.name,
          quantity: 1,
          unitPrice: Number(variant.salesPrice || 0),
          gstRate: Number(prod.taxRate?.rate || 18),
        },
      ]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const updateQuantity = (index: number, qty: number) => {
    const copy = [...items];
    copy[index].quantity = Math.max(1, qty);
    setItems(copy);
  };

  // Real-time invoice preview calculation
  let totalTaxable = 0;
  let totalTax = 0;
  items.forEach((i) => {
    const taxable = i.quantity * i.unitPrice;
    const tax = (taxable * i.gstRate) / 100;
    totalTaxable += taxable;
    totalTax += tax;
  });
  const grandTotal = Math.round(totalTaxable + totalTax);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      toast({ type: 'warning', title: 'Customer Required', message: 'Please select a customer.' });
      return;
    }
    if (items.length === 0) {
      toast({ type: 'warning', title: 'Cart Empty', message: 'Add at least one item to the invoice.' });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/sales/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          notes,
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            gstRate: i.gstRate,
          })),
        }),
      });

      toast({
        type: 'success',
        title: 'Invoice Issued',
        message: 'Tax invoice generated with automated ledger entry and inventory deduction.',
      });
      setIsDrawerOpen(false);
      setItems([]);
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to create invoice', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelInvoice = async (id: string, num: string) => {
    if (!confirm(`Are you sure you want to cancel invoice ${num}? This will restore stock balance.`)) return;

    try {
      await apiFetch(`/sales/invoices/${id}/cancel`, { method: 'POST' });
      toast({ type: 'success', title: 'Invoice Cancelled', message: `${num} cancelled and stock reversed.` });
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Cancellation failed', message: err.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Commercial Sales & Billing</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            GST Tax Invoices, credit management, automated double-entry postings, and stock updates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsDrawerOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            New Tax Invoice
          </Button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-2 max-w-sm">
        <Input
          placeholder="Filter by invoice # or customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefixIcon={<Search className="w-3.5 h-3.5" />}
        />
      </div>

      {/* Invoices Table */}
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
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">GST (Total)</TableHead>
              <TableHead className="text-right">Grand Total</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableEmptyState message="No sales invoices found. Click 'New Tax Invoice' to issue your first bill." />
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-accent font-semibold">{inv.invoiceNumber}</TableCell>
                  <TableCell className="font-medium text-text-primary">
                    {inv.customer?.name || 'Walk-in Customer'}
                  </TableCell>
                  <TableCell className="text-text-secondary">
                    {new Date(inv.invoiceDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    ₹ {Number(inv.taxableAmount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    ₹ {Number(inv.totalTax).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-text-primary">
                    ₹ {Number(inv.grandTotal).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      size="sm"
                      variant={
                        inv.status === 'PAID'
                          ? 'success'
                          : inv.status === 'POSTED'
                          ? 'accent'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {inv.status !== 'CANCELLED' ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelInvoice(inv.id, inv.invoiceNumber)}
                        title="Cancel Invoice & Restore Stock"
                      >
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    ) : (
                      <span className="text-[11px] text-text-tertiary">Reversed</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* New Invoice Slide-over Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Create Commercial Tax Invoice"
        description="Select customer, add line items with GST calculations and automatically post to general ledger."
        width="xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <Select
            label="Bill To Customer *"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.gstin ? `(${c.gstin})` : ''} - Bal: ₹{Number(c.outstandingBalance).toFixed(2)}
              </option>
            ))}
          </Select>

          {/* Catalog Item Picker */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Quick Add From Catalog
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-surface-secondary border border-border rounded">
              {products.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => addItem(p)}
                  className="flex items-center justify-between p-2 rounded text-left text-xs bg-background border border-border hover:border-accent transition-colors"
                >
                  <div className="truncate mr-2">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-[10px] text-text-tertiary font-mono">Stock: {p.totalStock}</p>
                  </div>
                  <span className="font-mono text-accent shrink-0">₹{p.salesPrice}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Selected Line Items */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Invoice Line Items ({items.length})
            </p>
            {items.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-tertiary border border-dashed border-border rounded">
                Click any catalog item above to add it to this invoice.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 p-2 bg-surface-secondary border border-border rounded text-xs"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-text-primary truncate">{item.name}</p>
                      <p className="text-[11px] text-text-tertiary font-mono">
                        ₹{item.unitPrice} + {item.gstRate}% GST
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                        className="w-16 h-7 text-center font-mono border border-border rounded bg-background text-xs"
                      />
                      <span className="w-20 text-right font-mono font-medium">
                        ₹{(item.quantity * item.unitPrice).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="p-1 text-text-tertiary hover:text-red-500 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invoice Summary Box */}
          <div className="p-3 bg-surface-secondary border border-border rounded space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-text-secondary">
              <span>Taxable Value:</span>
              <span>₹ {totalTaxable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Applicable GST:</span>
              <span>₹ {totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-text-primary pt-1 border-t border-border">
              <span>Net Grand Total:</span>
              <span className="text-accent">₹ {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <Input label="Invoice Notes / Terms" value={notes} onChange={(e) => setNotes(e.target.value)} />

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Issue & Post Invoice
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
