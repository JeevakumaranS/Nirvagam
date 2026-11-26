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
import { Package, Plus, Search, RefreshCw, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [items, setItems] = useState<
    Array<{ variantId: string; name: string; quantity: number; unitPrice: number; gstRate: number }>
  >([]);

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [purRes, suppRes, prodRes] = await Promise.all([
        apiFetch('/purchases/invoices', { params: { search } }),
        apiFetch('/suppliers'),
        apiFetch('/products'),
      ]);

      setPurchases(purRes?.data || []);
      setSuppliers(suppRes?.data || []);
      setProducts(prodRes?.data || []);

      if (suppRes?.data?.[0]?.id && !supplierId) {
        setSupplierId(suppRes.data[0].id);
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
          quantity: 10,
          unitPrice: Number(variant.purchasePrice || 0),
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

  let totalTaxable = 0;
  let totalTax = 0;
  items.forEach((i) => {
    const taxable = i.quantity * i.unitPrice;
    const tax = (taxable * i.gstRate) / 100;
    totalTaxable += taxable;
    totalTax += tax;
  });
  const grandTotal = Math.round(totalTaxable + totalTax);

  const handleCreatePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId || !billNumber.trim()) {
      toast({ type: 'warning', title: 'Missing details', message: 'Supplier and Bill Number are required.' });
      return;
    }
    if (items.length === 0) {
      toast({ type: 'warning', title: 'No items', message: 'Add items received from vendor.' });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/purchases/invoices', {
        method: 'POST',
        body: JSON.stringify({
          supplierId,
          supplierBillNumber: billNumber.trim(),
          invoiceDate: new Date().toISOString().slice(0, 10),
          mode: 'DIRECT',
          post: true,
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitRate: i.unitPrice,
            taxRate: i.gstRate,
            discountType: 'AMOUNT',
            discountValue: 0,
          })),
        }),
      });

      toast({
        type: 'success',
        title: 'Vendor Bill Recorded',
        message: 'Stock balance incremented and Accounts Payable entry posted.',
      });
      setIsDrawerOpen(false);
      setBillNumber('');
      setItems([]);
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to record bill', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Purchase Management</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Vendor bills, stock intake, Input Tax Credit (ITC) tracking and Accounts Payable ledgers.
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
            Record Purchase Bill
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Input
          placeholder="Filter by bill # or vendor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefixIcon={<Search className="w-3.5 h-3.5" />}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendor Bill #</TableHead>
              <TableHead>Supplier / Mill</TableHead>
              <TableHead>Bill Date</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">Eligible ITC</TableHead>
              <TableHead className="text-right">Grand Total</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {purchases.length === 0 ? (
              <TableEmptyState message="No purchase bills recorded. Click 'Record Purchase Bill' to register vendor inventory." />
            ) : (
              purchases.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-mono text-accent font-semibold">{bill.supplierBillNumber || bill.billNumber}</TableCell>
                  <TableCell className="font-medium text-text-primary">{bill.supplier?.name}</TableCell>
                  <TableCell className="text-text-secondary">
                    {new Date(bill.invoiceDate || bill.billDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    ₹ {Number(bill.taxableAmount).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-600 dark:text-emerald-400">
                    ₹ {Number(bill.totalTax).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-text-primary">
                    ₹ {Number(bill.grandTotal).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge size="sm" variant="accent">{bill.status}</Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Record Purchase Drawer */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Direct Purchase Invoice"
        description="Direct mode: receive goods and post accounting immediately. Against PO/GRN invoices are linked to existing documents."
        width="xl"
      >
        <form onSubmit={handleCreatePurchase} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Supplier / Vendor *"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.city})
                </option>
              ))}
            </Select>

            <Input
              label="Vendor Bill Number *"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              placeholder="e.g. SREE-2026-904"
              required
            />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Add Received Products
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
                    <p className="text-[10px] text-text-tertiary font-mono">Cost: ₹{p.purchasePrice}</p>
                  </div>
                  <span className="font-mono text-accent shrink-0">+ Add</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Received Items ({items.length})
            </p>
            {items.length === 0 ? (
              <div className="py-6 text-center text-xs text-text-tertiary border border-dashed border-border rounded">
                Click items above to add to this purchase bill.
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
                      <p className="text-[11px] text-text-tertiary font-mono">₹{item.unitPrice} purchase cost</p>
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

          <div className="p-3 bg-surface-secondary border border-border rounded space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-text-secondary">
              <span>Taxable Value:</span>
              <span>₹ {totalTaxable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Input Tax Credit (ITC):</span>
              <span>₹ {totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-text-primary pt-1 border-t border-border">
              <span>Bill Grand Total:</span>
              <span className="text-accent">₹ {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Intake Goods & Post Bill
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
