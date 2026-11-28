'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { calculatePurchaseDocument, PurchaseCalculationCharge, PurchaseCalculationLine } from '@nirvagam/shared';
import { apiFetch } from '@/lib/api';
import { formatSupplierDisplayName } from '@/lib/formatters';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Paperclip, Plus, Trash2, Upload, Download, Link2, ChevronDown, ChevronUp } from 'lucide-react';

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
  disabled,
}: {
  taxRates: any[];
  value: string;
  onChange: (value: string) => void;
  className: string;
  disabled?: boolean;
}) {
  const hasCurrentRate = taxRates.some((rate) => String(rate.rate) === value);
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={className}>
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

function formatPurchaseDate(value?: string | Date | null) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function getPurchaseOrderItemName(item: any) {
  return item.itemName ||
    [item.variant?.product?.name, item.variant?.name].filter(Boolean).join(' — ') ||
    item.description ||
    'Item';
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
  taxRate: string;
  overReceiptTolerance?: string;
  purchaseOrderItemId?: string;
  grnItemId?: string;
}

interface PurchaseDocumentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  kind: PurchaseDocKind;
  initialMode?: 'DIRECT' | 'AGAINST_PO_GRN';
  prefill?: any;
  suppliers: any[];
  products: any[];
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
  branchStateCode,
  taxRegime = 'GST',
  onSaved,
}: PurchaseDocumentDrawerProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'form' | 'attachments'>('form');
  const [submitting, setSubmitting] = useState(false);

  const [mode, setMode] = useState<'DIRECT' | 'AGAINST_PO_GRN'>(initialMode);
  const [supplierId, setSupplierId] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(0);
  const supplierListRef = useRef<HTMLDivElement>(null);
  const savedInvoiceContext = useRef<{ key: string; id: string } | null>(null);
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
  const [invoiceDocumentId, setInvoiceDocumentId] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState('');
  const [invoiceBalance, setInvoiceBalance] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'BANK_TRANSFER' | 'UPI' | 'CHEQUE'>('BANK_TRANSFER');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [linkedOrder, setLinkedOrder] = useState<any>(null);
  const [linkedGrns, setLinkedGrns] = useState<any[]>([]);
  const [loadingLinkedSources, setLoadingLinkedSources] = useState(false);

  const [deliveryDate, setDeliveryDate] = useState('');
  const [approvedPos, setApprovedPos] = useState<any[]>([]);
  const [selectedGrnPoId, setSelectedGrnPoId] = useState('');
  const [poSearch, setPoSearch] = useState('');
  const [showPoDropdown, setShowPoDropdown] = useState(false);
  const [highlightedPoIndex, setHighlightedPoIndex] = useState(0);
  const poListRef = useRef<HTMLDivElement>(null);
  const [activeProductLineIndex, setActiveProductLineIndex] = useState<number | null>(null);
  const [highlightedProductIndex, setHighlightedProductIndex] = useState(0);
  const grnProductListRef = useRef<HTMLDivElement>(null);
  const grnProductInputRefs = useRef(new Map<number, HTMLInputElement>());
  const [grnProductDropdownPosition, setGrnProductDropdownPosition] = useState<{
    left: number;
    top: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const [lines, setLines] = useState<LineState[]>([]);
  const [charges, setCharges] = useState<PurchaseCalculationCharge[]>([]);
  const [availableCharges, setAvailableCharges] = useState<any[]>([]);
  const [showChargeMenu, setShowChargeMenu] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [pendingInvoiceFile, setPendingInvoiceFile] = useState<File | null>(null);
  const [supplierMetrics, setSupplierMetrics] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [taxRatesError, setTaxRatesError] = useState('');
  const defaultTaxRate = String(taxRates.find((rate) => rate.isDefault)?.rate ?? taxRates[0]?.rate ?? 0);
  const isLinkedInvoice =
    kind === 'INVOICE' && Boolean(prefill?.purchaseOrderId || prefill?.grnIds?.length);
  const invoiceContextKey = `${kind}:${prefill?.id || ''}:${prefill?.purchaseOrderId || ''}:${(prefill?.grnIds || []).join(',')}`;
  const attachmentDocumentId = kind === 'INVOICE' ? invoiceDocumentId : prefill?.id;

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
          taxRate: Number(v.taxRate?.rate ?? 18),
        });
      }
    }
    return list;
  }, [products]);

  useEffect(() => {
    if (!isOpen) {
      savedInvoiceContext.current = null;
      return;
    }
    if (savedInvoiceContext.current?.key === invoiceContextKey) {
      setInvoiceDocumentId(savedInvoiceContext.current.id);
      return;
    }
    setActiveTab(kind === 'INVOICE' && prefill?.id ? 'attachments' : 'form');
    setMode(prefill?.mode || initialMode);
    setInvoiceDocumentId(kind === 'INVOICE' ? prefill?.id || null : null);
    setInvoiceStatus(prefill?.status || '');
    setInvoiceBalance(Number(prefill?.balanceAmount || 0));
    setPaymentAmount('');
    setPaymentMode('BANK_TRANSFER');
    setPendingInvoiceFile(null);
    setLinkedOrder(null);
    setLinkedGrns([]);
    setSelectedGrnPoId(kind === 'GRN' ? prefill?.purchaseOrderId || '' : '');
    setPoSearch('');
    setShowPoDropdown(false);
    setActiveProductLineIndex(null);
    if (kind === 'PR') {
      const initialSupId = prefill?.supplierId || '';
      setSupplierId(initialSupId);
      const initialSup = suppliers.find((s) => s.id === initialSupId);
      setSupplierSearch(formatSupplierDisplayName(initialSup));
    } else {
      setSupplierId(prefill?.supplierId || (kind === 'PO' || kind === 'GRN' ? '' : suppliers[0]?.id || ''));
      setSupplierSearch('');
    }
    setShowSupplierDropdown(false);
    setShowChargeMenu(false);
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
          orderedQuantity: kind === 'GRN' ? String(i.orderedQuantity ?? i.quantity) : undefined,
          unitRate: String(i.unitRate ?? i.unitCost ?? i.preferredRate ?? 0),
          taxRate: isLinkedInvoice || kind === 'GRN' ? '0' : String(i.taxRate ?? 18),
          purchaseOrderItemId: i.purchaseOrderItemId,
          grnItemId: i.grnItemId,
        })),
      );
    } else {
      setLines([
        {
          itemName: '',
          unit: 'PCS',
          quantity: kind === 'PR' ? '' : '1',
          unitRate: '0',
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
          const active = list.filter((po: any) => ['ORDER_PLACED', 'APPROVED', 'PENDING_APPROVAL', 'PARTIALLY_RECEIVED'].includes(po.status));
          setApprovedPos(active);
          if (prefill?.purchaseOrderId) {
            setSelectedGrnPoId(prefill.purchaseOrderId);
            const matchedPo = active.find((po: any) => po.id === prefill.purchaseOrderId);
            if (matchedPo) {
              const supplierName = formatSupplierDisplayName(matchedPo.supplier);
              setPoSearch(`${matchedPo.orderNumber}${supplierName ? ` — ${supplierName}` : ''}`);
              setSupplierId(matchedPo.supplierId);
            }
          }
        })
        .catch((err: any) => {
          setApprovedPos([]);
          toast({
            type: 'error',
            title: 'Unable to load purchase orders',
            message: err.message || 'Purchase orders could not be loaded.',
          });
        });
    }

    if (kind === 'INVOICE' && (prefill?.purchaseOrderId || prefill?.grnIds?.length)) {
      setLoadingLinkedSources(true);
      const sourceRequests: Promise<any>[] = [];
      if (prefill?.purchaseOrderId) {
        sourceRequests.push(apiFetch(`/purchases/orders/${prefill.purchaseOrderId}`));
      }
      for (const grnId of prefill?.grnIds || []) {
        sourceRequests.push(apiFetch(`/purchases/grns/${grnId}`));
      }
      Promise.all(sourceRequests)
        .then((sources) => {
          let index = 0;
          if (prefill?.purchaseOrderId) {
            setLinkedOrder(sources[index]);
            index++;
          }
          setLinkedGrns(sources.slice(index));
        })
        .catch((err: any) => {
          toast({
            type: 'error',
            title: 'Unable to load source details',
            message: err.message || 'Linked purchase order or GRN details could not be loaded.',
          });
        })
        .finally(() => setLoadingLinkedSources(false));
    }

    if (prefill?.id) {
      apiFetch(`/purchases/attachments/${kind}/${prefill.id}`).then(setAttachments).catch(() => setAttachments([]));
    } else {
      setAttachments([]);
    }
  }, [isOpen, prefill, initialMode, suppliers, variants, kind, toast, invoiceContextKey]);

  useEffect(() => {
    if (!isOpen) return;
    const firstVariant = lines[0]?.variantId;
    const searchTerm = supplierSearch.replace(/\s+\([^)]*\)$/, '').trim();
    apiFetch('/purchases/suppliers', { params: { search: searchTerm, variantId: firstVariant } })
      .then((res) => setSupplierMetrics(Array.isArray(res) ? res : []))
      .catch(() => setSupplierMetrics([]));
  }, [isOpen, supplierSearch, lines]);

  const grnSuppliers = useMemo(() => {
    const suppliersById = new Map<string, any>();
    for (const po of approvedPos) {
      if (po.supplierId && po.supplier) suppliersById.set(po.supplierId, po.supplier);
    }
    return Array.from(suppliersById.values()).sort((a, b) =>
      formatSupplierDisplayName(a).localeCompare(formatSupplierDisplayName(b)),
    );
  }, [approvedPos]);

  const selectedSupplier = useMemo(
    () =>
      (kind === 'GRN' ? grnSuppliers.find((s) => s.id === supplierId) : null) ||
      supplierMetrics.find((s) => s.id === supplierId) ||
      suppliers.find((s) => s.id === supplierId),
    [kind, grnSuppliers, supplierMetrics, suppliers, supplierId],
  );

  const matchingSuppliers = useMemo(() => {
    const list = supplierMetrics.length ? supplierMetrics : suppliers;
    const q = supplierSearch.replace(/\s+\([^)]*\)$/, '').trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (s: any) =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.companyName || '').toLowerCase().includes(q) ||
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
    const supplierFiltered = approvedPos.filter(
      (po: any) => !supplierId || po.supplierId === supplierId,
    );
    if (!q) return supplierFiltered;
    return supplierFiltered.filter((po: any) => {
      const supplierName = formatSupplierDisplayName(po.supplier);
      const label = `${po.orderNumber || ''}${supplierName ? ` — ${supplierName}` : ''}`;
      return label.toLowerCase().includes(q);
    });
  }, [approvedPos, poSearch, supplierId]);

  useEffect(() => {
    if (!showPoDropdown) return;
    const el = poListRef.current?.children[highlightedPoIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedPoIndex, showPoDropdown]);

  const availableGrnPoItems = useMemo(
    () =>
      (selectedGrnPo?.items || []).filter(
        (item: any) => Number(item.quantity) > Number(item.receivedQuantity || 0),
      ),
    [selectedGrnPo],
  );

  const selectGrnPurchaseOrder = (po: any) => {
    const supplierName = formatSupplierDisplayName(po.supplier);
    setSelectedGrnPoId(po.id);
    setPoSearch(`${po.orderNumber}${supplierName ? ` — ${supplierName}` : ''}`);
    setShowPoDropdown(false);
    setSupplierId(po.supplierId);
    setLines(
      (po.items || [])
        .map((item: any) => {
          const remaining = Math.max(0, Number(item.quantity) - Number(item.receivedQuantity || 0));
          return { item, remaining };
        })
        .filter(({ remaining }: { remaining: number }) => remaining > 0)
        .map(({ item, remaining }: { item: any; remaining: number }) => ({
          variantId: item.variantId || undefined,
          itemName: getPurchaseOrderItemName(item),
          unit: item.unit || 'PCS',
          orderedQuantity: String(remaining),
          quantity: String(remaining),
          unitRate: String(item.unitRate || 0),
          taxRate: String(item.taxRate || 0),
          purchaseOrderItemId: item.id,
        })),
    );
  };

  const selectGrnProduct = (lineIndex: number, poItem: any) => {
    const remaining = Math.max(0, Number(poItem.quantity) - Number(poItem.receivedQuantity || 0));
    setLines((current) => {
      const updated = [...current];
      const existing = updated[lineIndex];
      const isSameItem = existing?.purchaseOrderItemId === poItem.id;
      updated[lineIndex] = {
        ...existing,
        variantId: poItem.variantId || undefined,
        itemName: getPurchaseOrderItemName(poItem),
        unit: poItem.unit || 'PCS',
        orderedQuantity: String(remaining),
        quantity: isSameItem ? existing.quantity : String(remaining),
        unitRate: String(poItem.unitRate || 0),
        taxRate: String(poItem.taxRate || 0),
        purchaseOrderItemId: poItem.id,
        shortfallReason: isSameItem ? existing.shortfallReason : '',
        shortfallRemarks: isSameItem ? existing.shortfallRemarks : '',
      };
      return updated;
    });
    setActiveProductLineIndex(null);
  };

  useEffect(() => {
    if (activeProductLineIndex === null) return;
    const el = grnProductListRef.current?.children[highlightedProductIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeProductLineIndex, highlightedProductIndex]);

  useEffect(() => {
    if (activeProductLineIndex === null) {
      setGrnProductDropdownPosition(null);
      return;
    }

    const updatePosition = () => {
      const input = grnProductInputRefs.current.get(activeProductLineIndex);
      if (!input) return;

      const rect = input.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const opensAbove = spaceBelow < 120 && spaceAbove > spaceBelow;
      const availableSpace = Math.max(0, (opensAbove ? spaceAbove : spaceBelow) - 4);
      const maxHeight = Math.min(192, availableSpace);

      setGrnProductDropdownPosition({
        left: rect.left,
        top: opensAbove ? rect.top - maxHeight - 4 : rect.bottom + 4,
        width: rect.width,
        maxHeight,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [activeProductLineIndex]);

  const calculation = useMemo(() => {
    if (!lines.length) return null;
    const calcLines: PurchaseCalculationLine[] = lines.map((l, idx) => ({
      id: `${l.variantId}-${idx}`,
      quantity: l.quantity || '0',
      rate: l.unitRate || '0',
      weight: l.weight,
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

  const invoiceDiscountAmount =
    calculation?.items.reduce(
      (total, item) => total + Number(item.invoiceDiscount || 0),
      0,
    ) || 0;

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      {
        itemName: '',
        unit: units[0]?.symbol || 'PCS',
        quantity: kind === 'PR' ? '' : '1',
        unitRate: '0',
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
        const validLines = lines.filter((l) => l.purchaseOrderItemId);
        if (!validLines.length) {
          toast({ type: 'warning', title: 'No received items', message: 'Select at least one product from the purchase order and enter its received quantity.' });
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
        const grnNotes = [
          notes.trim(),
          shortfallNotes.length ? `Shortfalls:\n${shortfallNotes.join('\n')}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');
        await apiFetch('/purchases/grns', {
          method: 'POST',
          body: JSON.stringify({
            supplierId,
            purchaseOrderId: selectedGrnPo.id,
            grnDate: docDate,
            post: postImmediately,
            notes: grnNotes || undefined,
            items: validLines.map((l) => ({
              variantId: l.variantId || undefined,
              itemName: l.itemName?.trim() || undefined,
              unit: l.unit || 'PCS',
              purchaseOrderItemId: l.purchaseOrderItemId,
              quantity: l.quantity,
              unitCost: l.unitRate,
              landedCost: l.unitRate,
            })),
          }),
        });
      } else {
        if (!supplierBillNumber.trim() && !pendingInvoiceFile) {
          toast({
            type: 'warning',
            title: 'Bill # or PDF/Image required',
            message: 'Enter a Supplier Bill # or upload the supplier bill (PDF/image).',
          });
          setSubmitting(false);
          return;
        }
        const effectiveBillNumber =
          supplierBillNumber.trim() || `BILL-${Date.now().toString().slice(-6)}`;
        const savedInvoice = await apiFetch('/purchases/invoices', {
          method: 'POST',
          body: JSON.stringify({
            supplierId,
            mode,
            purchaseOrderId: prefill?.purchaseOrderId,
            grnIds: prefill?.grnIds,
            supplierBillNumber: effectiveBillNumber,
            invoiceDate: docDate,
            dueDate: dueDate || undefined,
            pricesIncludeTax,
            invoiceDiscountType,
            invoiceDiscountValue,
            roundOff: calculation?.roundOff || '0',
            post: isLinkedInvoice ? true : postImmediately,
            notes: notes || undefined,
            items: lines,
            charges,
          }),
        });
        if (pendingInvoiceFile) {
          const form = new FormData();
          form.append('file', pendingInvoiceFile);
          const token = localStorage.getItem('nirvagam_access_token');
          const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
          const uploadRes = await fetch(`${base}/purchases/attachments/INVOICE/${savedInvoice.id}`, {
            method: 'POST',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            body: form,
          });
          if (uploadRes.ok) {
            const updatedAtts = await apiFetch(`/purchases/attachments/INVOICE/${savedInvoice.id}`);
            setAttachments(Array.isArray(updatedAtts) ? updatedAtts : []);
          }
          setPendingInvoiceFile(null);
        } else {
          setAttachments([]);
        }
        const balance = Number(savedInvoice.balanceAmount ?? savedInvoice.grandTotal ?? 0);
        savedInvoiceContext.current = { key: invoiceContextKey, id: savedInvoice.id };
        setInvoiceDocumentId(savedInvoice.id);
        setInvoiceStatus(savedInvoice.status);
        setInvoiceBalance(balance);
        setPaymentAmount(balance > 0 ? balance.toFixed(2) : '');
        setActiveTab('attachments');
        toast({
          type: 'success',
          title: 'Invoice generated',
          message: 'Settle the payment below to complete.',
        });
        onSaved();
        return;
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

  const handlePostInvoice = async () => {
    if (!invoiceDocumentId) return;
    setSubmitting(true);
    try {
      const posted = await apiFetch(`/purchases/invoices/${invoiceDocumentId}/post`, { method: 'POST' });
      setInvoiceStatus(posted.status);
      setInvoiceBalance(Number(posted.balanceAmount || 0));
      setPaymentAmount(String(posted.balanceAmount || ''));
      onSaved();
      toast({ type: 'success', title: 'Invoice posted', message: 'You can now record its payment.' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to post invoice', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const handleInvoicePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceDocumentId) return;
    setPaymentSubmitting(true);
    try {
      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > invoiceBalance) {
        throw new Error('Enter a valid payment amount up to the outstanding balance.');
      }
      await apiFetch(`/purchases/invoices/${invoiceDocumentId}/payments`, {
        method: 'POST',
        body: JSON.stringify({ amount: paymentAmount, mode: paymentMode }),
      });
      const balance = Math.max(0, Number((invoiceBalance - amount).toFixed(2)));
      setInvoiceBalance(balance);
      setInvoiceStatus(balance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID');
      setPaymentAmount(balance.toFixed(2));
      onSaved();
      toast({ type: 'success', title: 'Payment recorded', message: `Payment of ₹${amount.toFixed(2)} recorded.` });
    } catch (err: any) {
      toast({ type: 'error', title: 'Payment failed', message: err.message });
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attachmentDocumentId) return;
    const form = new FormData();
    form.append('file', file);
    try {
      const token = localStorage.getItem('nirvagam_access_token');
      const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
      const res = await fetch(`${base}/purchases/attachments/${kind}/${attachmentDocumentId}`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => null);
        throw new Error(errorBody?.message || `Upload failed (${res.status})`);
      }
      const updated = await apiFetch(`/purchases/attachments/${kind}/${attachmentDocumentId}`);
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
      {attachmentDocumentId && (
        <div className="flex gap-1 mb-4 border-b border-border pb-2 text-xs">
          {!(kind === 'INVOICE' && invoiceDocumentId) && (
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded-md font-medium ${activeTab === 'form' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-secondary'}`}
            >
              Details
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('attachments')}
            className={`px-3 py-1.5 rounded-md font-medium flex items-center gap-1 ${activeTab === 'attachments' ? 'bg-accent text-white' : 'text-text-secondary hover:bg-surface-secondary'}`}
          >
            <Paperclip className="w-3.5 h-3.5" /> Attachments ({attachments.length})
          </button>
        </div>
      )}

      {activeTab === 'attachments' && attachmentDocumentId ? (
        <div className="space-y-4">
          <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors text-xs text-text-secondary">
            <Upload className="w-4 h-4" />
            <span>{kind === 'INVOICE' ? 'Upload supplier bill (PDF or image, max 25 MB)' : 'Upload PDF, Image, or Excel (max 25 MB)'}</span>
            <input
              type="file"
              accept={kind === 'INVOICE' ? '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp' : '.pdf,image/*,.xls,.xlsx'}
              className="hidden"
              onChange={handleFileUpload}
            />
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
          {kind === 'INVOICE' && (
            <div className="border-t border-border pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-text-primary">Settle Invoice Payment</h3>
              {invoiceStatus === 'DRAFT' ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-text-secondary">Post this invoice to enable payment.</p>
                  <Button type="button" onClick={handlePostInvoice} loading={submitting}>Post Invoice</Button>
                </div>
              ) : invoiceStatus === 'PAID' || invoiceBalance <= 0.01 ? (
                <p className="text-xs font-medium text-emerald-600">Invoice fully paid.</p>
              ) : ['APPROVED', 'PARTIALLY_PAID'].includes(invoiceStatus) ? (
                <form onSubmit={handleInvoicePayment} className="space-y-3">
                  <p className="text-xs text-text-secondary">
                    Outstanding balance: <strong>₹{invoiceBalance.toFixed(2)}</strong>
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Payment Amount *"
                      type="number"
                      min="0.01"
                      max={invoiceBalance}
                      step="0.01"
                      required
                      value={paymentAmount}
                      onFocus={(e) => e.currentTarget.select()}
                      onClick={(e) => e.currentTarget.select()}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                    />
                    <Select label="Payment Method" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof paymentMode)}>
                      <option value="BANK_TRANSFER">Bank Transfer</option>
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="CHEQUE">Cheque</option>
                    </Select>
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" loading={paymentSubmitting}>Record Payment</Button>
                  </div>
                </form>
              ) : (
                <p className="text-xs text-text-secondary">Post the invoice before recording payment.</p>
              )}
            </div>
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

          {isLinkedInvoice ? (
            <div className="space-y-4">
              {/* Read-only Supplier & Item Details */}
              <div className="rounded-lg border border-border bg-surface-secondary/40 p-3 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Supplier</div>
                    <div className="font-semibold text-text-primary">
                      {selectedSupplier ? formatSupplierDisplayName(selectedSupplier) : 'Selected Supplier'}
                    </div>
                    <div className="text-[11px] text-text-tertiary">
                      {[selectedSupplier?.phone, selectedSupplier?.gstin].filter(Boolean).join(' • ') || '—'}
                      {selectedSupplier ? ` • Terms: ${selectedSupplier.creditPeriodDays || 30}d` : ''}
                    </div>
                  </div>
                  {linkedOrder && (
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Purchase Order</div>
                      <div className="font-mono font-medium text-text-primary">{linkedOrder.orderNumber}</div>
                    </div>
                  )}
                </div>

                {loadingLinkedSources && (
                  <p className="text-xs text-text-secondary">Loading linked purchase details…</p>
                )}

                <div className="rounded-md border border-border overflow-hidden bg-surface">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-secondary/70 text-[10px] uppercase text-text-tertiary">
                      <tr>
                        <th className="text-left px-2.5 py-2 font-semibold">Item Name</th>
                        <th className="text-right px-2.5 py-2 font-semibold">Qty</th>
                        <th className="text-left px-2.5 py-2 font-semibold">Unit</th>
                        <th className="text-right px-2.5 py-2 font-semibold">Rate (₹)</th>
                        <th className="text-right px-2.5 py-2 font-semibold">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {lines.map((line, idx) => {
                        const calcLine = calculation?.items?.[idx];
                        return (
                          <tr key={idx}>
                            <td className="px-2.5 py-2 text-text-primary">{line.itemName || 'Item'}</td>
                            <td className="px-2.5 py-2 text-right font-mono text-text-primary">{line.quantity}</td>
                            <td className="px-2.5 py-2 font-mono text-text-secondary">{line.unit || 'PCS'}</td>
                            <td className="px-2.5 py-2 text-right font-mono text-text-primary">{Number(line.unitRate || 0).toFixed(2)}</td>
                            <td className="px-2.5 py-2 text-right font-mono font-medium text-text-primary">
                              {calcLine ? Number(calcLine.totalAmount || 0).toFixed(2) : (Number(line.quantity || 0) * Number(line.unitRate || 0)).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {calculation && (
                  <div className="space-y-1 pt-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Subtotal:</span>
                      <span className="font-mono">₹ {calculation.taxableAmount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Tax (Calculated on PO):</span>
                      <span className="font-mono text-text-tertiary">₹ {calculation.totalTax}</span>
                    </div>
                    {Number(calculation.additionalCharges || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Additional Charges:</span>
                        <span className="font-mono">₹ {calculation.additionalCharges}</span>
                      </div>
                    )}
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
              </div>

              {/* Bill Number or Upload PDF / Image */}
              <div className="space-y-3">
                <Input
                  label="Supplier Bill # (or upload PDF / image below)"
                  value={supplierBillNumber}
                  onChange={(e) => setSupplierBillNumber(e.target.value)}
                  placeholder="e.g. MILL-INV-104"
                />
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Upload Supplier Bill (PDF or Image)
                  </label>
                  {pendingInvoiceFile ? (
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-secondary/40 text-xs">
                      <span className="truncate font-medium text-text-primary">{pendingInvoiceFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setPendingInvoiceFile(null)}
                        className="text-danger hover:underline ml-2 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent transition-colors text-xs text-text-secondary">
                      <Upload className="w-4 h-4" />
                      <span>Select PDF or Image (max 25 MB)</span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setPendingInvoiceFile(file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>
          ) : (
          <>
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

          {/* Supplier and document details */}
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
                            setSupplierSearch(formatSupplierDisplayName(s));
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
                            <div className="font-medium">{formatSupplierDisplayName(s)}</div>
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
                  disabled={isLinkedInvoice || (kind === 'GRN' && Boolean(selectedGrnPoId))}
                  onChange={(e) => setSupplierId(e.target.value)}
                >
                  <option value="" disabled>Select a supplier</option>
                  {(kind === 'GRN' ? grnSuppliers : supplierMetrics.length ? supplierMetrics : suppliers).map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {formatSupplierDisplayName(s)} {s.rating ? `★${s.rating}` : ''} {s.lastPurchasePrice ? `(Last: ₹${s.lastPurchasePrice})` : ''}
                    </option>
                  ))}
                  {kind === 'GRN' && !grnSuppliers.length && (
                    <option value="" disabled>No suppliers from active purchase orders</option>
                  )}
                </Select>
                {selectedSupplier && (
                  <div className="text-[11px] text-text-tertiary mt-1 flex gap-3">
                    <span>Terms: {selectedSupplier.creditPeriodDays || 30}d</span>
                    {selectedSupplier.overCreditLimit && <span className="text-danger font-semibold">Over Credit Limit!</span>}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Input label="Document Date *" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} required />
              </div>
            </div>
          )}

          {kind === 'GRN' && (
            <section className="rounded-lg border border-border bg-surface-secondary/40 p-3 space-y-3">
              <div className="relative">
                <Input
                  label="Purchase Order *"
                  placeholder="Search purchase orders..."
                  value={poSearch}
                  onFocus={(event) => {
                    event.currentTarget.select();
                    setHighlightedPoIndex(0);
                    setShowPoDropdown(true);
                  }}
                  onBlur={() => setTimeout(() => setShowPoDropdown(false), 150)}
                  onChange={(event) => {
                    setPoSearch(event.target.value);
                    setSelectedGrnPoId('');
                    if (selectedGrnPo) setSupplierId('');
                    setLines([]);
                    setShowPoDropdown(true);
                    setHighlightedPoIndex(0);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setShowPoDropdown(true);
                      setHighlightedPoIndex((index) =>
                        matchingApprovedPos.length ? (index + 1) % matchingApprovedPos.length : 0,
                      );
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setShowPoDropdown(true);
                      setHighlightedPoIndex((index) =>
                        matchingApprovedPos.length
                          ? (index - 1 + matchingApprovedPos.length) % matchingApprovedPos.length
                          : 0,
                      );
                    } else if (
                      event.key === 'Enter' &&
                      showPoDropdown &&
                      matchingApprovedPos[highlightedPoIndex]
                    ) {
                      event.preventDefault();
                      selectGrnPurchaseOrder(matchingApprovedPos[highlightedPoIndex]);
                    } else if (event.key === 'Escape') {
                      setShowPoDropdown(false);
                    }
                  }}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={showPoDropdown}
                  aria-controls="grn-purchase-order-options"
                  required={!selectedGrnPoId}
                />
                {showPoDropdown && (
                  <div
                    id="grn-purchase-order-options"
                    ref={poListRef}
                    role="listbox"
                    className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-border bg-surface shadow-lg"
                  >
                    {matchingApprovedPos.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-text-tertiary">
                        {approvedPos.length ? 'No purchase orders match your search.' : 'No eligible purchase orders found.'}
                      </p>
                    ) : (
                      matchingApprovedPos.map((po: any, index) => (
                        <button
                          key={po.id}
                          type="button"
                          role="option"
                          aria-selected={po.id === selectedGrnPoId}
                          onMouseEnter={() => setHighlightedPoIndex(index)}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectGrnPurchaseOrder(po)}
                          className={`block w-full border-b border-border/60 px-3 py-2 text-left last:border-0 ${
                            index === highlightedPoIndex ? 'bg-accent/10' : 'hover:bg-surface-secondary'
                          }`}
                        >
                          <span className="block text-xs font-medium text-text-primary">
                            {po.orderNumber} — {formatSupplierDisplayName(po.supplier) || 'Supplier'}
                          </span>
                          <span className="block text-[10px] text-text-tertiary">
                            {formatPurchaseDate(po.orderDate)} · {po.status}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {selectedGrnPo && (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div><span className="text-text-tertiary">Order</span><div className="font-medium">{selectedGrnPo.orderNumber}</div></div>
                    <div><span className="text-text-tertiary">Supplier</span><div>{formatSupplierDisplayName(selectedGrnPo.supplier) || '—'}</div></div>
                    <div><span className="text-text-tertiary">Order date</span><div>{formatPurchaseDate(selectedGrnPo.orderDate)}</div></div>
                    <div><span className="text-text-tertiary">Expected date</span><div>{formatPurchaseDate(selectedGrnPo.expectedDate)}</div></div>
                    <div><span className="text-text-tertiary">Status</span><div>{selectedGrnPo.status}</div></div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-text-secondary">Order items and receipt progress</p>
                    <div className="grid grid-cols-12 gap-2 px-2 text-[10px] font-semibold uppercase text-text-tertiary">
                      <div className="col-span-6">Item</div>
                      <div className="col-span-2 text-right">Ordered</div>
                      <div className="col-span-2 text-right">Received</div>
                      <div className="col-span-2 text-right">Remaining</div>
                    </div>
                    {selectedGrnPo.items?.map((item: any) => {
                      const remaining = Math.max(0, Number(item.quantity) - Number(item.receivedQuantity || 0));
                      return (
                        <div key={item.id} className="grid grid-cols-12 gap-2 px-2 text-[11px] text-text-secondary">
                          <div className="col-span-6 truncate">{getPurchaseOrderItemName(item)}</div>
                          <div className="col-span-2 text-right">{item.quantity} {item.unit || ''}</div>
                          <div className="col-span-2 text-right">{item.receivedQuantity || '0'}</div>
                          <div className="col-span-2 text-right">{remaining.toFixed(3)}</div>
                        </div>
                      );
                    })}
                    {!availableGrnPoItems.length && (
                      <p className="px-2 text-[11px] text-text-tertiary">All order quantities have already been received.</p>
                    )}
                  </div>
                </div>
              )}
            </section>
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
              {!isLinkedInvoice && (
                <Button type="button" size="sm" variant="secondary" onClick={addLine} icon={<Plus className="w-3.5 h-3.5" />}>
                  Add Row
                </Button>
              )}
            </div>
            {taxRatesError && <p className="text-xs text-danger">{taxRatesError}</p>}
            <div className="space-y-2 max-h-64 overflow-x-auto overflow-y-auto pr-1">
              <datalist id="inventory-variants-list">
                {variants.map((v) => (
                  <option key={v.id} value={v.label} />
                ))}
              </datalist>
              <div className={`grid grid-cols-12 gap-1.5 px-2 text-[10px] font-semibold uppercase text-text-tertiary ${kind === 'PR' ? 'min-w-[600px]' : ''}`}>
                <div className={kind === 'PR' ? 'col-span-4' : kind === 'GRN' ? 'col-span-7' : 'col-span-3'}>
                  Item Name
                </div>
                <div className={`col-span-2 ${kind === 'PR' ? 'text-center whitespace-nowrap' : 'text-right'}`}>{kind === 'PR' ? 'Req. Qty' : 'Qty'}</div>
                <div className={`col-span-2 ${kind === 'PR' ? 'text-center whitespace-nowrap' : ''}`}>Unit</div>
                {kind === 'PR' ? (
                  <div className="col-span-3">Specs / Notes</div>
                ) : kind === 'GRN' ? null : (
                  <>
                    <div className="col-span-2 text-right">Rate (₹)</div>
                    <div className="col-span-2 text-right">Tax%</div>
                  </>
                )}
                <div className="col-span-1" />
              </div>
              {lines.map((line, idx) => {
                const activeUnitsList = units.length ? units : DEFAULT_UNITS;
                const qtyError = getQuantityError(line.quantity, line.unit, activeUnitsList);
                const search = line.itemName.trim().toLowerCase();
                const matchingGrnProducts = availableGrnPoItems.filter((item: any) => {
                  const alreadyUsed = lines.some(
                    (other, otherIndex) =>
                      otherIndex !== idx && other.purchaseOrderItemId === item.id,
                  );
                  return !alreadyUsed && getPurchaseOrderItemName(item).toLowerCase().includes(search);
                });
                return (
                <div key={idx} className={`grid grid-cols-12 gap-1.5 items-center p-2 rounded-lg border ${qtyError ? 'border-danger/60 bg-danger/5' : 'border-border bg-surface-secondary/30'} text-xs ${kind === 'PR' ? 'min-w-[600px]' : ''}`}>
                  <div className={kind === 'PR' ? 'col-span-4' : kind === 'GRN' ? 'col-span-7' : 'col-span-3'}>
                    {kind === 'GRN' ? (
                      <div className="relative">
                        <input
                          ref={(element) => {
                            if (element) {
                              grnProductInputRefs.current.set(idx, element);
                            } else {
                              grnProductInputRefs.current.delete(idx);
                            }
                          }}
                          type="text"
                          placeholder="Search order products..."
                          value={line.itemName}
                          onFocus={() => {
                            setActiveProductLineIndex(idx);
                            setHighlightedProductIndex(0);
                          }}
                          onBlur={() =>
                            setTimeout(
                              () => setActiveProductLineIndex((active) => active === idx ? null : active),
                              150,
                            )
                          }
                          onChange={(event) => {
                            const copy = [...lines];
                            copy[idx] = {
                              ...copy[idx],
                              itemName: event.target.value,
                              variantId: undefined,
                              purchaseOrderItemId: undefined,
                              orderedQuantity: undefined,
                            };
                            setLines(copy);
                            setActiveProductLineIndex(idx);
                            setHighlightedProductIndex(0);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'ArrowDown') {
                              event.preventDefault();
                              setActiveProductLineIndex(idx);
                              setHighlightedProductIndex((index) =>
                                matchingGrnProducts.length
                                  ? index < 0
                                    ? 0
                                    : (index + 1) % matchingGrnProducts.length
                                  : -1,
                              );
                            } else if (event.key === 'ArrowUp') {
                              event.preventDefault();
                              setActiveProductLineIndex(idx);
                              setHighlightedProductIndex((index) =>
                                matchingGrnProducts.length
                                  ? index <= 0
                                    ? matchingGrnProducts.length - 1
                                    : index - 1
                                  : -1,
                              );
                            } else if (
                              event.key === 'Enter' &&
                              activeProductLineIndex === idx &&
                              matchingGrnProducts.length
                            ) {
                              event.preventDefault();
                              event.stopPropagation();
                              selectGrnProduct(
                                idx,
                                matchingGrnProducts[highlightedProductIndex] || matchingGrnProducts[0],
                              );
                            } else if (event.key === 'Escape') {
                              setActiveProductLineIndex(null);
                            }
                          }}
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={activeProductLineIndex === idx}
                          aria-controls={`grn-product-options-${idx}`}
                          aria-activedescendant={
                            activeProductLineIndex === idx && highlightedProductIndex >= 0
                              ? `grn-product-option-${idx}-${highlightedProductIndex}`
                              : undefined
                          }
                          required
                          className="w-full h-8 px-2 rounded border border-border bg-surface text-xs"
                        />
                        {activeProductLineIndex === idx && grnProductDropdownPosition && typeof document !== 'undefined' &&
                          createPortal(
                            <div
                              id={`grn-product-options-${idx}`}
                              ref={grnProductListRef}
                              role="listbox"
                              className="fixed z-[60] overflow-y-auto rounded-md border border-border bg-surface shadow-lg"
                              style={{
                                left: grnProductDropdownPosition.left,
                                top: grnProductDropdownPosition.top,
                                width: grnProductDropdownPosition.width,
                                maxHeight: grnProductDropdownPosition.maxHeight,
                              }}
                            >
                                {matchingGrnProducts.length === 0 ? (
                                  <p className="px-3 py-2 text-xs text-text-tertiary">
                                    {selectedGrnPo ? 'No matching unreceived order items.' : 'Select a purchase order first.'}
                                  </p>
                                ) : (
                                  matchingGrnProducts.map((item: any, productIndex: number) => {
                                    const remaining = Math.max(0, Number(item.quantity) - Number(item.receivedQuantity || 0));
                                    return (
                                      <button
                                        key={item.id}
                                        id={`grn-product-option-${idx}-${productIndex}`}
                                        type="button"
                                        role="option"
                                        aria-selected={item.id === line.purchaseOrderItemId}
                                        onMouseEnter={() => setHighlightedProductIndex(productIndex)}
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => selectGrnProduct(idx, item)}
                                        className={`block w-full border-b border-border/60 px-3 py-2 text-left last:border-0 transition-colors ${
                                          productIndex === highlightedProductIndex
                                            ? 'bg-accent/15 text-accent font-medium'
                                            : 'text-text-primary hover:bg-surface-secondary'
                                        }`}
                                      >
                                        <span className="block text-xs font-medium">
                                          {getPurchaseOrderItemName(item)}
                                        </span>
                                        <span className="block text-[10px] text-text-tertiary">
                                          Ordered {item.quantity} · Received {item.receivedQuantity || '0'} · Remaining {remaining}
                                        </span>
                                      </button>
                                    );
                                  })
                                )}
                            </div>,
                            document.body,
                          )}
                      </div>
                    ) : (
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
                        readOnly={isLinkedInvoice}
                        className="w-full h-8 px-2 rounded border border-border bg-surface text-xs"
                      />
                    )}
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      required={kind === 'PR'}
                      placeholder="Qty"
                      value={line.quantity}
                      readOnly={isLinkedInvoice}
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
                      disabled={isLinkedInvoice}
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
                  ) : kind !== 'GRN' ? (
                    <>
                      <div className="col-span-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Rate"
                          value={line.unitRate}
                          readOnly={isLinkedInvoice}
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
                      <div className="col-span-2">
                        <TaxRateSelect
                          taxRates={taxRates}
                          value={line.taxRate}
                          disabled={isLinkedInvoice}
                          onChange={(value) => {
                            const copy = [...lines];
                            copy[idx].taxRate = value;
                            setLines(copy);
                          }}
                          className="w-full h-8 px-1 rounded border border-border bg-surface text-xs"
                        />
                      </div>
                    </>
                  ) : null}
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
                  {kind === 'GRN' &&
                    line.purchaseOrderItemId &&
                    line.orderedQuantity !== undefined &&
                    Number(line.quantity || 0) < Number(line.orderedQuantity) && (
                      <div className="col-span-12 flex items-center gap-3 px-1 pt-0.5 text-xs text-amber-600 dark:text-amber-400">
                        <span className="text-[11px] font-medium whitespace-nowrap">
                          Shortfall ({Number((Number(line.orderedQuantity) - Number(line.quantity || 0)).toFixed(3))} {line.unit}):
                        </span>
                        <div
                          role="radiogroup"
                          aria-label={`Shortfall reason for ${line.itemName}`}
                          className="flex items-center gap-3 whitespace-nowrap"
                        >
                          {[
                            { value: 'NOT_RECEIVED', label: 'Product Not Received' },
                            { value: 'DAMAGED', label: 'Damaged' },
                          ].map((option) => {
                            const selected = line.shortfallReason === option.value;
                            return (
                              <label
                                key={option.value}
                                className={`inline-flex cursor-pointer items-center gap-1.5 text-xs ${
                                  selected ? 'font-semibold' : 'font-normal opacity-85 hover:opacity-100'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={`shortfall-reason-${idx}`}
                                  value={option.value}
                                  checked={selected}
                                  required
                                  onChange={() => {
                                    const copy = [...lines];
                                    copy[idx] = {
                                      ...copy[idx],
                                      shortfallReason:
                                        option.value === 'DAMAGED' ? 'DAMAGED' : 'NOT_RECEIVED',
                                      shortfallRemarks:
                                        option.value === 'DAMAGED' ? copy[idx].shortfallRemarks : '',
                                    };
                                    setLines(copy);
                                  }}
                                  className="h-3.5 w-3.5 accent-amber-600"
                                />
                                {option.label}
                              </label>
                            );
                          })}
                        </div>
                        {line.shortfallReason === 'DAMAGED' && (
                          <input
                            type="text"
                            value={line.shortfallRemarks || ''}
                            onChange={(event) => {
                              const copy = [...lines];
                              copy[idx].shortfallRemarks = event.target.value;
                              setLines(copy);
                            }}
                            placeholder="Remarks (optional)"
                            aria-label={`Damage details for ${line.itemName}`}
                            className="h-7 min-w-36 flex-1 rounded border border-border bg-surface px-2 text-xs text-text-primary focus:border-amber-500 focus:outline-none"
                          />
                        )}
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
              <div className="flex justify-between">
                <span className="text-text-secondary">Invoice Discount:</span>
                <span className="font-mono text-danger">- ₹ {invoiceDiscountAmount.toFixed(2)}</span>
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
            <Button type="submit" variant="primary" loading={submitting}>
              {isLinkedInvoice ? 'Generate Invoice' : `Save ${kind}`}
            </Button>
          </div>
        </form>
      )}
      </div>
    </Modal>
  );
}
