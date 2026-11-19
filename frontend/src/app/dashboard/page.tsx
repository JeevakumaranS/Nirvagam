'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import {
  TrendingUp,
  CreditCard,
  Package,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Users,
  Building,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

export default function DashboardPage() {
  const { user, tenant, activeBusiness } = useAuth();

  const kpis = [
    {
      title: 'TOTAL SALES (MTD)',
      value: '₹ 2,45,800.00',
      change: '+14.2%',
      isPositive: true,
      icon: TrendingUp,
    },
    {
      title: 'ACCOUNTS RECEIVABLE',
      value: '₹ 54,200.00',
      change: '4 pending',
      isPositive: false,
      icon: CreditCard,
    },
    {
      title: 'CASH & BANK BALANCE',
      value: '₹ 1,82,450.00',
      change: 'Reconciled',
      isPositive: true,
      icon: Wallet,
    },
    {
      title: 'INVENTORY VALUATION',
      value: '₹ 4,12,000.00',
      change: '142 SKU items',
      isPositive: true,
      icon: Package,
    },
  ];

  const recentInvoices = [
    { id: 'INV-26/1001', customer: 'Kavitha Silks & Textiles', date: '19 Nov 2026', total: '₹ 18,450.00', status: 'PAID' },
    { id: 'INV-26/1002', customer: 'Trichy Engineering Works', date: '19 Nov 2026', total: '₹ 32,800.00', status: 'PARTIALLY_PAID' },
    { id: 'INV-26/1003', customer: 'Salem Agro Traders', date: '18 Nov 2026', total: '₹ 8,900.00', status: 'PAID' },
    { id: 'INV-26/1004', customer: 'Kongu Hardware Store', date: '17 Nov 2026', total: '₹ 41,200.00', status: 'OVERDUE' },
  ];

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-surface-secondary border border-border rounded-lg shadow-subtle">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            Welcome, {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Active Entity:{' '}
            <span className="font-medium text-text-primary">
              {activeBusiness?.legalName || 'Nirvagam Enterprise'}
            </span>{' '}
            • Branch: <span className="font-mono text-text-secondary">{activeBusiness?.branchName || 'HQ'}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings/users">
            <Button size="sm" variant="secondary" icon={<Users className="w-3.5 h-3.5" />}>
              Team Members
            </Button>
          </Link>
          <Link href="/settings/business">
            <Button size="sm" variant="secondary" icon={<Building className="w-3.5 h-3.5" />}>
              Configure Entity
            </Button>
          </Link>
          <Button size="sm" variant="primary" icon={<Plus className="w-3.5 h-3.5" />}>
            New Tax Invoice
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="p-3.5 bg-background border border-border rounded-lg shadow-subtle hover:border-text-tertiary/40 transition-colors"
            >
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-[10px] font-semibold tracking-wider font-mono">
                  {kpi.title}
                </span>
                <Icon className="w-4 h-4 text-text-tertiary" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-lg font-semibold text-text-primary font-mono tracking-tight">
                  {kpi.value}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-1 text-[11px]">
                {kpi.isPositive ? (
                  <span className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium">
                    <ArrowUpRight className="w-3 h-3" />
                    {kpi.change}
                  </span>
                ) : (
                  <span className="flex items-center text-amber-600 dark:text-amber-400 font-medium">
                    <Clock className="w-3 h-3" />
                    {kpi.change}
                  </span>
                )}
                <span className="text-text-tertiary">• vs last cycle</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Two Column Layout: Recent Invoices & System Verification */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Invoices Table */}
        <div className="lg:col-span-2 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
              Recent Commercial Invoices
            </h3>
            <span className="text-xs text-accent hover:underline cursor-pointer">View all invoices</span>
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
              {recentInvoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-accent font-medium">{inv.id}</TableCell>
                  <TableCell className="font-medium">{inv.customer}</TableCell>
                  <TableCell className="text-text-secondary">{inv.date}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{inv.total}</TableCell>
                  <TableCell className="text-center">
                    <Badge
                      size="sm"
                      variant={
                        inv.status === 'PAID'
                          ? 'success'
                          : inv.status === 'PARTIALLY_PAID'
                          ? 'warning'
                          : 'danger'
                      }
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* System & Architecture Integrity Card */}
        <div className="space-y-2.5">
          <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
            System & Compliance Status
          </h3>
          <div className="p-4 bg-surface-secondary border border-border rounded-lg space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-text-secondary">Double-Entry Ledger</span>
              <Badge size="sm" variant="success">Balanced (Dr = Cr)</Badge>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-text-secondary">GST Calculation</span>
              <span className="font-mono text-text-primary">TN (33) Intra-state</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-text-secondary">Multi-Tenant Isolation</span>
              <Badge size="sm" variant="neutral">Discriminator Enforced</Badge>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <span className="text-text-secondary">Audit Trail Logging</span>
              <Badge size="sm" variant="success">Active</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-secondary">Fiscal Period</span>
              <span className="font-mono text-text-primary">FY 2026-2027</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
