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
import { InvoiceType, PaymentMode, RecurrenceFrequency, calculateGstInvoice } from '@nirvagam/shared';
import {
  CheckCircle,
  Copy,
  CreditCard,
  Plus,
  Repeat,
  Search,
  RefreshCw,
  XCircle,
  Trash2,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth-context';

const invoiceTypeOptions = [
  { value: InvoiceType.TAX_INVOICE, label: 'Tax Invoice' },
  { value: InvoiceType.BILL_OF_SUPPLY, label: 'Bill of Supply' },
  { value: InvoiceType.NON_GST, label: 'Non-GST Invoice' },
  { value: InvoiceType.PROFORMA, label: 'Proforma Invoice' },
  { value: InvoiceType.QUOTATION, label: 'Quotation' },
  { value: InvoiceType.ESTIMATE, label: 'Estimate' },
  { value: InvoiceType.SALES_ORDER, label: 'Sales Order' },
  { value: InvoiceType.DELIVERY_CHALLAN, label: 'Delivery Challan' },
  { value: InvoiceType.CREDIT_NOTE, label: 'Credit Note' },
  { value: InvoiceType.DEBIT_NOTE, label: 'Debit Note' },
  { value: InvoiceType.SALES_RETURN, label: 'Sales Return' },
  { value: InvoiceType.RECURRING_INVOICE, label: 'Recurring Invoice' },
  { value: InvoiceType.POS_RECEIPT, label: 'POS Receipt' },
];

const paymentModeOptions = [
  { value: PaymentMode.CASH, label: 'Cash' },
  { value: PaymentMode.BANK_TRANSFER, label: 'Bank Transfer' },
  { value: PaymentMode.UPI, label: 'UPI' },
  { value: PaymentMode.CARD, label: 'Card' },
  { value: PaymentMode.CHEQUE, label: 'Cheque' },
];

const draftDocumentTypes = new Set<InvoiceType>([
  InvoiceType.QUOTATION,
  InvoiceType.ESTIMATE,
  InvoiceType.PROFORMA,
  InvoiceType.SALES_ORDER,
  InvoiceType.RECURRING_INVOICE,
]);

const issuableDraftTypes = new Set<InvoiceType>([
  InvoiceType.QUOTATION,
  InvoiceType.ESTIMATE,
  InvoiceType.PROFORMA,
  InvoiceType.SALES_ORDER,
]);

const adjustmentDocumentTypes = new Set<InvoiceType>([
  InvoiceType.CREDIT_NOTE,
  InvoiceType.DEBIT_NOTE,
  InvoiceType.SALES_RETURN,
]);

const paymentDocumentTypes = new Set<InvoiceType>([
  InvoiceType.TAX_INVOICE,
  InvoiceType.BILL_OF_SUPPLY,
  InvoiceType.NON_GST,
  InvoiceType.POS_RECEIPT,
  InvoiceType.DEBIT_NOTE,
]);

const today = () => new Date().toISOString().slice(0, 10);
const defaultDueDate = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

export default function SalesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<any | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(PaymentMode.CASH);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [taxContext, setTaxContext] = useState<{ stateCode: string; registered: boolean }>({
    stateCode: '',
    registered: false,
  });

  // Form State
  const [customerId, setCustomerId] = useState('');
  const [invoiceType, setInvoiceType] = useState<InvoiceType>(InvoiceType.TAX_INVOICE);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [relatedInvoiceId, setRelatedInvoiceId] = useState('');
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<RecurrenceFrequency>(
    RecurrenceFrequency.MONTHLY
  );
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [invoiceDiscountPercent, setInvoiceDiscountPercent] = useState(0);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [payments, setPayments] = useState<Array<{ amount: number; mode: PaymentMode }>>([]);
  const [notes, setNotes] = useState('Payment due in 30 days');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<
    Array<{
      variantId: string;
      name: string;
      unitName: string;
      quantity: number;
      unitPrice: number;
      gstRate: number;
      discountPercent: number;
      discountAmount: number;
    }>
  >([]);

  const { toast } = useToast();
  const { user } = useAuth();

  const loadData = async () => {
    try {
      setLoading(true);
      const [invRes, custRes, prodRes, unitRes, taxRes] = await Promise.all([
        apiFetch('/sales/invoices', { params: { search } }),
        apiFetch('/customers'),
        apiFetch('/products'),
        apiFetch('/products/meta/units'),
        apiFetch('/sales/tax-context'),
      ]);

      setInvoices(invRes?.data || []);
      setCustomers(custRes?.data || []);
      setProducts(prodRes?.data || []);
      setUnits(Array.isArray(unitRes) ? unitRes : unitRes?.data || []);
      setTaxContext(taxRes?.data || taxRes);

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

  const addItem = (prod: any, selectedVariant = prod.variants?.[0]) => {
    const variant = selectedVariant;
    if (!variant) return;

    const existingIdx = items.findIndex((i) => i.variantId === variant.id);
    if (existingIdx >= 0) {
      const copy = [...items];
      copy[existingIdx].quantity += 1;
      copy[existingIdx].discountAmount =
        (copy[existingIdx].quantity * copy[existingIdx].unitPrice * copy[existingIdx].discountPercent) / 100;
      setItems(copy);
    } else {
      setItems([
        ...items,
        {
          variantId: variant.id,
          name: prod.name,
          unitName: prod.unit?.symbol || '',
          quantity: 1,
          unitPrice: Number(variant.salesPrice || 0),
          gstRate: Number(prod.taxRate?.rate || 18),
          discountPercent: 0,
          discountAmount: 0,
        },
      ]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, idx) => idx !== index));
  };

  const updateQuantity = (index: number, qty: number) => {
    const copy = [...items];
    copy[index].quantity = Math.max(0.01, qty);
    copy[index].discountAmount =
      (copy[index].quantity * copy[index].unitPrice * copy[index].discountPercent) / 100;
    setItems(copy);
  };

  const updateItemDiscountPercent = (index: number, discountPercent: number) => {
    const copy = [...items];
    copy[index].discountPercent = Math.min(100, Math.max(0, discountPercent));
    copy[index].discountAmount =
      (copy[index].quantity * copy[index].unitPrice * copy[index].discountPercent) / 100;
    setItems(copy);
  };

  const updateItemDiscountAmount = (index: number, discountAmount: number) => {
    const copy = [...items];
    const lineTotal = copy[index].quantity * copy[index].unitPrice;
    copy[index].discountAmount = Math.min(lineTotal, Math.max(0, discountAmount));
    copy[index].discountPercent =
      lineTotal > 0 ? (copy[index].discountAmount / lineTotal) * 100 : 0;
    setItems(copy);
  };

  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const previewSellerRegistered =
    taxContext.registered &&
    invoiceType !== InvoiceType.BILL_OF_SUPPLY &&
    invoiceType !== InvoiceType.NON_GST;
  const invoiceDiscountableBase = items.reduce((total, item) => {
    const lineAmount = Math.max(0, item.quantity * item.unitPrice - item.discountAmount);
    return (
      total +
      (pricesIncludeTax && previewSellerRegistered && item.gstRate > 0
        ? lineAmount / (1 + item.gstRate / 100)
        : lineAmount)
    );
  }, 0);
  const gstCalculation = calculateGstInvoice(
    taxContext.stateCode || selectedCustomer?.billingStateCode || '',
    selectedCustomer?.shippingStateCode || selectedCustomer?.billingStateCode || '',
    items.map((item) => ({
      id: item.variantId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountAmount: item.discountAmount,
      gstRate: item.gstRate,
    })),
    invoiceDiscount,
    {
      pricesIncludeTax,
      sellerRegisteredForGst: previewSellerRegistered,
      otherCharges: additionalCharges,
    }
  );
  const { totalTaxable, totalTax, totalCgst, totalSgst, totalIgst, roundOffAmount, netTotal: grandTotal } =
    gstCalculation;

  const scanBarcode = () => {
    const code = barcodeInput.trim().toLowerCase();
    if (!code) return;
    const product = products.find(
      (candidate) =>
        candidate.barcode?.toLowerCase() === code ||
        candidate.variants?.some(
          (variant: any) =>
            variant.barcode?.toLowerCase() === code || variant.sku?.toLowerCase() === code
        )
    );
    const variant = product?.variants?.find(
      (candidate: any) =>
        candidate.barcode?.toLowerCase() === code || candidate.sku?.toLowerCase() === code
    ) || product?.variants?.[0];
    if (!product || !variant) {
      toast({ type: 'warning', title: 'Not Found', message: `No item found for code: ${barcodeInput}` });
      return;
    }
    addItem(product, variant);
    setBarcodeInput('');
  };

  const handleRelatedInvoiceSelect = async (id: string) => {
    setRelatedInvoiceId(id);
    if (!id) return;
    try {
      const response = await apiFetch(`/sales/invoices/${id}`);
      const originalInvoice = response?.data || response;
      setItems(
        (originalInvoice.items || []).map((item: any) => ({
          variantId: item.variantId,
          name: item.variant?.product?.name || item.description || 'Invoice item',
          unitName: item.unitName || item.variant?.product?.unit?.symbol || '',
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          gstRate: Number(item.gstRate),
          discountPercent:
            Number(item.quantity) * Number(item.unitPrice) > 0
              ? (Number(item.discountAmount || 0) /
                  (Number(item.quantity) * Number(item.unitPrice))) *
                100
              : 0,
          discountAmount: Number(item.discountAmount || 0),
        }))
      );
      setCustomerId(originalInvoice.customerId);
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to load invoice', message: err.message });
    }
  };

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
    if (adjustmentDocumentTypes.has(invoiceType) && !relatedInvoiceId) {
      toast({ type: 'warning', title: 'Original Invoice Required', message: 'Select the invoice being adjusted.' });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/sales/invoices', {
        method: 'POST',
        body: JSON.stringify({
          customerId,
          invoiceType,
          invoiceNumber: invoiceNumber.trim() || undefined,
          relatedInvoiceId: adjustmentDocumentTypes.has(invoiceType) ? relatedInvoiceId : undefined,
          recurrenceFrequency:
            invoiceType === InvoiceType.RECURRING_INVOICE ? recurrenceFrequency : undefined,
          invoiceDate,
          dueDate,
          pricesIncludeTax,
          placeOfSupplyCode:
            selectedCustomer?.shippingStateCode || selectedCustomer?.billingStateCode,
          discountAmount: invoiceDiscount,
          additionalCharges,
          payments: paymentDocumentTypes.has(invoiceType)
            ? payments.filter((payment) => payment.amount > 0)
            : [],
          notes,
          terms,
          items: items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            gstRate: i.gstRate,
            discountAmount: i.discountAmount,
            unitName: i.unitName,
          })),
        }),
      });

      toast({
        type: 'success',
        title: draftDocumentTypes.has(invoiceType) ? 'Document Saved' : 'Invoice Issued',
        message: draftDocumentTypes.has(invoiceType)
          ? 'Draft document saved without posting accounting entries or changing stock.'
          : 'Invoice generated with ledger entry, payment allocation, and inventory update.',
      });
      setIsDrawerOpen(false);
      setItems([]);
      setPayments([]);
      setInvoiceNumber('');
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to create invoice', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice || Number(paymentAmount) <= 0) return;
    try {
      setPaymentSubmitting(true);
      await apiFetch(`/sales/invoices/${paymentInvoice.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: Number(paymentAmount), mode: paymentMode }),
      });
      toast({ type: 'success', title: 'Payment Recorded', message: 'Invoice balance and payment status updated.' });
      setPaymentInvoice(null);
      setPaymentAmount('');
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Payment failed', message: err.message });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleGenerateRecurring = async (id: string, templateNumber: string) => {
    try {
      await apiFetch(`/sales/invoices/${id}/generate`, { method: 'POST' });
      toast({
        type: 'success',
        title: 'Invoice Generated',
        message: `A new invoice was created from ${templateNumber}.`,
      });
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Generation failed', message: err.message });
    }
  };

  const handleIssueDraft = async (id: string, documentNumber: string) => {
    try {
      await apiFetch(`/sales/invoices/${id}/issue`, { method: 'POST' });
      toast({
        type: 'success',
        title: 'Document Issued',
        message: `${documentNumber} was issued without posting accounting entries or changing stock.`,
      });
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Issue failed', message: err.message });
    }
  };

  const handleDuplicateInvoice = async (id: string) => {
    try {
      const response = await apiFetch(`/sales/invoices/${id}`);
      const originalInvoice = response?.data || response;
      setCustomerId(originalInvoice.customerId);
      setInvoiceType(
        adjustmentDocumentTypes.has(originalInvoice.invoiceType)
          ? InvoiceType.TAX_INVOICE
          : originalInvoice.invoiceType
      );
      setRelatedInvoiceId('');
      setInvoiceNumber('');
      setInvoiceDate(today());
      setDueDate(defaultDueDate());
      setPricesIncludeTax(Boolean(originalInvoice.pricesIncludeTax));
      setInvoiceDiscount(Math.max(0, Number(originalInvoice.discountAmount || 0)));
      const taxableBeforeInvoiceDiscount =
        Number(originalInvoice.taxableAmount || 0) + Number(originalInvoice.discountAmount || 0);
      setInvoiceDiscountPercent(
        taxableBeforeInvoiceDiscount > 0
          ? (Number(originalInvoice.discountAmount || 0) / taxableBeforeInvoiceDiscount) * 100
          : 0
      );
      setAdditionalCharges(Math.max(0, Number(originalInvoice.additionalCharges || 0)));
      setRecurrenceFrequency(
        originalInvoice.recurrenceFrequency || RecurrenceFrequency.MONTHLY
      );
      setPayments([]);
      setNotes(originalInvoice.notes || '');
      setTerms(originalInvoice.terms || '');
      setItems(
        (originalInvoice.items || []).map((item: any) => ({
          variantId: item.variantId,
          name: item.variant?.product?.name || item.description || 'Invoice item',
          unitName: item.unitName || item.variant?.product?.unit?.symbol || '',
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          gstRate: Number(item.gstRate),
          discountPercent:
            Number(item.quantity) * Number(item.unitPrice) > 0
              ? (Number(item.discountAmount || 0) /
                  (Number(item.quantity) * Number(item.unitPrice))) *
                100
              : 0,
          discountAmount: Number(item.discountAmount || 0),
        }))
      );
      setIsDrawerOpen(true);
    } catch (err: any) {
      toast({ type: 'error', title: 'Unable to duplicate invoice', message: err.message });
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

  const canSetManualNumber = Boolean(
    user?.permissions.includes('sales_invoice:manual_number') ||
      user?.roles.some((role) => ['BUSINESS_OWNER', 'BUSINESS_ADMIN'].includes(role))
  );

  const openNewInvoice = () => {
    setInvoiceType(InvoiceType.TAX_INVOICE);
    setInvoiceNumber('');
    setRelatedInvoiceId('');
    setRecurrenceFrequency(RecurrenceFrequency.MONTHLY);
    setInvoiceDate(today());
    setDueDate(defaultDueDate());
    setPricesIncludeTax(false);
    setInvoiceDiscount(0);
    setInvoiceDiscountPercent(0);
    setAdditionalCharges(0);
    setPayments([]);
    setNotes('Payment due in 30 days');
    setTerms('');
    setItems([]);
    setIsDrawerOpen(true);
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
            onClick={openNewInvoice}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            New Sales Document
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
              <TableHead>Document #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Taxable</TableHead>
              <TableHead className="text-right">GST (Total)</TableHead>
              <TableHead className="text-right">Grand Total</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 ? (
              <TableEmptyState message="No sales documents found. Create your first sales document." />
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell>
                    <div className="font-mono text-accent font-semibold">{inv.invoiceNumber}</div>
                    <div className="text-[10px] text-text-tertiary">{String(inv.invoiceType).replace(/_/g, ' ')}</div>
                  </TableCell>
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
                          : inv.status === 'POSTED' || inv.status === 'DRAFT'
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
                    <div className="inline-flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDuplicateInvoice(inv.id)}
                        title="Duplicate document"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {inv.status === 'DRAFT' && issuableDraftTypes.has(inv.invoiceType) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleIssueDraft(inv.id, inv.invoiceNumber)}
                          title="Issue document"
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-accent" />
                        </Button>
                      )}
                      {inv.invoiceType === InvoiceType.RECURRING_INVOICE && inv.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleGenerateRecurring(inv.id, inv.invoiceNumber)}
                          title="Generate invoice from this recurring template"
                        >
                          <Repeat className="w-3.5 h-3.5 text-accent" />
                        </Button>
                      )}
                      {paymentDocumentTypes.has(inv.invoiceType) &&
                        !['CANCELLED', 'DRAFT', 'PAID'].includes(inv.status) &&
                        Number(inv.paidAmount) < Number(inv.grandTotal) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setPaymentInvoice(inv);
                              setPaymentAmount('');
                            }}
                            title="Record payment"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-accent" />
                          </Button>
                        )}
                      {inv.status !== 'CANCELLED' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCancelInvoice(inv.id, inv.invoiceNumber)}
                          title="Cancel Document"
                        >
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      ) : (
                        <span className="text-[11px] text-text-tertiary">Reversed</span>
                      )}
                    </div>
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
        title="Create Sales & Billing Document"
        description="Select a document type, customer, items, tax treatment, and payments."
        width="xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <Select
            label="Document Type *"
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
            options={invoiceTypeOptions}
          />

          {adjustmentDocumentTypes.has(invoiceType) && (
            <Select
              label="Original Invoice *"
              value={relatedInvoiceId}
              onChange={(e) => handleRelatedInvoiceSelect(e.target.value)}
            >
              <option value="">Select original invoice</option>
              {invoices
                .filter(
                  (invoice) =>
                    !['CANCELLED', 'DRAFT'].includes(invoice.status) &&
                    Number(invoice.grandTotal) > 0
                )
                .map((invoice) => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoiceNumber} · {invoice.customer?.name} · ₹
                    {Number(invoice.grandTotal).toFixed(2)}
                  </option>
                ))}
            </Select>
          )}

          {invoiceType === InvoiceType.RECURRING_INVOICE && (
            <Select
              label="Repeat Frequency"
              value={recurrenceFrequency}
              onChange={(e) => setRecurrenceFrequency(e.target.value as RecurrenceFrequency)}
              options={[
                { value: RecurrenceFrequency.WEEKLY, label: 'Weekly' },
                { value: RecurrenceFrequency.MONTHLY, label: 'Monthly' },
                { value: RecurrenceFrequency.QUARTERLY, label: 'Quarterly' },
                { value: RecurrenceFrequency.YEARLY, label: 'Yearly' },
              ]}
            />
          )}

          {canSetManualNumber && (
            <Input
              label="Manual Document Number (optional)"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Leave blank to number automatically"
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Document Date"
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
            />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>

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
            <div className="flex items-end gap-2">
              <Input
                label="Barcode / SKU"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    scanBarcode();
                  }
                }}
                placeholder="Scan or enter product code"
              />
              <Button type="button" size="sm" variant="secondary" onClick={scanBarcode}>
                Add
              </Button>
            </div>
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
                    <p className="text-[10px] text-text-tertiary font-mono">
                      {p.unit?.symbol || 'Unit'} · Stock: {p.totalStock}
                    </p>
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
                        ₹{item.unitPrice} / {item.unitName || 'unit'} · {item.gstRate}% GST
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Select
                        aria-label={`Unit for ${item.name}`}
                        value={item.unitName}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].unitName = e.target.value;
                          setItems(copy);
                        }}
                        options={units.map((unit) => ({
                          value: unit.symbol,
                          label: unit.symbol,
                        }))}
                        className="w-16"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => {
                          const copy = [...items];
                          copy[idx].unitPrice = Math.max(0, Number(e.target.value));
                          copy[idx].discountAmount =
                            (copy[idx].quantity *
                              copy[idx].unitPrice *
                              copy[idx].discountPercent) /
                            100;
                          setItems(copy);
                        }}
                        className="w-20 h-7 text-center font-mono border border-border rounded bg-background text-xs"
                        aria-label={`Unit price of ${item.name}`}
                      />
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.quantity}
                        onChange={(e) => updateQuantity(idx, Number(e.target.value))}
                        className="w-16 h-7 text-center font-mono border border-border rounded bg-background text-xs"
                        aria-label={`Quantity of ${item.name}`}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={Number(item.discountPercent.toFixed(2))}
                        onChange={(e) => updateItemDiscountPercent(idx, Number(e.target.value))}
                        className="w-16 h-7 text-center font-mono border border-border rounded bg-background text-xs"
                        aria-label={`Discount percentage on ${item.name}`}
                        title="Discount percentage"
                        placeholder="Disc %"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={Number(item.discountAmount.toFixed(2))}
                        onChange={(e) => updateItemDiscountAmount(idx, Number(e.target.value))}
                        className="w-16 h-7 text-center font-mono border border-border rounded bg-background text-xs"
                        aria-label={`Discount amount on ${item.name}`}
                        title="Item discount amount"
                        placeholder="Disc ₹"
                      />
                      <span className="w-20 text-right font-mono font-medium">
                        ₹{Math.max(0, item.quantity * item.unitPrice - item.discountAmount).toFixed(2)}
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
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Invoice Discount %"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={invoiceDiscountPercent}
              onChange={(e) => {
                const percent = Math.min(100, Math.max(0, Number(e.target.value)));
                setInvoiceDiscountPercent(percent);
                setInvoiceDiscount((invoiceDiscountableBase * percent) / 100);
              }}
            />
            <Input
              label="Invoice Discount Amount"
              type="number"
              min="0"
              step="0.01"
              value={invoiceDiscount}
              onChange={(e) => {
                const amount = Math.min(invoiceDiscountableBase, Math.max(0, Number(e.target.value)));
                setInvoiceDiscount(amount);
                setInvoiceDiscountPercent(
                  invoiceDiscountableBase > 0 ? (amount / invoiceDiscountableBase) * 100 : 0
                );
              }}
            />
            <Input
              label="Other Charges"
              type="number"
              min="0"
              step="0.01"
              value={additionalCharges}
              onChange={(e) => setAdditionalCharges(Math.max(0, Number(e.target.value)))}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={pricesIncludeTax}
              onChange={(e) => setPricesIncludeTax(e.target.checked)}
              className="accent-accent"
            />
            Product prices include GST
          </label>

          <div className="p-3 bg-surface-secondary border border-border rounded space-y-1.5 text-xs font-mono">
            <div className="flex justify-between text-text-secondary">
              <span>Taxable Value:</span>
              <span>₹ {totalTaxable.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>CGST:</span>
              <span>₹ {totalCgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>SGST:</span>
              <span>₹ {totalSgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>IGST:</span>
              <span>₹ {totalIgst.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Total GST:</span>
              <span>₹ {totalTax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-text-secondary">
              <span>Round-off:</span>
              <span>₹ {roundOffAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-text-primary pt-1 border-t border-border">
              <span>Net Grand Total:</span>
              <span className="text-accent">₹ {grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {paymentDocumentTypes.has(invoiceType) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                Initial Payments
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setPayments([...payments, { amount: 0, mode: PaymentMode.CASH }])}
              >
                Add Payment
              </Button>
            </div>
            {payments.map((payment, index) => (
              <div key={index} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Select
                  label="Mode"
                  value={payment.mode}
                  onChange={(e) => {
                    const copy = [...payments];
                    copy[index].mode = e.target.value as PaymentMode;
                    setPayments(copy);
                  }}
                  options={paymentModeOptions}
                />
                <Input
                  label="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={payment.amount}
                  onChange={(e) => {
                    const copy = [...payments];
                    copy[index].amount = Math.max(0, Number(e.target.value));
                    setPayments(copy);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPayments(payments.filter((_, itemIndex) => itemIndex !== index))}
                  title="Remove payment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
          )}

          <Input label="Invoice Notes / Terms" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <Input label="Terms and Conditions" value={terms} onChange={(e) => setTerms(e.target.value)} />

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              {draftDocumentTypes.has(invoiceType) ? 'Save Draft Document' : 'Issue & Post Document'}
            </Button>
          </div>
        </form>
      </Drawer>

      <Drawer
        isOpen={Boolean(paymentInvoice)}
        onClose={() => setPaymentInvoice(null)}
        title={`Record Payment${paymentInvoice ? ` · ${paymentInvoice.invoiceNumber}` : ''}`}
        description={
          paymentInvoice
            ? `Outstanding: ₹${(Number(paymentInvoice.grandTotal) - Number(paymentInvoice.paidAmount)).toFixed(2)}`
            : ''
        }
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <Select
            label="Payment Mode"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
            options={paymentModeOptions}
          />
          <Input
            label="Payment Amount"
            type="number"
            min="0.01"
            step="0.01"
            max={
              paymentInvoice
                ? Number(paymentInvoice.grandTotal) - Number(paymentInvoice.paidAmount)
                : undefined
            }
            value={paymentAmount}
            onChange={(e) => setPaymentAmount(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setPaymentInvoice(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={paymentSubmitting}>
              Save Payment
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
