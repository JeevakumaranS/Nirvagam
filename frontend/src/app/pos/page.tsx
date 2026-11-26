'use client';

import React, { useState, useEffect, useRef } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import {
  Barcode,
  Search,
  ShoppingCart,
  Trash2,
  CreditCard,
  Banknote,
  QrCode,
  Printer,
  CheckCircle2,
  Store,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function PosBillingPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<
    Array<{ variantId: string; name: string; sku: string; price: number; gstRate: number; qty: number }>
  >([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [tenderMode, setTenderMode] = useState<'CASH' | 'UPI' | 'CARD'>('CASH');
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<any>(null);
  const [processing, setProcessing] = useState(false);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function loadPosData() {
      try {
        setLoading(true);
        const [prodRes, custRes] = await Promise.all([apiFetch('/products'), apiFetch('/customers')]);
        setProducts(prodRes?.data || []);
        setCustomers(custRes?.data || []);
        if (custRes?.data?.[0]?.id) {
          setSelectedCustomerId(custRes.data[0].id);
        }
      } catch (err: any) {
        toast({ type: 'error', title: 'POS Error', message: err.message });
      } finally {
        setLoading(false);
      }
    }
    loadPosData();
  }, []);

  const addToCart = (product: any) => {
    const variant = product.variants?.[0];
    if (!variant) return;

    const existingIdx = cart.findIndex((item) => item.variantId === variant.id);
    if (existingIdx >= 0) {
      const updated = [...cart];
      updated[existingIdx].qty += 1;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          variantId: variant.id,
          name: product.name,
          sku: product.sku,
          price: Number(product.retailPrice || 0),
          gstRate: Number(product.taxRate?.rate || 18),
          qty: 1,
        },
      ]);
    }
  };

  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const match = products.find(
      (p) =>
        p.barcode === barcodeInput.trim() ||
        p.sku.toLowerCase() === barcodeInput.trim().toLowerCase()
    );

    if (match) {
      addToCart(match);
      setBarcodeInput('');
    } else {
      toast({ type: 'warning', title: 'Not Found', message: `No item found for code: ${barcodeInput}` });
    }
  };

  const updateCartQty = (idx: number, delta: number) => {
    const updated = [...cart];
    updated[idx].qty += delta;
    if (updated[idx].qty <= 0) {
      setCart(cart.filter((_, i) => i !== idx));
    } else {
      setCart(updated);
    }
  };

  // Cart Calculations
  let subtotal = 0;
  let taxTotal = 0;
  cart.forEach((item) => {
    const itemTotal = item.qty * item.price;
    subtotal += itemTotal;
    taxTotal += (itemTotal * item.gstRate) / 100;
  });
  const grandTotal = Math.round(subtotal + taxTotal);

  const handleCompleteSale = async () => {
    if (cart.length === 0) {
      toast({ type: 'warning', title: 'Empty Cart', message: 'Add items before checkout.' });
      return;
    }
    if (!selectedCustomerId) {
      toast({ type: 'warning', title: 'Customer Missing', message: 'Select customer account.' });
      return;
    }

    try {
      setProcessing(true);
      const invoice = await apiFetch('/sales/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId: selectedCustomerId,
          invoiceType: 'POS_RECEIPT',
          notes: `POS Retail Sale • Payment Mode: ${tenderMode}`,
          items: cart.map((c) => ({
            variantId: c.variantId,
            quantity: c.qty,
            unitPrice: c.price,
            gstRate: c.gstRate,
          })),
        }),
      });

      setLastInvoice(invoice);
      setCheckoutModalOpen(true);
      setCart([]);
      toast({ type: 'success', title: 'Sale Completed', message: `Invoice #${invoice.invoiceNumber} recorded.` });
    } catch (err: any) {
      toast({ type: 'error', title: 'Checkout Failed', message: err.message });
    } finally {
      setProcessing(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-3">
      {/* Top Bar for POS */}
      <div className="flex items-center justify-between p-3 bg-surface-secondary border border-border rounded-lg shrink-0">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-accent" />
          <span className="font-semibold text-xs text-text-primary">POS Checkout Counter</span>
          <Badge size="sm" variant="success">Shift Active</Badge>
        </div>

        <form onSubmit={handleBarcodeSubmit} className="flex items-center gap-2 max-w-sm w-full">
          <Input
            ref={barcodeRef}
            value={barcodeInput}
            onChange={(e) => setBarcodeInput(e.target.value)}
            placeholder="Scan barcode or press Enter..."
            prefixIcon={<Barcode className="w-3.5 h-3.5" />}
            autoFocus
          />
        </form>

        <div className="flex items-center gap-2">
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="h-8 px-2.5 text-xs bg-background border border-border rounded text-text-primary focus:outline-none"
          >
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main 2-Column POS Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-3 min-h-0">
        {/* Left: Product Catalog Grid */}
        <div className="lg:col-span-2 flex flex-col bg-background border border-border rounded-lg overflow-hidden">
          <div className="p-2.5 border-b border-border bg-surface-secondary flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Item Catalog
            </span>
            <div className="w-48">
              <Input
                placeholder="Search catalog..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                prefixIcon={<Search className="w-3 h-3" />}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
            {loading ? (
              <Skeleton className="h-28 w-full" />
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-full py-12 text-center text-xs text-text-tertiary">
                No catalog items found.
              </div>
            ) : (
              filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex flex-col justify-between p-3 rounded-lg border border-border bg-surface-secondary/50 hover:bg-surface-secondary hover:border-accent text-left transition-colors"
                >
                  <div>
                    <span className="text-[10px] font-mono text-text-tertiary">{p.sku}</span>
                    <p className="text-xs font-medium text-text-primary line-clamp-2 mt-0.5">{p.name}</p>
                  </div>
                  <div className="mt-2 flex items-center justify-between pt-2 border-t border-border/60">
                    <span className="font-mono text-xs font-semibold text-accent">₹{p.retailPrice}</span>
                    <span className="text-[10px] text-text-tertiary font-mono">Qty: {p.totalStock}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Cart & Tender Register */}
        <div className="flex flex-col bg-background border border-border rounded-lg overflow-hidden">
          <div className="p-2.5 border-b border-border bg-surface-secondary flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShoppingCart className="w-4 h-4 text-accent" />
              <span className="text-xs font-semibold text-text-primary">Current Bill</span>
            </div>
            <Badge size="sm" variant="accent">{cart.length} items</Badge>
          </div>

          {/* Cart Item List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-border/60">
            {cart.length === 0 ? (
              <div className="py-16 text-center text-xs text-text-tertiary">
                Cart is empty. Tap items on the left or scan barcode.
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                  <div className="flex-1 min-w-0 pr-2">
                    <p className="font-medium text-text-primary truncate">{item.name}</p>
                    <p className="text-[10px] text-text-tertiary font-mono">₹{item.price} each</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-border rounded bg-surface-secondary">
                      <button
                        onClick={() => updateCartQty(idx, -1)}
                        className="px-2 py-0.5 hover:bg-app-frame text-text-primary"
                      >
                        -
                      </button>
                      <span className="px-2 font-mono text-xs">{item.qty}</span>
                      <button
                        onClick={() => updateCartQty(idx, 1)}
                        className="px-2 py-0.5 hover:bg-app-frame text-text-primary"
                      >
                        +
                      </button>
                    </div>

                    <span className="w-16 text-right font-mono font-medium">
                      ₹{(item.qty * item.price).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Tender Mode & Checkout Footer */}
          <div className="p-3 bg-surface-secondary border-t border-border space-y-2.5">
            <div className="space-y-1 text-xs font-mono">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal:</span>
                <span>₹ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Tax Breakdown:</span>
                <span>₹ {taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-text-primary pt-1 border-t border-border">
                <span>Total Due:</span>
                <span className="text-accent">₹ {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setTenderMode('CASH')}
                className={`py-1.5 px-2 rounded text-xs flex items-center justify-center gap-1 border ${
                  tenderMode === 'CASH'
                    ? 'bg-accent text-white border-accent'
                    : 'bg-background border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                <Banknote className="w-3.5 h-3.5" />
                <span>Cash</span>
              </button>

              <button
                type="button"
                onClick={() => setTenderMode('UPI')}
                className={`py-1.5 px-2 rounded text-xs flex items-center justify-center gap-1 border ${
                  tenderMode === 'UPI'
                    ? 'bg-accent text-white border-accent'
                    : 'bg-background border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>UPI</span>
              </button>

              <button
                type="button"
                onClick={() => setTenderMode('CARD')}
                className={`py-1.5 px-2 rounded text-xs flex items-center justify-center gap-1 border ${
                  tenderMode === 'CARD'
                    ? 'bg-accent text-white border-accent'
                    : 'bg-background border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Card</span>
              </button>
            </div>

            <Button
              variant="primary"
              onClick={handleCompleteSale}
              loading={processing}
              className="w-full text-xs h-9 font-semibold"
            >
              Complete Sale (₹ {grandTotal})
            </Button>
          </div>
        </div>
      </div>

      {/* POS Thermal Receipt Modal */}
      <Modal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title="POS Retail Slip"
        description="Sale successfully recorded and posted."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-4 bg-surface-secondary border border-border rounded font-mono text-xs space-y-2 text-center">
            <h4 className="font-bold text-sm text-text-primary">NIRVAGAM RETAIL</h4>
            <p className="text-[11px] text-text-tertiary">GSTIN: 33AAAAA0000A1Z5</p>
            <div className="border-b border-dashed border-border py-1">
              <p>Receipt #{lastInvoice?.invoiceNumber}</p>
              <p className="text-[10px] text-text-tertiary">{new Date().toLocaleString()}</p>
            </div>

            <div className="py-2 text-left space-y-1">
              <div className="flex justify-between font-bold">
                <span>Grand Total:</span>
                <span>₹ {Number(lastInvoice?.grandTotal || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-tertiary text-[11px]">
                <span>Tender:</span>
                <span>{tenderMode}</span>
              </div>
            </div>

            <p className="text-[10px] text-text-tertiary pt-2 border-t border-dashed border-border">
              Thank you for shopping with us!
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                window.print();
              }}
              icon={<Printer className="w-3.5 h-3.5" />}
            >
              Print 80mm Slip
            </Button>
            <Button variant="primary" onClick={() => setCheckoutModalOpen(false)}>
              Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
