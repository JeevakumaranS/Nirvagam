'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Badge } from '@/components/ui/badge';
import { Building2, Headphones, CreditCard, AlertCircle, CheckCircle2, Clock3 } from 'lucide-react';

type Dashboard = Record<string, any>;

export default function PlatformDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const isSuperAdmin = user?.roles?.some((role) => role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPER_ADMIN');
  const support = !isSuperAdmin && Boolean(user?.permissions?.includes('support_requests:view'));
  const finance = !support && Boolean(user?.permissions?.some((permission) =>
    ['subscriptions:view', 'payments:view', 'revenue_reports:view'].includes(permission)
  ));

  useEffect(() => {
    const endpoint = isSuperAdmin
      ? '/platform/dashboard/overview'
      : support
        ? '/platform/dashboard/support'
        : finance
          ? '/platform/dashboard/finance'
          : '/platform/dashboard/overview';
    apiFetch<Dashboard>(endpoint)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [finance, isSuperAdmin, support]);

  if (error) return <div className="p-5 text-sm text-danger">{error}</div>;
  if (!data) return <div className="p-5 text-sm text-text-secondary">Loading platform dashboard...</div>;

  const cards = isSuperAdmin
    ? [
        ['Registered businesses', data.registeredBusinesses, Building2],
        ['Active businesses', data.activeBusinesses, CheckCircle2],
        ['Suspended businesses', data.suspendedBusinesses, AlertCircle],
        ['Active subscriptions', data.activeSubscriptions, CheckCircle2],
        ['Total subscription revenue', `₹ ${Number(data.totalRevenue || 0).toLocaleString('en-IN')}`, CreditCard],
        ['Open support requests', data.openSupportRequests, Headphones],
        ['Pending payments', data.pendingPayments, Clock3],
      ]
    : support
    ? [
        ['Registered businesses', data.registeredBusinesses, Building2],
        ['Active businesses', data.activeBusinesses, CheckCircle2],
        ['Suspended businesses', data.suspendedBusinesses, AlertCircle],
        ['Open support requests', data.openRequests, Headphones],
        ['Pending requests', data.pendingRequests, Clock3],
        ['Resolved requests', data.resolvedRequests, CheckCircle2],
      ]
    : [
        ['Total subscription revenue', `₹ ${Number(data.totalRevenue || 0).toLocaleString('en-IN')}`, CreditCard],
        ['Monthly revenue', `₹ ${Number(data.monthlyRevenue || 0).toLocaleString('en-IN')}`, CreditCard],
        ['Active subscriptions', data.activeSubscriptions, CheckCircle2],
        ['Expiring in 30 days', data.expiringSubscriptions, Clock3],
        ['Pending payments', data.pendingPayments, AlertCircle],
        ['Active free trials', data.activeFreeTrials, Building2],
      ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">{support ? 'Support Operations' : 'Finance Operations'}</h1>
        <p className="mt-1 text-xs text-text-secondary">Live SaaS platform metrics for {user?.firstName || 'your'} team.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, Icon]) => (
          <div key={String(label)} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-center justify-between text-text-secondary"><span className="text-[11px] uppercase tracking-wide">{label}</span><Icon className="h-4 w-4" /></div>
            <p className="mt-3 text-2xl font-semibold font-mono text-text-primary">{value}</p>
          </div>
        ))}
      </div>
      {isSuperAdmin ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Platform business operations</h2>
          <div className="space-y-2">{(data.tenants || []).map((tenant: any) => <div key={tenant.id} className="flex items-center justify-between border-b border-border/60 py-2 text-xs"><span>{tenant.displayName} <span className="text-text-tertiary">· {tenant.planName || 'No plan'}</span></span><span className="text-text-secondary">{tenant.subscriptionStatus || tenant.status}</span></div>)}</div>
        </div>
      ) : support ? (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Recent registered businesses</h2>
          <div className="space-y-2">{(data.tenants || []).map((tenant: any) => <div key={tenant.id} className="flex items-center justify-between border-b border-border/60 py-2 text-xs"><span>{tenant.displayName} <span className="text-text-tertiary">({tenant.slug})</span></span><Badge size="sm" variant={tenant.status === 'active' ? 'success' : tenant.status === 'suspended' ? 'danger' : 'neutral'}>{tenant.status}</Badge></div>)}</div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold">Upcoming renewals</h2>
          <div className="space-y-2">{(data.subscriptions || []).map((subscription: any) => <div key={subscription.id} className="flex items-center justify-between border-b border-border/60 py-2 text-xs"><span>{subscription.displayName} · {subscription.planName}</span><span className="font-mono text-text-secondary">{new Date(subscription.renewalDate).toLocaleDateString()}</span></div>)}</div>
        </div>
      )}
    </div>
  );
}
