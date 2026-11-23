'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { PieChart, TrendingUp, RefreshCw, Download, FileSpreadsheet } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('pl');
  const [plData, setPlData] = useState<any>(null);
  const [gstData, setGstData] = useState<any>(null);
  const [kpiData, setKpiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [plRes, gstRes, kpiRes] = await Promise.all([
        apiFetch('/accounting/profit-loss'),
        apiFetch('/reports/gst'),
        apiFetch('/reports/dashboard'),
      ]);
      setPlData(plRes);
      setGstData(gstRes);
      setKpiData(kpiRes);
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Reports & Financial Statements</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Real-time Profit & Loss statement, Balance Sheet summary, and GSTR-1/3B statutory compliance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => window.print()}
            icon={<Download className="w-3.5 h-3.5" />}
          >
            Export PDF
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'pl', label: 'Profit & Loss Statement' },
          { id: 'gst', label: 'GST Statutory Returns (GSTR-1 & 3B)' },
          { id: 'kpi', label: 'Executive Metrics' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : activeTab === 'pl' ? (
        <div className="space-y-4 max-w-3xl">
          {/* Net Profit Banner */}
          <div className="p-4 bg-surface-secondary border border-border rounded-lg flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary font-mono">
                NET OPERATING PROFIT / (LOSS)
              </p>
              <p
                className={`text-xl font-bold font-mono tracking-tight mt-1 ${
                  (plData?.netProfit || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'
                }`}
              >
                ₹ {Number(plData?.netProfit || 0).toFixed(2)}
              </p>
            </div>
            <Badge size="sm" variant="accent">FY 2026-2027</Badge>
          </div>

          {/* Revenue Breakdown */}
          <div className="p-4 bg-background border border-border rounded-lg space-y-3">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Operating Revenue (Income)
            </h3>
            <div className="divide-y divide-border text-xs font-mono">
              {plData?.incomeAccounts?.map((acc: any) => (
                <div key={acc.id} className="py-2 flex justify-between">
                  <span className="text-text-primary">{acc.code} - {acc.name}</span>
                  <span className="font-semibold text-text-primary">₹ {Number(acc.netBalance).toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-2 flex justify-between font-bold text-accent">
                <span>TOTAL REVENUE</span>
                <span>₹ {Number(plData?.totalRevenue || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="p-4 bg-background border border-border rounded-lg space-y-3">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Operating & Administrative Expenses
            </h3>
            <div className="divide-y divide-border text-xs font-mono">
              {plData?.expenseAccounts?.map((acc: any) => (
                <div key={acc.id} className="py-2 flex justify-between">
                  <span className="text-text-primary">{acc.code} - {acc.name}</span>
                  <span className="text-text-secondary">₹ {Number(acc.netBalance).toFixed(2)}</span>
                </div>
              ))}
              <div className="pt-2 flex justify-between font-bold text-red-500">
                <span>TOTAL EXPENSES</span>
                <span>₹ {Number(plData?.totalExpenses || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'gst' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* GSTR-1 Outward Supplies */}
          <div className="p-4 bg-background border border-border rounded-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                GSTR-1 Outward Supplies (Sales)
              </h3>
              <Badge size="sm" variant="accent">
                {gstData?.gstr1Summary?.totalInvoices} Invoices
              </Badge>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-text-secondary">
                <span>Total Taxable Sales:</span>
                <span className="font-semibold text-text-primary">
                  ₹ {Number(gstData?.gstr1Summary?.taxableAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Output CGST:</span>
                <span>₹ {Number(gstData?.gstr1Summary?.cgst || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Output SGST:</span>
                <span>₹ {Number(gstData?.gstr1Summary?.sgst || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Output IGST:</span>
                <span>₹ {Number(gstData?.gstr1Summary?.igst || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-accent pt-2 border-t border-border">
                <span>Total Output Tax Liability:</span>
                <span>₹ {Number(gstData?.gstr1Summary?.totalTaxLiability || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* GSTR-3B Inward Supplies */}
          <div className="p-4 bg-background border border-border rounded-lg space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                GSTR-3B Eligible Input Tax Credit (ITC)
              </h3>
              <Badge size="sm" variant="success">
                {gstData?.gstr3bSummary?.totalPurchaseBills} Bills
              </Badge>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between text-text-secondary">
                <span>Total Taxable Purchases:</span>
                <span className="font-semibold text-text-primary">
                  ₹ {Number(gstData?.gstr3bSummary?.taxableAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Input CGST Claimable:</span>
                <span className="text-emerald-500">
                  ₹ {Number(gstData?.gstr3bSummary?.eligibleItcCgst || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Input SGST Claimable:</span>
                <span className="text-emerald-500">
                  ₹ {Number(gstData?.gstr3bSummary?.eligibleItcSgst || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Input IGST Claimable:</span>
                <span className="text-emerald-500">
                  ₹ {Number(gstData?.gstr3bSummary?.eligibleItcIgst || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold text-emerald-600 dark:text-emerald-400 pt-2 border-t border-border">
                <span>Total Eligible ITC:</span>
                <span>₹ {Number(gstData?.gstr3bSummary?.totalEligibleItc || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Executive Metrics */
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 bg-background border border-border rounded-lg space-y-1">
            <p className="text-[10px] font-mono font-semibold text-text-tertiary">TOTAL SALES</p>
            <p className="text-lg font-bold font-mono text-text-primary">
              ₹ {Number(kpiData?.totalSales || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-3.5 bg-background border border-border rounded-lg space-y-1">
            <p className="text-[10px] font-mono font-semibold text-text-tertiary">TOTAL PURCHASES</p>
            <p className="text-lg font-bold font-mono text-text-primary">
              ₹ {Number(kpiData?.totalPurchases || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-3.5 bg-background border border-border rounded-lg space-y-1">
            <p className="text-[10px] font-mono font-semibold text-text-tertiary">RECEIVABLES</p>
            <p className="text-lg font-bold font-mono text-accent">
              ₹ {Number(kpiData?.totalReceivables || 0).toFixed(2)}
            </p>
          </div>
          <div className="p-3.5 bg-background border border-border rounded-lg space-y-1">
            <p className="text-[10px] font-mono font-semibold text-text-tertiary">STOCK VALUATION</p>
            <p className="text-lg font-bold font-mono text-emerald-500">
              ₹ {Number(kpiData?.stockValuation || 0).toFixed(2)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
