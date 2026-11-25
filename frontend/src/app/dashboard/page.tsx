'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building,
  Clock,
  CreditCard,
  Package,
  Plus,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DashboardInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  status: string;
  customerName: string;
}

interface DashboardData {
  salesMtd: number;
  totalReceivables: number;
  liquidCashAndBank: number;
  stockValuation: number;
  invoicesCount: number;
  purchaseCount: number;
  customerCount: number;
  supplierCount: number;
  recentInvoices: DashboardInvoice[];
}

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
});

function formatCurrency(value: number) {
  return currencyFormatter.format(Number(value) || 0);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'PAID') return 'success';
  if (status === 'UNPAID' || status === 'PARTIALLY_PAID') return 'warning';
  if (status === 'OVERDUE' || status === 'CANCELLED') return 'danger';
  return 'neutral';
}

export default function DashboardPage() {
  const { user, tenant, activeBusiness } = useAuth();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<DashboardData>('/reports/dashboard');
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tenant dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const kpis = dashboard
    ? [
        {
          title: 'TOTAL SALES (MTD)',
          value: formatCurrency(dashboard.salesMtd),
          detail: 'Current calendar month',
          icon: TrendingUp,
        },
        {
          title: 'ACCOUNTS RECEIVABLE',
          value: formatCurrency(dashboard.totalReceivables),
          detail: `${dashboard.customerCount} customers`,
          icon: CreditCard,
        },
        {
          title: 'CASH & BANK BALANCE',
          value: formatCurrency(dashboard.liquidCashAndBank),
          detail: 'From this workspace ledger',
          icon: Wallet,
        },
        {
          title: 'INVENTORY VALUATION',
          value: formatCurrency(dashboard.stockValuation),
          detail: 'Current branch stock',
          icon: Package,
        },
      ]
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-surface-secondary p-4 shadow-subtle sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            Welcome, {user?.firstName} {user?.lastName}
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Business: <span className="font-medium text-text-primary">
              {activeBusiness?.legalName || tenant?.name || 'Your workspace'}
            </span>
            {' · '}Branch: <span className="font-mono text-text-secondary">
              {activeBusiness?.branchName || 'No branch assigned'}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings/users">
            <Button size="sm" variant="secondary" icon={<Users className="h-3.5 w-3.5" />}>
              Team Members
            </Button>
          </Link>
          <Link href="/settings/business">
            <Button size="sm" variant="secondary" icon={<Building className="h-3.5 w-3.5" />}>
              Configure Entity
            </Button>
          </Link>
          <Link href="/sales">
            <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
              New Tax Invoice
            </Button>
          </Link>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 sm:flex-row sm:items-center">
          <p className="text-sm text-text-primary">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void loadDashboard()}>
            Retry
          </Button>
        </div>
      ) : loading && !dashboard ? (
        <div className="rounded-lg border border-border bg-surface p-5 text-sm text-text-secondary">
          Loading workspace dashboard…
        </div>
      ) : dashboard && (
        <>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.title}
                  className="rounded-lg border border-border bg-background p-3.5 shadow-subtle transition-colors hover:border-text-tertiary/40"
                >
                  <div className="flex items-center justify-between text-text-tertiary">
                    <span className="font-mono text-[10px] font-semibold tracking-wider">{kpi.title}</span>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="mt-2 font-mono text-lg font-semibold tracking-tight text-text-primary">
                    {kpi.value}
                  </p>
                  <p className="mt-1 text-[11px] text-text-tertiary">{kpi.detail}</p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-2.5 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
                  Recent Sales Invoices
                </h3>
                <Link href="/sales" className="text-xs text-accent hover:underline">
                  View invoices
                </Link>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard.recentInvoices.length === 0 ? (
                    <TableEmptyState message="No sales invoices in this workspace yet." />
                  ) : dashboard.recentInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono font-medium text-accent">
                        {invoice.invoiceNumber}
                      </TableCell>
                      <TableCell className="font-medium">{invoice.customerName}</TableCell>
                      <TableCell className="text-text-secondary">{formatDate(invoice.invoiceDate)}</TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatCurrency(invoice.grandTotal)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge size="sm" variant={statusVariant(invoice.status)}>
                          {invoice.status.replaceAll('_', ' ')}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="space-y-2.5">
              <h3 className="font-mono text-xs font-semibold uppercase tracking-wider text-text-primary">
                Workspace Activity
              </h3>
              <div className="space-y-3 rounded-lg border border-border bg-surface-secondary p-4 text-xs">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-text-secondary">Sales invoices</span>
                  <span className="font-mono font-semibold text-text-primary">{dashboard.invoicesCount}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-text-secondary">Purchase bills</span>
                  <span className="font-mono font-semibold text-text-primary">{dashboard.purchaseCount}</span>
                </div>
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-text-secondary">Customers</span>
                  <span className="font-mono font-semibold text-text-primary">{dashboard.customerCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-text-secondary">Suppliers</span>
                  <span className="font-mono font-semibold text-text-primary">{dashboard.supplierCount}</span>
                </div>
                <div className="flex items-center gap-2 border-t border-border pt-3 text-text-tertiary">
                  <Clock className="h-3.5 w-3.5" />
                  Values are read from this tenant’s business records.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
