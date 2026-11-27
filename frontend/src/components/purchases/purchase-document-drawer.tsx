'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { calculatePurchaseDocument, PurchaseCalculationCharge, PurchaseCalculationLine } from '@nirvagam/shared';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Paperclip, Plus, Trash2, Upload, Download, Clock, Link2, ChevronDown, ChevronUp } from 'lucide-react';

export type PurchaseDocKind = 'PR' | 'PO' | 'GRN' | 'INVOICE';

const DEFAULT_ADDITIONAL_CHARGES = [
  { id: 'def-1', name: 'Transportation Charges' },
  { id: 'def-2', name: 'Delivery Charges' },
  { id: 'def-3', name: 'Loading' },
  { id: 'def-4', name: 'Unloading' },
];

const DEFAULT_UNITS = [
  { symbol: 'PCS', name: 'Pieces', decimalPlaces: 0 },
  { symbol: 'BOX', name: 'Box', decimalPlaces: 0 },
  { symbol: 'KG', name: 'Kilograms', decimalPlaces: 3 },
  { symbol: 'GRAM', name: 'Gram', decimalPlaces: 2 },
  { symbol: 'LTR', name: 'Litres', decimalPlaces: 3 },
  { symbol: 'ML', name: 'Millilitres', decimalPlaces: 2 },
  { symbol: 'MTR', name: 'Metres', decimalPlaces: 2 },
  { symbol: 'FEET', name: 'Feet', decimalPlaces: 2 },
  { symbol: 'ROLL', name: 'Roll', decimalPlaces: 0 },
  { symbol: 'SET', name: 'Set', decimalPlaces: 0 },
  { symbol: 'PACK', name: 'Pack', decimalPlaces: 0 },
];

function getQuantityError(qtyStr: string, unitSymbol: string, availableUnits: any[]): string | null {
  const trimmed = qtyStr.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (Number.isNaN(num) || num < 0) {
    return 'Enter a valid positive quantity';
  }
  const unitObj =
    availableUnits.find((u) => u.symbol === unitSymbol) ||
    DEFAULT_UNITS.find((u) => u.symbol === unitSymbol);
  const maxDecimals = unitObj ? Number(unitObj.decimalPlaces ?? 0) : 0;

  if (trimmed.includes('.')) {
    if (maxDecimals === 0) {
      return `${unitSymbol} does not allow decimals (whole numbers only)`;
    }
    const frac = trimmed.split('.')[1] ?? '';
    if (frac.length > maxDecimals) {
      return `${unitSymbol} allows max ${maxDecimals} decimal ${maxDecimals === 1 ? 'place' : 'places'}`;
    }
  }
  return null;
}

function TaxRateSelect({
  taxRates,
  value,
  onChange,
  className,
}: {
  taxRates: any[];
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const hasCurrentRate = taxRates.some((rate) => String(rate.rate) === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {!taxRates.length ? (
        <>
          <option value={value}>{value}% (not configured)</option>
          {value !== '0' && <option value="0">0%</option>}
        </>
      ) : (
        !hasCurrentRate && <option value={value}>{value}% (not active)</option>
      )}
      {taxRates.map((rate) => (
        <option key={rate.id} value={String(rate.rate)}>
          {rate.name} ({Number(rate.rate)}%)
        </option>
      ))}
    </select>
  );
}

interface LineState {
  variantId?: string;
  itemName: string;
  unit: string;
  orderedQuantity?: string;
  shortfallReason?: 'NOT_RECEIVED' | 'DAMAGED' | '';
  shortfallRemarks?: string;
  description?: string;
  quantity: string;
  unitRate: string;
  weight?: string;
  discountType: 'AMOUNT' | 'PERCENT';
  discountValue: string;
  taxRate: string;
  overReceiptTolerance?: string;
  purchaseOrderItemId?: string;
  grnItemId?: string;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: string;
}

interface PurchaseDocumentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  kind: PurchaseDocKind;
  initialMode?: 'DIRECT' | 'AGAINST_PO_GRN';
  prefill?: any;
  suppliers: any[];
  products: any[];
  warehouses: any[];
  branchStateCode: string;
  taxRegime?: 'GST' | 'VAT';
  onSaved: () => void;
}

export function PurchaseDocumentDrawer({
  isOpen,
  onClose,
  kind,
  initialMode = 'DIRECT',
  prefill,
  suppliers,
  products,
  warehouses,
  branchStateCode,
  taxRegime = 'GST',
  onSaved,
}: PurchaseDocumentDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'form' | 'attachments' | 'timeline'>('form');
  const [submitting, setSubmitting] = useState(false);

  const [mode, setMode] = useState<'DIRECT' | 'AGAINST_PO_GRN'>(initialMode);
  const [supplierId, setSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(0);
  const supplierListRef = useRef<HTMLDivElement>(null);
  const [warehouseId, setWarehouseId] = useState('');
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [supplierBillNumber, setSupplierBillNumber] = useState('');
  const [department, setDepartment] = useState('');
  const [overReceiptTolerance, setOverReceiptTolerance] = useState('5');
  const [pricesIncludeTax, setPricesIncludeTax] = useState(false);
  const [invoiceDiscountType, setInvoiceDiscountType] = useState<'AMOUNT' | 'PERCENT'>('PERCENT');
  const [invoiceDiscountValue, setInvoiceDiscountValue] = useState('0');
  const [notes, setNotes] = useState('');
  const [postImmediately, setPostImmediately] = useState(true);
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);

  const [deliveryDate, setDeliveryDate] = useState('');
  const [approvedPos, setApprovedPos] = useState<any[]>([]);
  const [selectedGrnPoId, setSelectedGrnPoId] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const [highlightedPoIndex, setHighlightedPoIndex] = useState(0);
  const poListRef = useRef<HTMLDivElement>(null);

  const [lines, setLines] = useState<LineState[]>([]);
  const [charges, setCharges] = useState<PurchaseCalculationCharge[]>([]);
  const [availableCharges, setAvailableCharges] = useState<any[]>([]);
  const [showChargeMenu, setShowChargeMenu] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [supplierMetrics, setSupplierMetrics] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [taxRatesError, setTaxRatesError] = useState('');
  const defaultTaxRate = String(taxRates.find((rate) => rate.isDefault)?.rate ?? taxRates[0]?.rate ?? 0);

  useEffect(() => {
    if (isOpen) setShowTaxBreakdown(false);
  }, [isOpen, kind, prefill?.id]);

  const variants = useMemo(() => {
    const list: Array<{ id: string; label: string; purchasePrice: number; taxRate: number }> = [];
    for (const p of products) {
      for (const v of p.variants || []) {
        list.push({
          id: v.id,
          label: `${p.name} — ${v.name} (${v.sku})`,
          purchasePrice: Number(v.purchasePrice || 0),
          taxRate: Number(p.taxRate?.rate ?? 0),
        });
      }
    }
    return list;
  }, [products]);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab('form');
    setMode(prefill?.mode || initialMode);
    if (kind === 'PR') {
      const initialSupId = prefill?.supplierId || '';
      setSupplierId(initialSupId);
      const initialSup = suppliers.find((s) => s.id === initialSupId);
      setSupplierSearch(initialSup ? initialSup.name : '');
    } else {
      setSupplierId(prefill?.supplierId || (kind === 'PO' ? '' : suppliers[0]?.id || ''));
      setSupplierSearch('');
    }
    setShowSupplierDropdown(false);
    setShowChargeMenu(false);
    setDeliveryDate(
      prefill?.deliveryDate
        ? String(prefill.deliveryDate).slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    );
    setSelectedGrnPoId(prefill?.purchaseOrderId || '');
    setPoSearch(prefill?.orderNumber || '');
    setShowPoDropdown(false);
    setHighlightedPoIndex(0);
    setWarehouseId(prefill?.warehouseId || warehouses.find((w) => w.isDefault)?.id || warehouses[0]?.id || '');
    setDocDate(new Date().toISOString().slice(0, 10));
    setSupplierBillNumber(prefill?.supplierBillNumber || '');
    setDepartment(prefill?.department || '');
    setNotes(prefill?.notes || '');
    setCharges(prefill?.charges || []);

    if (prefill?.items?.length) {
      setLines(
        prefill.items.map((i: any) => ({
          variantId: i.variantId || undefined,
          itemName: i.itemName || (i.variant ? `${i.variant.product?.name || ''} — ${i.variant.name}` : i.description || ''),
          unit: i.unit || 'PCS',
          description: i.description || '',
          quantity: String(i.quantity),
          unitRate: String(i.unitRate ?? i.unitCost ?? i.preferredRate ?? 0),
          discountType: i.discountType || 'PERCENT',
          discountValue: String(i.discountValue || 0),
          taxRate: String(i.taxRate ?? 18),
          purchaseOrderItemId: i.purchaseOrderItemId,
          grnItemId: i.grnItemId,
          batchNumber: i.batchNumber || '',
          serialNumber: i.serialNumber || '',
        })),
      );
    } else {
      setLines([
        {
          itemName: '',
          unit: 'PCS',
          quantity: kind === 'PR' ? '' : '1',
          unitRate: '0',
          discountType: 'PERCENT',
          discountValue: '0',
          taxRate: '0',
        },
      ]);
    }

    apiFetch('/products/meta/units?activeOnly=true')
      .then((res) => setUnits(Array.isArray(res) ? res : []))
      .catch(() => setUnits([]));

    apiFetch('/products/meta/tax-rates?activeOnly=true')
      .then((res) => {
        const rates = Array.isArray(res) ? res : [];
        setTaxRates(rates);
        setTaxRatesError('');
        if (!prefill?.items?.length) {
          const defaultRate = String(rates.find((rate: any) => rate.isDefault)?.rate ?? rates[0]?.rate ?? 0);
          setLines((prev) => prev.map((line) => ({ ...line, taxRate: defaultRate })));
        }
      })
      .catch((err: any) => {
        setTaxRates([]);
        setTaxRatesError(err.message || 'Failed to load tax rates');
      });

    apiFetch('/purchases/additional-charges?activeOnly=true')
      .then((res) => setAvailableCharges(Array.isArray(res) ? res : []))
      .catch(() => setAvailableCharges([]));

    if (kind === 'GRN') {
      apiFetch('/purchases/orders?limit=100')
        .then((res) => {
          const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
          const active = list.filter((po: any) => ['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status));
          setApprovedPos(active);
          if (prefill?.purchaseOrderId) {
            const matchedPo = active.find((po: any) => po.id === prefill.purchaseOrderId);
            if (matchedPo) {
              setPoSearch(`${matchedPo.orderNumber}${matchedPo.supplier?.name ? ` — ${matchedPo.supplier.name}` : ''}`);
            }
          }
        })
        .catch(() => setApprovedPos([]));
    }

    if (prefill?.id) {
      apiFetch(`/purchases/attachments/${kind}/${prefill.id}`).then(setAttachments).catch(() => setAttachments([]));
      apiFetch(`/purchases/approvals/timeline/${kind}/${prefill.id}`).then(setTimeline).catch(() => setTimeline([]));
    } else {
      setAttachments([]);
      setTimeline([]);
    }
  }, [isOpen, prefill, initialMode, suppliers, warehouses, variants, kind]);

  useEffect(() => {
    if (!isOpen) return;
    const firstVariant = lines[0]?.variantId;
    apiFetch('/purchases/suppliers', { params: { search: supplierSearch, variantId: firstVariant } })
      .then((res) => setSupplierMetrics(Array.isArray(res) ? res : []))
      .catch(() => setSupplierMetrics([]));
  }, [isOpen, supplierSearch, lines]);

  const selectedSupplier = useMemo(
    () => supplierMetrics.find((s) => s.id === supplierId) || suppliers.find((s) => s.id === supplierId),
    [supplierMetrics, suppliers, supplierId],
  );

  const matchingSuppliers = useMemo(() => {
    const list = supplierMetrics.length ? supplierMetrics : suppliers;
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s: any) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.phone || '').toLowerCase().includes(q) ||
        (s.gstin || '').toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q),
    );
  }, [supplierMetrics, suppliers, supplierSearch]);

  useEffect(() => {
    if (!showSupplierDropdown) return;
    const el = supplierListRef.current?.children[highlightedSupplierIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedSupplierIndex, showSupplierDropdown]);

  const selectedGrnPo = useMemo(
    () => approvedPos.find((po) => po.id === selectedGrnPoId) || null,
    [approvedPos, selectedGrnPoId],
  );

  const matchingApprovedPos = useMemo(() => {
    const q = poSearch.trim().toLowerCase();
    if (!q) return approvedPos;
    return approvedPos.filter(
      (po: any) =>
        (po.orderNumber || '').toLowerCase().includes(q) ||
        (po.supplier?.name || '').toLowerCase().includes(q),
    );
  }, [approvedPos, poSearch]);

  useEffect(() => {
    if (!showPoDropdown) return;
    const el = poListRef.current?.children[highlightedPoIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedPoIndex, showPoDropdown]);

  const calculation = useMemo(() => {
    if (!lines.length) return null;
    const calcLines: PurchaseCalculationLine[] = lines.map((l, idx) => ({
      id: `${l.variantId}-${idx}`,
      quantity: l.quantity || '0',
      rate: l.unitRate || '0',
      weight: l.weight,
      lineDiscountType: l.discountType,
      lineDiscountValue: l.discountValue || '0',
      taxRate: l.taxRate || '0',
    }));
    const baseOptions = {
      businessStateCode: branchStateCode || '33',
      supplierStateCode: selectedSupplier?.stateCode || branchStateCode || '33',
      taxRegime,
      pricesIncludeTax: kind === 'PO' || kind === 'INVOICE' ? pricesIncludeTax : false,
      invoiceDiscountType: kind === 'PO' || kind === 'INVOICE' ? invoiceDiscountType : 'AMOUNT',
      invoiceDiscountValue: kind === 'PO' || kind === 'INVOICE' ? invoiceDiscountValue || '0' : '0',
      charges: kind === 'PO' || kind === 'INVOICE' ? charges : [],
    };
    const rawCalc = calculatePurchaseDocument(calcLines, { ...baseOptions, roundOff: '0' });
    const rawGrand = Number(rawCalc.grandTotal || 0);
    const autoRoundOff = (Math.round(rawGrand) - rawGrand).toFixed(2);
    return calculatePurchaseDocument(calcLines, { ...baseOptions, roundOff: autoRoundOff });
  }, [kind, lines, branchStateCode, selectedSupplier, taxRegime, pricesIncludeTax, invoiceDiscountType, invoiceDiscountValue, charges]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemName: '',
        unit: units[0]?.symbol || 'PCS',
        quantity: kind === 'PR' ? '' : '1',
        unitRate: '0',
        discountType: 'PERCENT',
        discountValue: '0',
        taxRate: defaultTaxRate,
      },
    ]);
  };

  const addCharge = (chargeName?: string) => {
    setCharges((prev) => [
      ...prev,
      {
        name: chargeName || 'Additional Charge',
        amount: '0',
        isTaxable: false,
        taxRate: '18',
        allocationMethod: 'VALUE',
      },
    ]);
    setShowChargeMenu(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lines.length === 0) {
      toast({ type: 'warning', title: 'No items', message: 'Add at least one line item.' });
      return;
    }

    const activeUnitsList = units.length ? units : DEFAULT_UNITS;
    for (let i = 0; i < lines.length; i++) {
      const qtyErr = getQuantityError(lines[i].quantity, lines[i].unit, activeUnitsList);
      if (qtyErr) {
        toast({
          type: 'error',
          title: `Invalid Quantity on Row ${i + 1}`,
          message: qtyErr,
        });
        return;
      }
    }

    try {
      setSubmitting(true);
      if (kind === 'PR') {
        const endpoint = prefill?.id ? `/purchases/requests/${prefill.id}` : '/purchases/requests';
        await apiFetch(endpoint, {
          method: prefill?.id ? 'PUT' : 'POST',
          body: JSON.stringify({
            supplierId: supplierId || undefined,
            requestDate: docDate,
            notes: notes || undefined,
            version: prefill?.version,
            items: lines.map((l) => ({
              variantId: l.variantId || undefined,
              itemName: l.itemName?.trim() || undefined,
              unit: l.unit || 'PCS',
              description: l.description,
              quantity: l.quantity,
              preferredRate: l.unitRate,
            })),
          }),
        });
      } else if (kind === 'PO') {
        const endpoint = prefill?.id ? `/purchases/orders/${prefill.id}` : '/purchases/orders';
        await apiFetch(endpoint, {
          method: prefill?.id ? 'PUT' : 'POST',
          body: JSON.stringify({
            supplierId,
            warehouseId: warehouseId || undefined,
            purchaseRequestId: prefill?.purchaseRequestId,
            orderDate: docDate,
            overReceiptTolerance: 5,
            pricesIncludeTax,
            invoiceDiscountType,
            invoiceDiscountValue,
            roundOff: calculation?.roundOff || '0',
            notes: notes || undefined,
            version: prefill?.version,
            items: lines,
            charges,
          }),
        });
      } else if (kind === 'GRN') {
        if (!selectedGrnPo) {
          toast({ type: 'warning', title: 'Purchase Order required', message: 'Select an approved Purchase Order.' });
          setSubmitting(false);
          return;
        }
        const validLines = lines.filter((l) => l.purchaseOrderItemId || l.itemName?.trim());
        if (!validLines.length) {
          toast({ type: 'warning', title: 'No received items', message: 'Select at least one product and enter received quantity.' });
          setSubmitting(false);
          return;
        }
        const shortfallNotes: string[] = [];
        for (let i = 0; i < validLines.length; i++) {
          const l = validLines[i];
          const ordered = l.orderedQuantity !== undefined ? Number(l.orderedQuantity) : null;
          const rec = Number(l.quantity || 0);
          if (ordered !== null && rec > ordered) {
            toast({
              type: 'error',
              title: `Invalid Received Qty on Row ${i + 1}`,
              message: `Received qty cannot exceed ordered qty (${ordered} ${l.unit}).`,
            });
            setSubmitting(false);
            return;
          }
          if (ordered !== null && rec < ordered) {
            if (!l.shortfallReason) {
              toast({
                type: 'warning',
                title: `Reason required on Row ${i + 1}`,
                message: 'Select "Product Not Received" or "Damaged" for the remaining quantity.',
              });
              setSubmitting(false);
              return;
            }
            const diff = Number((ordered - rec).toFixed(3));
            const reasonLabel = l.shortfallReason === 'DAMAGED' ? 'Damaged' : 'Product Not Received';
            const remarkPart =
              l.shortfallReason === 'DAMAGED' && l.shortfallRemarks?.trim()
                ? ` — ${l.shortfallRemarks.trim()}`
                : '';
            shortfallNotes.push(`${l.itemName}: ${reasonLabel} (${diff} ${l.unit})${remarkPart}`);
          }
        }
        await apiFetch('/purchases/grns', {
          method: 'POST',
          body: JSON.stringify({
            supplierId: selectedGrnPo.supplierId,
            warehouseId: selectedGrnPo.warehouseId || undefined,
            purchaseOrderId: selectedGrnPo.id,
            grnDate: docDate,
            deliveryDate: deliveryDate || undefined,
            post: true,
            notes: shortfallNotes.length ? shortfallNotes.join('; ') : undefined,
            items: validLines.map((l) => {
              const ordered = l.orderedQuantity !== undefined ? Number(l.orderedQuantity) : null;
              const rec = Number(l.quantity || 0);
              const rejectedQty =
                l.shortfallReason === 'DAMAGED' && ordered !== null && rec < ordered
                  ? String(Number((ordered - rec).toFixed(3)))
                  : '0';
              return {
                variantId: l.variantId || undefined,
                itemName: l.itemName?.trim() || undefined,
                unit: l.unit || 'PCS',
                purchaseOrderItemId: l.purchaseOrderItemId,
                quantity: l.quantity,
                rejectedQuantity: rejectedQty,
                unitCost: l.unitRate,
                landedCost: l.unitRate,
                taxRate: '0',
              };
            }),
          }),
        });
      } else {
        if (!supplierBillNumber.trim()) {
          toast({ type: 'warning', title: 'Missing Supplier Bill #', message: 'Enter vendor invoice/bill number.' });
          setSubmitting(false);
          return;
        }
        await apiFetch('/purchases/invoices', {
          method: 'POST',
          body: JSON.stringify({
            supplierId,
            mode,
            warehouseId: warehouseId || undefined,
            purchaseOrderId: prefill?.purchaseOrderId,
            grnIds: prefill?.grnIds,
            supplierBillNumber: supplierBillNumber.trim(),
            invoiceDate: docDate,
            dueDate: dueDate || undefined,
            pricesIncludeTax,
            invoiceDiscountType,
            invoiceDiscountValue,
            roundOff: calculation?.roundOff || '0',
            post: postImmediately,
            notes: notes || undefined,
            items: lines,
            charges,
          }),
        });
      }

      toast({ type: 'success', title: `${kind} saved`, message: 'Document recorded successfully.' });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ type: 'error', title: `Failed to save ${kind}`, message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !prefill?.id) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const token = localStorage.getItem('nirvagam_access_token');
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${base}/purchases/attachments/${kind}/${prefill.id}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) throw new Error('Upload failed');
      const updated = await apiFetch(`/purchases/attachments/${kind}/${prefill.id}`);
      setAttachments(updated);
      toast({ type: 'success', title: 'Attachment uploaded', message: file.name });
    } catch (err: any) {
      toast({ type: 'error', title: 'Upload failed', message: err.message });
    }
  };

  const titles: Record<PurchaseDocKind, string> = {
    PR: 'Purchase Request (PR)',
    PO: 'Purchase Order (PO)',
    GRN: 'Goods Received Note (GRN)',
    INVOICE: mode === 'DIRECT' ? 'Direct Purchase Invoice' : 'Purchase Invoice (Against PO/GRN)',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={titles[kind]}
      maxWidth={kind === 'PO' ? '5xl' : kind === 'PR' ? '3xl' : '2xl'}
    >
      <div className="max-h-[80vh] overflow-y-auto pr-1">
      {prefill?.id && (
        <div className="flex gap-1 mb-4 border-b border-border pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('form')}
            className={`px-3 py-1.5 rounded-md font-medium ${activeTab === 'form' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-secondary'}`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1 ${activeTab === 'attachments' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-secondary'}`}
          >
            <Paperclip className="w-3.5 h-3.5" /> Attachments ({attachments.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1 ${activeTab === 'timeline' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-secondary'}`}
          >
            <Clock className="w-3.5 h-3.5" /> Approval Timeline
          </button>
        </div>
      )}

      {activeTab === 'attachments' && prefill?.id ? (
        <div className="space-y-4">
          <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors text-xs text-text-secondary">
            <Upload className="w-4 h-4" />
            <span>Upload PDF, Image, or Excel (max 25 MB)</span>
            <input type="file" className="hidden" onChange={handleFileUpload} />
          </label>
          <div className="space-y-2">
            {attachments.map((att) => (
              <div key={att.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface text-xs">
                <div>
                  <div className="font-medium text-text-primary">{att.fileName}</div>
                  <div className="text-[11px] text-text-tertiary font-mono">{att.mimeType} • {(att.size / 1024).toFixed(1)} KB</div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/purchases/attachments/${att.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded hover:bg-surface-secondary text-accent"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch(`/purchases/attachments/${att.id}`, { method: 'DELETE' });
                      setAttachments((prev) => prev.filter((x) => x.id !== att.id));
                    }}
                    className="p-1.5 rounded hover:bg-danger/10 text-danger"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'timeline' && prefill?.id ? (
        <div className="space-y-3 text-xs">
          {timeline.length === 0 ? (
            <div className="p-6 text-center text-text-tertiary">No approval workflow triggered for this document.</div>
          ) : (
            timeline.map((req) => (
              <div key={req.id} className="p-3 rounded-lg border border-border bg-surface space-y-2">
                <div className="flex justify-between font-semibold">
                  <span>Request Level {req.currentLevel}</span>
                  <Badge size="sm" variant="accent">{req.status}</Badge>
                </div>
                {req.history?.map((h: any) => (
                  <div key={h.id} className="flex justify-between text-[11px] text-text-secondary border-t border-border/50 pt-1">
                    <span>Level {h.level}: <strong>{h.action}</strong> {h.reason ? `— ${h.reason}` : ''}</span>
                    <span className="font-mono">{new Date(h.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          {/* Linked Document Banner */}
          {(prefill?.purchaseOrderId || prefill?.purchaseRequestId || prefill?.grnIds?.length) && (
            <div className="p-2.5 rounded-lg bg-accent/10 border border-accent/25 text-xs flex items-center gap-2 text-accent">
              <Link2 className="w-4 h-4 shrink-0" />
              <span>
                Linked Traceability:
                {prefill?.purchaseRequestId ? ' From PR' : ''}
                {prefill?.purchaseOrderId ? ' From PO' : ''}
                {prefill?.grnIds?.length ? ` From ${prefill.grnIds.length} GRN(s)` : ''}
              </span>
            </div>
          )}

          {/* Invoice Mode Switcher */}
          {kind === 'INVOICE' && !prefill?.grnIds?.length && !prefill?.purchaseOrderId && (
            <div className="flex gap-2 p-1 bg-surface-secondary rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setMode('DIRECT')}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'DIRECT' ? 'bg-surface text-accent shadow-xs' : 'text-text-secondary'}`}
              >
                Direct Purchase (Stock + Accounting in 1 step)
              </button>
              <button
                type="button"
                onClick={() => setMode('AGAINST_PO_GRN')}
                className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'AGAINST_PO_GRN' ? 'bg-surface text-accent shadow-xs' : 'text-text-secondary'}`}
              >
                Against PO / GRN
              </button>
            </div>
          )}

          {kind === 'GRN' ? (
            <div className="space-y-4">
              {/* 1. Approved PO Searchable Select + 2. GRN Date + 3. Delivery Date */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative">
                  <Input
                    label="Approved Purchase Order *"
                    placeholder="Search PO # or supplier..."
                    value={poSearch}
                    suffixIcon={
                      selectedGrnPoId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedGrnPoId('');
                            setPoSearch('');
                            setShowPoDropdown(true);
                            setHighlightedPoIndex(0);
                          }}
                          className="p-0.5 text-xs text-text-tertiary hover:text-text-primary leading-none"
                          title="Clear PO"
                        >
                          ✕
                        </button>
                      ) : undefined
                    }
                    onFocus={() => {
                      setHighlightedPoIndex(0);
                      setShowPoDropdown(true);
                    }}
                    onBlur={() => setTimeout(() => setShowPoDropdown(false), 150)}
                    onChange={(e) => {
                      setPoSearch(e.target.value);
                      setSelectedGrnPoId('');
                      setHighlightedPoIndex(0);
                      setShowPoDropdown(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setShowPoDropdown(true);
                        setHighlightedPoIndex((prev) =>
                          matchingApprovedPos.length ? (prev + 1) % matchingApprovedPos.length : 0,
                        );
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setShowPoDropdown(true);
                        setHighlightedPoIndex((prev) =>
                          matchingApprovedPos.length
                            ? (prev - 1 + matchingApprovedPos.length) % matchingApprovedPos.length
                            : 0,
                        );
                      } else if (e.key === 'Enter' && showPoDropdown && matchingApprovedPos[highlightedPoIndex]) {
                        e.preventDefault();
                        e.stopPropagation();
                        const chosen = matchingApprovedPos[highlightedPoIndex];
                        setSelectedGrnPoId(chosen.id);
                        setPoSearch(`${chosen.orderNumber}${chosen.supplier?.name ? ` — ${chosen.supplier.name}` : ''}`);
                        setShowPoDropdown(false);
                        setLines([{ itemName: '', unit: 'PCS', quantity: '', unitRate: '0', discountType: 'PERCENT', discountValue: '0', taxRate: '0' }]);
                      } else if (e.key === 'Escape') {
                        setShowPoDropdown(false);
                      }
                    }}
                  />
                  {showPoDropdown && (
                    <div
                      ref={poListRef}
                      className="absolute z-30 left-0 right-0 mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg divide-y divide-border/50"
                    >
                      {matchingApprovedPos.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-text-tertiary">No active approved POs found</div>
                      ) : (
                        matchingApprovedPos.map((po: any, idx: number) => (
                          <button
                            key={po.id}
                            type="button"
                            onMouseEnter={() => setHighlightedPoIndex(idx)}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setSelectedGrnPoId(po.id);
                              setPoSearch(`${po.orderNumber}${po.supplier?.name ? ` — ${po.supplier.name}` : ''}`);
                              setShowPoDropdown(false);
                              setLines([{ itemName: '', unit: 'PCS', quantity: '', unitRate: '0', discountType: 'PERCENT', discountValue: '0', taxRate: '0' }]);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between ${
                              idx === highlightedPoIndex
                                ? 'bg-accent/15 text-accent font-medium'
                                : po.id === selectedGrnPoId
                                ? 'bg-accent/10 text-accent font-medium'
                                : 'text-text-primary hover:bg-surface-secondary'
                            }`}
                          >
                            <div>
                              <div className="font-mono font-semibold">{po.orderNumber}</div>
                              <div className="text-[10px] text-text-tertiary">
                                {po.supplier?.name || 'Supplier'} • {new Date(po.orderDate).toLocaleDateString()}
                              </div>
                            </div>
                            <Badge size="sm" variant="accent">{po.status}</Badge>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Input label="GRN Date *" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} required />
                <Input label="Delivery Date" type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
              </div>

              {/* 4. Ordered Details (Non-editable: Item Name, Qty, Unit only) */}
              {selectedGrnPo && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-text-primary">Ordered Details</div>
                  <div className="rounded-lg border border-border overflow-hidden bg-surface-secondary/30">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-secondary/70 text-[10px] uppercase text-text-tertiary">
                        <tr>
                          <th className="text-left px-3 py-2 font-semibold">Item Name</th>
                          <th className="text-right px-3 py-2 font-semibold">Qty</th>
                          <th className="text-left px-3 py-2 font-semibold">Unit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {(selectedGrnPo.items || []).map((item: any) => {
                          const label =
                            item.itemName ||
                            (item.variant ? `${item.variant.product?.name || ''} — ${item.variant.name}` : 'Item');
                          return (
                            <tr key={item.id}>
                              <td className="px-3 py-2 text-text-primary">{label}</td>
                              <td className="px-3 py-2 text-right font-mono text-text-primary">{item.quantity}</td>
                              <td className="px-3 py-2 font-mono text-text-secondary">{item.unit || 'PCS'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 5. Received Quantity (Product combobox + Received Qty + auto Unit) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">Received Quantity</span>
                  <Button type="button" size="sm" variant="secondary" onClick={addLine} icon={<Plus className="w-3.5 h-3.5" />}>
                    Add Row
                  </Button>
                </div>
                <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-semibold uppercase text-text-tertiary">
                  <div className="col-span-6">Product</div>
                  <div className="col-span-3 text-right">Received Qty</div>
                  <div className="col-span-2">Unit</div>
                  <div className="col-span-1" />
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {lines.map((line, idx) => {
                    const activeUnitsList = units.length ? units : DEFAULT_UNITS;
                    const qtyError = getQuantityError(line.quantity, line.unit, activeUnitsList);
                    const poItems = selectedGrnPo?.items || [];
                    const orderedQty = line.orderedQuantity !== undefined ? Number(line.orderedQuantity) : null;
                    const trimmedQty = line.quantity.trim();
                    const recQty = Number(trimmedQty);
                    const hasExceeded =
                      orderedQty !== null && trimmedQty !== '' && !Number.isNaN(recQty) && recQty > orderedQty;
                    const isShortfall =
                      orderedQty !== null &&
                      trimmedQty !== '' &&
                      !Number.isNaN(recQty) &&
                      recQty >= 0 &&
                      recQty < orderedQty;
                    const rowError = hasExceeded
                      ? `Received qty cannot exceed ordered qty (${orderedQty} ${line.unit})`
                      : qtyError;
                    return (
                      <div
                        key={idx}
                        className={`grid grid-cols-12 gap-2 items-center p-2 rounded-lg border ${
                          rowError ? 'border-danger/60 bg-danger/5' : 'border-border bg-surface-secondary/30'
                        } text-xs`}
                      >
                        <div className="col-span-6">
                          <select
                            value={line.purchaseOrderItemId || ''}
                            disabled={!selectedGrnPo}
                            onChange={(e) => {
                              const poItemId = e.target.value;
                              const poItem = poItems.find((p: any) => p.id === poItemId);
                              const copy = [...lines];
                              if (poItem) {
                                const label =
                                  poItem.itemName ||
                                  (poItem.variant ? `${poItem.variant.product?.name || ''} — ${poItem.variant.name}` : 'Item');
                                copy[idx] = {
                                  ...copy[idx],
                                  purchaseOrderItemId: poItem.id,
                                  variantId: poItem.variantId || undefined,
                                  itemName: label,
                                  unit: poItem.unit || 'PCS',
                                  orderedQuantity: String(poItem.quantity ?? 0),
                                  shortfallReason: '',
                                  shortfallRemarks: '',
                                  unitRate: String(poItem.unitRate ?? 0),
                                  taxRate: '0',
                                };
                              } else {
                                copy[idx] = {
                                  ...copy[idx],
                                  purchaseOrderItemId: undefined,
                                  variantId: undefined,
                                  itemName: '',
                                  unit: 'PCS',
                                  orderedQuantity: undefined,
                                  shortfallReason: '',
                                  shortfallRemarks: '',
                                };
                              }
                              setLines(copy);
                            }}
                            className="w-full h-8 px-2 rounded border border-border bg-surface text-xs"
                          >
                            <option value="">
                              {selectedGrnPo ? 'Select product from PO...' : 'Select an approved PO first'}
                            </option>
                            {poItems.map((p: any) => {
                              const label =
                                p.itemName ||
                                (p.variant ? `${p.variant.product?.name || ''} — ${p.variant.name}` : 'Item');
                              return (
                                <option key={p.id} value={p.id}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="col-span-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="Qty"
                            value={line.quantity}
                            onFocus={(e) => e.currentTarget.select()}
                            onClick={(e) => e.currentTarget.select()}
                            onChange={(e) => {
                              const copy = [...lines];
                              copy[idx].quantity = e.target.value;
                              setLines(copy);
                            }}
                            className={`w-full h-8 px-2 rounded border bg-surface text-right font-mono text-xs ${
                              rowError ? 'border-danger text-danger focus:outline-none focus:ring-1 focus:ring-danger' : 'border-border'
                            }`}
                          />
                        </div>
                        <div className="col-span-2">
                          <div className="h-8 px-2 rounded border border-border bg-surface-secondary/60 flex items-center font-mono text-xs text-text-secondary">
                            {line.unit || 'PCS'}
                          </div>
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-danger p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {rowError && (
                          <div className="col-span-12 text-[11px] font-medium text-danger px-1 pt-0.5">
                            {rowError}
                          </div>
                        )}
                        {!rowError && isShortfall && (
                          <div className="col-span-12 pt-1.5 border-t border-border/50 flex flex-wrap items-center gap-3">
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              Shortfall ({Number((orderedQty! - recQty).toFixed(3))} {line.unit}):
                            </span>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name={`shortfall-${idx}`}
                                checked={line.shortfallReason === 'NOT_RECEIVED'}
                                onChange={() => {
                                  const copy = [...lines];
                                  copy[idx].shortfallReason = 'NOT_RECEIVED';
                                  copy[idx].shortfallRemarks = '';
                                  setLines(copy);
                                }}
                              />
                              Product Not Received
                            </label>
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input
                                type="radio"
                                name={`shortfall-${idx}`}
                                checked={line.shortfallReason === 'DAMAGED'}
                                onChange={() => {
                                  const copy = [...lines];
                                  copy[idx].shortfallReason = 'DAMAGED';
                                  setLines(copy);
                                }}
                              />
                              Damaged
                            </label>
                            {line.shortfallReason === 'DAMAGED' && (
                              <input
                                type="text"
                                placeholder="Remarks (optional)..."
                                value={line.shortfallRemarks || ''}
                                onChange={(e) => {
                                  const copy = [...lines];
                                  copy[idx].shortfallRemarks = e.target.value;
                                  setLines(copy);
                                }}
                                className="flex-1 min-w-[180px] h-7 px-2 rounded border border-border bg-surface text-xs"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
          <>
          {/* Supplier & Warehouse */}
          {kind === 'PR' ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <Input
                  label="Supplier (Optional)"
                  placeholder="Type to search supplier..."
                  value={supplierSearch}
                  suffixIcon={
                    supplierId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierId('');
                          setSupplierSearch('');
                          setShowSupplierDropdown(false);
                        }}
                        className="p-0.5 text-xs text-text-tertiary hover:text-text-primary leading-none"
                        title="Clear supplier"
                      >
                        ✕
                      </button>
                    ) : undefined
                  }
                  onFocus={() => {
                    if (supplierSearch.trim().length > 0 && !supplierId) {
                      setHighlightedSupplierIndex(0);
                      setShowSupplierDropdown(true);
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 150)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSupplierSearch(val);
                    setSupplierId('');
                    setHighlightedSupplierIndex(0);
                    setShowSupplierDropdown(val.trim().length > 0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      if (supplierSearch.trim().length === 0) return;
                      e.preventDefault();
                      setShowSupplierDropdown(true);
                      setHighlightedSupplierIndex((prev) =>
                        matchingSuppliers.length ? (prev + 1) % matchingSuppliers.length : 0,
                      );
                    } else if (e.key === 'ArrowUp') {
                      if (supplierSearch.trim().length === 0) return;
                      e.preventDefault();
                      setShowSupplierDropdown(true);
                      setHighlightedSupplierIndex((prev) =>
                        matchingSuppliers.length
                          ? (prev - 1 + matchingSuppliers.length) % matchingSuppliers.length
                          : 0,
                      );
                    } else if (
                      e.key === 'Enter' &&
                      showSupplierDropdown &&
                      supplierSearch.trim().length > 0 &&
                      matchingSuppliers[highlightedSupplierIndex]
                    ) {
                      e.preventDefault();
                      e.stopPropagation();
                      const chosen = matchingSuppliers[highlightedSupplierIndex];
                      setSupplierId(chosen.id);
                      setSupplierSearch(chosen.name);
                      setShowSupplierDropdown(false);
                    } else if (e.key === 'Escape') {
                      setShowSupplierDropdown(false);
                    }
                  }}
                />
                {showSupplierDropdown && supplierSearch.trim().length > 0 && (
                  <div
                    ref={supplierListRef}
                    className="absolute z-30 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg divide-y divide-border/50"
                  >
                    {matchingSuppliers.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-text-tertiary">No matching suppliers found</div>
                    ) : (
                      matchingSuppliers.map((s: any, idx: number) => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseEnter={() => setHighlightedSupplierIndex(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSupplierId(s.id);
                            setSupplierSearch(s.name);
                            setShowSupplierDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between ${
                            idx === highlightedSupplierIndex
                              ? 'bg-accent/15 text-accent font-medium'
                              : s.id === supplierId
                              ? 'bg-accent/10 text-accent font-medium'
                              : 'text-text-primary hover:bg-surface-secondary'
                          }`}
                        >
                          <div>
                            <div className="font-medium">{s.name}</div>
                            <div className="text-[10px] text-text-tertiary">
                              {[s.phone, s.gstin].filter(Boolean).join(' • ') || 'No contact/GSTIN'}
                            </div>
                          </div>
                          {s.rating ? <span className="text-[11px] font-mono text-amber-500">★ {s.rating}</span> : null}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Input label="Request Date *" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} required />
              <Input label="Notes (Optional)" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal requirement notes..." />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Select
                  label="Supplier *"
                  value={supplierId}
                  required
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="" disabled>Select a supplier</option>
                  {(supplierMetrics.length ? supplierMetrics : suppliers).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.rating ? `★${s.rating}` : ''} {s.lastPurchasePrice ? `(Last: ₹${s.lastPurchasePrice})` : ''}
                    </option>
                  ))}
                </Select>
                {selectedSupplier && (
                  <div className="text-[11px] text-text-tertiary mt-1 flex gap-3">
                    <span>Terms: {selectedSupplier.creditPeriodDays || 30}d</span>
                    {selectedSupplier.overCreditLimit && <span className="text-danger font-semibold">Over Credit Limit!</span>}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Select label="Receiving Warehouse (Optional)" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                  <option value="">None / Not Specified</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
                  ))}
                </Select>
                <Input label="Document Date *" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} required />
              </div>
            </div>
          )}

          {kind === 'INVOICE' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Input
              label="Supplier Bill # *"
              value={supplierBillNumber}
              onChange={(e) => setSupplierBillNumber(e.target.value)}
              placeholder="e.g. MILL-INV-104"
              required
            />
            <Input label="Due Date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <label className="flex items-center gap-2 text-xs font-medium text-text-primary pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={postImmediately}
                onChange={(e) => setPostImmediately(e.target.checked)}
                className="rounded border-border"
              />
              Post Immediately
            </label>
          </div>
          )}

          {/* Item Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">Line Items</span>
              <Button type="button" size="sm" variant="secondary" onClick={addLine} icon={<Plus className="w-3.5 h-3.5" />}>
                Add Row
              </Button>
            </div>
            {taxRatesError && <p className="text-xs text-danger">{taxRatesError}</p>}
            <div className="space-y-2 max-h-64 overflow-x-auto overflow-y-auto pr-1">
              <datalist id="inventory-variants-list">
                {variants.map((v) => (
                  <option key={v.id} value={v.label} />
                ))}
              </datalist>
              <div className={`grid grid-cols-12 gap-1.5 px-2 text-[10px] font-semibold uppercase text-text-tertiary ${kind === 'PR' ? 'min-w-[600px]' : ''}`}>
                <div className={kind === 'PR' ? 'col-span-4' : 'col-span-3'}>
                  Item Name
                </div>
                <div className={`col-span-2 ${kind === 'PR' ? 'text-center whitespace-nowrap' : 'text-right'}`}>{kind === 'PR' ? 'Req. Qty' : 'Qty'}</div>
                <div className={`col-span-2 ${kind === 'PR' ? 'text-center whitespace-nowrap' : ''}`}>Unit</div>
                {kind === 'PR' ? (
                  <div className="col-span-3">Specs / Notes</div>
                ) : (
                  <>
                    <div className="col-span-2 text-right">Rate (₹)</div>
                    <div className="col-span-1 text-right">Disc %</div>
                    <div className="col-span-1 text-right">Tax%</div>
                  </>
                )}
                <div className="col-span-1" />
              </div>
              {lines.map((line, idx) => {
                const activeUnitsList = units.length ? units : DEFAULT_UNITS;
                const qtyError = getQuantityError(line.quantity, line.unit, activeUnitsList);
                return (
                <div key={idx} className={`grid grid-cols-12 gap-1.5 items-center p-2 rounded-lg border ${qtyError ? 'border-danger/60 bg-danger/5' : 'border-border bg-surface-secondary/30'} text-xs ${kind === 'PR' ? 'min-w-[600px]' : ''}`}>
                  <div className={kind === 'PR' ? 'col-span-4' : 'col-span-3'}>
                    <input
                      type="text"
                      list="inventory-variants-list"
                      placeholder="Enter item name..."
                      value={line.itemName}
                      onChange={(e) => {
                        const val = e.target.value;
                        const matched = variants.find((x) => x.label === val);
                        const copy = [...lines];
                        copy[idx] = {
                          ...copy[idx],
                          itemName: val,
                          variantId: matched ? matched.id : undefined,
                          unitRate: matched ? String(matched.purchasePrice) : copy[idx].unitRate,
                          taxRate: matched
                            ? taxRates.some((rate) => String(rate.rate) === String(matched.taxRate))
                              ? String(matched.taxRate)
                              : defaultTaxRate
                            : copy[idx].taxRate,
                        };
                        setLines(copy);
                      }}
                      required
                      className="w-full h-8 px-2 rounded border border-border bg-surface text-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      required={kind === 'PR'}
                      placeholder="Qty"
                      value={line.quantity}
                      onFocus={(e) => {
                        e.currentTarget.select();
                      }}
                      onClick={(e) => {
                        e.currentTarget.select();
                      }}
                      onChange={(e) => {
                        const copy = [...lines];
                        copy[idx].quantity = e.target.value;
                        setLines(copy);
                      }}
                      className={`w-full h-8 px-2 rounded border bg-surface text-right font-mono text-xs ${
                        qtyError ? 'border-danger text-danger focus:outline-none focus:ring-1 focus:ring-danger' : 'border-border'
                      }`}
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={line.unit}
                      onChange={(e) => {
                        const copy = [...lines];
                        copy[idx].unit = e.target.value;
                        setLines(copy);
                      }}
                      className="w-full h-8 px-1.5 rounded border border-border bg-surface text-xs font-mono"
                    >
                      {activeUnitsList.map((u: any) => (
                        <option key={u.symbol} value={u.symbol}>
                          {u.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                  {kind === 'PR' ? (
                    <div className="col-span-3">
                      <input
                        type="text"
                        placeholder="Specs, size, notes..."
                        value={line.description || ''}
                        onChange={(e) => {
                          const copy = [...lines];
                          copy[idx].description = e.target.value;
                          setLines(copy);
                        }}
                        className="w-full h-8 px-2 rounded border border-border bg-surface text-xs"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Rate"
                          value={line.unitRate}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[idx].unitRate = e.target.value;
                            setLines(copy);
                          }}
                          className="w-full h-8 px-2 rounded border border-border bg-surface text-right font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Disc%"
                          value={line.discountValue}
                          onFocus={(e) => e.currentTarget.select()}
                          onClick={(e) => e.currentTarget.select()}
                          onChange={(e) => {
                            const copy = [...lines];
                            copy[idx].discountValue = e.target.value;
                            setLines(copy);
                          }}
                          className="w-full h-8 px-1 rounded border border-border bg-surface text-right font-mono text-xs"
                        />
                      </div>
                      <div className="col-span-1">
                        <TaxRateSelect
                          taxRates={taxRates}
                          value={line.taxRate}
                          onChange={(value) => {
                            const copy = [...lines];
                            copy[idx].taxRate = value;
                            setLines(copy);
                          }}
                          className="w-full h-8 px-1 rounded border border-border bg-surface text-xs"
                        />
                      </div>
                    </>
                  )}
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => setLines(lines.filter((_, i) => i !== idx))} className="text-danger p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {qtyError && (
                    <div className="col-span-12 text-[11px] font-medium text-danger px-1 pt-0.5">
                      {qtyError}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* Additional Charges */}
          {(kind === 'PO' || kind === 'INVOICE') && (
            <div className="space-y-2 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">Additional Charges</span>
                <div className="relative">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowChargeMenu((prev) => !prev)}
                    icon={<Plus className="w-3 h-3" />}
                  >
                    Add Charge
                  </Button>
                  {showChargeMenu && (
                    <div className="absolute right-0 mt-1 w-56 z-30 rounded-lg border border-border bg-surface shadow-lg py-1 divide-y divide-border/50">
                      {(availableCharges.length ? availableCharges : DEFAULT_ADDITIONAL_CHARGES).map((charge: any) => (
                        <button
                          key={charge.id || charge.name}
                          type="button"
                          onClick={() => addCharge(charge.name)}
                          className="w-full text-left px-3 py-2 text-xs text-text-primary hover:bg-surface-secondary"
                        >
                          {charge.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {charges.map((ch, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-1.5 items-center text-xs">
                  <input
                    value={ch.name}
                    onChange={(e) => {
                      const copy = [...charges];
                      copy[idx].name = e.target.value;
                      setCharges(copy);
                    }}
                    className={`${kind === 'PO' ? 'col-span-7' : 'col-span-5'} h-8 px-2 rounded border border-border bg-surface`}
                    placeholder="Charge Name"
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={ch.amount}
                    onFocus={(e) => e.currentTarget.select()}
                    onClick={(e) => e.currentTarget.select()}
                    onChange={(e) => {
                      const copy = [...charges];
                      copy[idx].amount = e.target.value;
                      setCharges(copy);
                    }}
                    className={`${kind === 'PO' ? 'col-span-4' : 'col-span-3'} h-8 px-2 rounded border border-border bg-surface text-right font-mono`}
                    placeholder="Amt"
                  />
                  {kind !== 'PO' && (
                    <select
                      value={ch.allocationMethod || 'VALUE'}
                      onChange={(e) => {
                        const copy = [...charges];
                        copy[idx].allocationMethod = e.target.value as any;
                        setCharges(copy);
                      }}
                      className="col-span-3 h-8 px-2 rounded border border-border bg-surface"
                    >
                      <option value="VALUE">By Value</option>
                      <option value="QUANTITY">By Qty</option>
                      <option value="WEIGHT">By Weight</option>
                    </select>
                  )}
                  <button type="button" onClick={() => setCharges(charges.filter((_, i) => i !== idx))} className="col-span-1 text-danger flex justify-center">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Select
                  label="Inv. Discount Type"
                  value={invoiceDiscountType}
                  onChange={(e) => setInvoiceDiscountType(e.target.value as any)}
                >
                  <option value="PERCENT">Percent (%)</option>
                  <option value="AMOUNT">Flat (₹)</option>
                </Select>
                <Input
                  label={invoiceDiscountType === 'PERCENT' ? 'Inv. Discount (%)' : 'Inv. Discount (₹)'}
                  type="number"
                  step="0.01"
                  value={invoiceDiscountValue}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.currentTarget.select()}
                  onChange={(e) => setInvoiceDiscountValue(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" checked={pricesIncludeTax} onChange={(e) => setPricesIncludeTax(e.target.checked)} />
                Rates are Tax-Inclusive
              </label>
            </div>
          )}

          {/* Live Totals & Tax Summary (only on PO & Invoice where supplier price/GST applies) */}
          {(kind === 'PO' || kind === 'INVOICE') && calculation && (
            <div className="p-3.5 rounded-xl bg-surface-secondary/50 border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Taxable Amount:</span>
                <span className="font-mono">₹ {calculation.taxableAmount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">
                  Tax ({calculation.taxRegime} {calculation.isInterState ? 'IGST' : 'CGST+SGST'}):
                </span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400">₹ {calculation.totalTax}</span>
              </div>
              <button
                type="button"
                aria-expanded={showTaxBreakdown}
                aria-controls="purchase-tax-breakdown"
                onClick={() => setShowTaxBreakdown((visible) => !visible)}
                className="flex items-center gap-1 text-[11px] text-text-secondary hover:text-text-primary"
              >
                {showTaxBreakdown ? (
                  <ChevronUp className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
                Tax breakdown
              </button>
              {showTaxBreakdown && (
                <div id="purchase-tax-breakdown" className="space-y-1 border-l border-border pl-3 text-[11px]">
                  {calculation.taxRegime === 'GST' ? (
                    calculation.isInterState ? (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">IGST:</span>
                        <span className="font-mono">₹ {calculation.igstAmount}</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">CGST:</span>
                          <span className="font-mono">₹ {calculation.cgstAmount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">SGST:</span>
                          <span className="font-mono">₹ {calculation.sgstAmount}</span>
                        </div>
                      </>
                    )
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">VAT:</span>
                      <span className="font-mono">₹ {calculation.vatAmount}</span>
                    </div>
                  )}
                  {calculation.taxSummary.map((tax, index) => (
                    <div key={`${tax.rate}-${index}`} className="flex justify-between gap-3">
                      <span className="text-text-secondary">
                        {calculation.taxRegime} {tax.rate}% — taxable ₹ {tax.taxable}:
                      </span>
                      <span className="font-mono">₹ {tax.tax}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">Additional Charges:</span>
                <span className="font-mono">₹ {calculation.additionalCharges}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Round Off (Auto):</span>
                <span className="font-mono">₹ {calculation.roundOff}</span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-border pt-2">
                <span>Grand Total:</span>
                <span className="font-mono">₹ {calculation.grandTotal}</span>
              </div>
            </div>
          )}

          </>
          )}

          <div className="pt-3 flex justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={submitting}>Save {kind}</Button>
          </div>
        </form>
      )}
      </div>
    </Modal>
  );
}
