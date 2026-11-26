'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableEmptyState, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, AlertTriangle } from 'lucide-react';

export function PurchaseFinancialsReports({ suppliers, products }: { suppliers: any[]; products: any[] }) {
  const [subTab, setSubTab] = useState<'ledger' | 'ageing' | 'history' | 'reports'>('ageing');
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [ledgerData, setLedgerData] = useState<any>(null);
  const [ageingData, setAgeingData] = useState<any>(null);
  const [historyRows, setHistoryRows] = useState<any[]>([]);
  const [reportType, setReportType] = useState('register');
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    if (!supplierId && suppliers[0]?.id) setSupplierId(suppliers[0].id);
  }, [suppliers, supplierId]);

  useEffect(() => {
    if (subTab === 'ageing') {
      apiFetch('/purchases/outstanding', { params: { supplierId: supplierId || undefined } }).then(setAgeingData).catch(() => {});
    } else if (subTab === 'ledger' && supplierId) {
      apiFetch(`/purchases/suppliers/${supplierId}/ledger`, { params: { from, to } }).then(setLedgerData).catch(() => {});
    } else if (subTab === 'history') {
      apiFetch('/purchases/history', { params: { supplierId: supplierId || undefined, from, to } }).then(setHistoryRows).catch(() => {});
    } else if (subTab === 'reports') {
      apiFetch(`/purchases/reports/${reportType}`, { params: { from, to } }).then(setReportData).catch(() => {});
    }
  }, [subTab, supplierId, from, to, reportType]);

  const exportLedgerCsv = () => {
    if (!ledgerData?.entries) return;
    const rows = [
      ['Date', 'Document Type', 'Document #', 'Reference', 'Debit', 'Credit', 'Running Balance'].join(','),
      ...ledgerData.entries.map((e: any) =>
        [
          new Date(e.date).toISOString().slice(0, 10),
          e.documentType,
          e.documentNumber,
          `"${e.reference}"`,
          e.debit,
          e.credit,
          e.runningBalance,
        ].join(','),
      ),
    ];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supplier-ledger-${ledgerData.supplier?.name || 'export'}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 bg-surface-secondary p-1 rounded-lg border border-border text-xs">
          {[
            { id: 'ageing', label: 'Outstanding & Ageing' },
            { id: 'ledger', label: 'Supplier Ledger' },
            { id: 'history', label: 'Purchase History' },
            { id: 'reports', label: '9 Purchase Reports' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setSubTab(t.id as any)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${subTab === t.id ? 'bg-surface text-accent shadow-xs' : 'text-text-secondary'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {subTab !== 'reports' && (
            <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="w-48">
              <option value="">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          )}
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36" />
        </div>
      </div>

      {/* AGEING */}
      {subTab === 'ageing' && ageingData && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl border border-border bg-surface">
              <div className="text-[11px] text-text-tertiary">Total Outstanding</div>
              <div className="text-base font-bold font-mono mt-0.5">₹ {ageingData.totalOutstanding?.toFixed(2)}</div>
            </div>
            {Object.entries(ageingData.ageingBuckets || {}).map(([bucket, amt]: any) => (
              <div key={bucket} className="p-3 rounded-xl border border-border bg-surface">
                <div className="text-[11px] text-text-tertiary">{bucket} Days</div>
                <div className="text-sm font-semibold font-mono mt-0.5">₹ {Number(amt).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-center">Alerts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!ageingData.bills?.length ? (
                <TableEmptyState message="No outstanding supplier bills." />
              ) : (
                ageingData.bills.map((b: any) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-accent">{b.invoiceNumber}</TableCell>
                    <TableCell className="font-medium">{b.supplierName}</TableCell>
                    <TableCell className="text-xs">{new Date(b.dueDate).toLocaleDateString()}</TableCell>
                    <TableCell><Badge size="sm" variant="neutral">{b.ageingBucket}d</Badge></TableCell>
                    <TableCell className="text-right font-mono font-semibold">₹ {b.balanceAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-center">
                      {b.overdueWarning && (
                        <Badge size="sm" variant="danger"><AlertTriangle className="w-3 h-3" /> {b.daysPastDue}d overdue</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* SUPPLIER LEDGER */}
      {subTab === 'ledger' && (
        <div className="space-y-3">
          {ledgerData && (
            <>
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface text-xs">
                <div className="flex gap-6">
                  <span>Opening: <strong className="font-mono">₹ {ledgerData.openingBalance?.toFixed(2)}</strong></span>
                  <span>Closing: <strong className="font-mono text-accent">₹ {ledgerData.closingBalance?.toFixed(2)}</strong></span>
                </div>
                <Button size="sm" variant="secondary" onClick={exportLedgerCsv} icon={<Download className="w-3.5 h-3.5" />}>
                  Export CSV / Excel
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Doc #</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!ledgerData.entries?.length ? (
                    <TableEmptyState message="No ledger transactions in this period." />
                  ) : (
                    ledgerData.entries.map((e: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{new Date(e.date).toLocaleDateString()}</TableCell>
                        <TableCell><Badge size="sm" variant="neutral">{e.documentType}</Badge></TableCell>
                        <TableCell className="font-mono text-xs">{e.documentNumber}</TableCell>
                        <TableCell className="text-xs text-text-secondary">{e.reference}</TableCell>
                        <TableCell className="text-right font-mono text-xs">₹ {e.debit.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">₹ {e.credit.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-xs">₹ {e.runningBalance.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      )}

      {/* PURCHASE HISTORY */}
      {subTab === 'history' && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Landed Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {historyRows.length === 0 ? (
              <TableEmptyState message="No purchase history found." />
            ) : (
              historyRows.map((r, idx) => (
                <TableRow key={idx}>
                  <TableCell className="text-xs">{new Date(r.invoiceDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-xs text-accent">{r.invoiceNumber}</TableCell>
                  <TableCell className="text-xs font-medium">{r.supplierName}</TableCell>
                  <TableCell className="text-xs">{r.itemName}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{r.quantity}</TableCell>
                  <TableCell className="text-right font-mono text-xs">₹ {r.unitRate.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold">₹ {r.landedCost.toFixed(2)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* 9 REPORTS */}
      {subTab === 'reports' && (
        <div className="space-y-3">
          <div className="max-w-xs">
            <Select label="Select Report" value={reportType} onChange={(e) => setReportType(e.target.value)}>
              <option value="register">1. Purchase Register</option>
              <option value="by-supplier">2. Supplier-wise Purchases</option>
              <option value="by-item">3. Item-wise Purchases</option>
              <option value="pending-po">4. Pending Purchase Orders</option>
              <option value="pending-grn">5. Pending GRNs (Not Invoiced)</option>
              <option value="returns">6. Purchase Returns</option>
              <option value="tax">7. Input Tax Report</option>
              <option value="ageing">8. Supplier Ageing Report</option>
              <option value="payment-due">9. Payment Due Report</option>
            </Select>
          </div>
          <div className="p-3 rounded-xl border border-border bg-surface text-xs overflow-x-auto">
            <pre className="font-mono text-[11px] whitespace-pre-wrap">{JSON.stringify(reportData, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
