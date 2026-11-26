'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

interface PurchasePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'PO' | 'GRN' | 'INVOICE' | 'RETURN' | 'PAYMENT';
  documentId: string | null;
}

export function PurchasePrintModal({ isOpen, onClose, documentType, documentId }: PurchasePrintModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !documentId) return;
    setLoading(true);
    apiFetch(`/purchases/print/${documentType}/${documentId}`)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [isOpen, documentType, documentId]);

  const doc = data?.document;
  const business = data?.business;

  const titles: Record<string, string> = {
    PO: 'PURCHASE ORDER',
    GRN: 'GOODS RECEIVED NOTE (GRN)',
    INVOICE: 'PURCHASE INVOICE / VENDOR BILL',
    RETURN: 'PURCHASE RETURN / DEBIT NOTE',
    PAYMENT: 'SUPPLIER PAYMENT VOUCHER',
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Print ${titles[documentType] || documentType}`} maxWidth="2xl">
      <div className="max-h-[82vh] overflow-y-auto pr-1">
      {loading ? (
        <div className="py-12 text-center text-xs text-text-secondary">Loading printable voucher...</div>
      ) : !doc ? (
        <div className="py-12 text-center text-xs text-text-tertiary">Unable to load document for printing.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <Button size="sm" variant="primary" onClick={() => window.print()} icon={<Printer className="w-3.5 h-3.5" />}>
              Print / Save PDF
            </Button>
          </div>

          <div className="p-6 bg-white text-slate-900 border border-slate-200 rounded-lg space-y-5 text-xs">
            {/* Header with Branding */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">{business?.tradeName || business?.legalName || 'Nirvagam Business'}</h2>
                <p className="text-[11px] text-slate-600">{doc.branch?.name} — {doc.branch?.city}, {doc.branch?.state}</p>
                {business?.pan && <p className="text-[11px] font-mono text-slate-600">PAN: {business.pan}</p>}
              </div>
              <div className="text-right">
                <div className="text-xs font-bold tracking-wider text-blue-700">{titles[documentType]}</div>
                <div className="font-mono font-semibold text-sm mt-1">
                  {doc.orderNumber || doc.grnNumber || doc.invoiceNumber || doc.returnNumber || doc.paymentNumber}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Date: {new Date(doc.orderDate || doc.grnDate || doc.invoiceDate || doc.returnDate || doc.paymentDate).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Supplier Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded border border-slate-100">
              <div>
                <div className="text-[10px] font-semibold uppercase text-slate-500">Supplier</div>
                <div className="font-semibold text-slate-900">{doc.supplier?.name}</div>
                <div className="text-[11px] text-slate-600">{doc.supplier?.addressStreet}, {doc.supplier?.city}, {doc.supplier?.state}</div>
                {doc.supplier?.gstin && <div className="font-mono text-[11px] text-slate-700">GSTIN: {doc.supplier.gstin}</div>}
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase text-slate-500">Status / Reference</div>
                <div className="font-semibold">{doc.status}</div>
                {doc.supplierBillNumber && <div className="text-[11px] font-mono">Bill #: {doc.supplierBillNumber}</div>}
                {doc.mode && <div className="text-[11px]">Mode: {doc.mode}</div>}
              </div>
            </div>

            {/* Line Items */}
            {doc.items?.length > 0 && (
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-left">
                    <th className="py-1.5 px-2">#</th>
                    <th className="py-1.5 px-2">Item</th>
                    <th className="py-1.5 px-2 text-right">Qty</th>
                    <th className="py-1.5 px-2 text-right">Rate</th>
                    <th className="py-1.5 px-2 text-right">Tax %</th>
                    <th className="py-1.5 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item: any, idx: number) => (
                    <tr key={item.id} className="border-b border-slate-100">
                      <td className="py-1.5 px-2">{idx + 1}</td>
                      <td className="py-1.5 px-2 font-medium">
                        {item.itemName || item.variant?.product?.name || item.description || 'Manual Item'}
                        {item.variant?.name ? ` (${item.variant.name})` : ''}
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono">{Number(item.quantity)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">₹ {Number(item.unitRate ?? item.unitCost ?? 0).toFixed(2)}</td>
                      <td className="py-1.5 px-2 text-right font-mono">{Number(item.taxRate || 0)}%</td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold">
                        ₹ {Number(item.totalAmount ?? Number(item.quantity) * Number(item.unitCost || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Payment Allocations */}
            {doc.allocations?.length > 0 && (
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-300 bg-slate-100 text-left">
                    <th className="py-1.5 px-2">Invoice #</th>
                    <th className="py-1.5 px-2">Vendor Bill #</th>
                    <th className="py-1.5 px-2 text-right">Allocated Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.allocations.map((a: any) => (
                    <tr key={a.id} className="border-b border-slate-100">
                      <td className="py-1.5 px-2 font-mono">{a.purchaseInvoice?.invoiceNumber}</td>
                      <td className="py-1.5 px-2 font-mono">{a.purchaseInvoice?.supplierBillNumber}</td>
                      <td className="py-1.5 px-2 text-right font-mono font-semibold">₹ {Number(a.amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Totals */}
            <div className="flex justify-end pt-2 border-t border-slate-200">
              <div className="w-64 space-y-1 text-xs">
                {doc.taxableAmount !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Taxable Amount:</span>
                    <span className="font-mono">₹ {Number(doc.taxableAmount).toFixed(2)}</span>
                  </div>
                )}
                {Number(doc.totalTax || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Total Input Tax:</span>
                    <span className="font-mono">₹ {Number(doc.totalTax).toFixed(2)}</span>
                  </div>
                )}
                {Number(doc.additionalCharges || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Freight & Charges:</span>
                    <span className="font-mono">₹ {Number(doc.additionalCharges).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm border-t border-slate-300 pt-1">
                  <span>Grand Total ({doc.currencyCode || 'INR'}):</span>
                  <span className="font-mono">₹ {Number(doc.grandTotal ?? doc.totalAmount ?? doc.amount ?? 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Footer / Signature */}
            <div className="pt-8 flex justify-between items-end text-[11px] text-slate-500 border-t border-slate-100">
              <div>Generated by Nirvagam ERP</div>
              <div className="text-right">
                <div className="w-36 border-b border-slate-300 mb-1" />
                <div>Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </Modal>
  );
}
