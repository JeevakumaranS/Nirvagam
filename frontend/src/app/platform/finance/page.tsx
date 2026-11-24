'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';

export default function PlatformFinancePage() {
  const [payments, setPayments] = useState<any[]>([]);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage = user?.roles?.some((role) => role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPER_ADMIN') || user?.permissions?.includes('payments:manage');
  const load = () => apiFetch<any[]>('/platform/payments').then(setPayments).catch((err) => setError(err.message));
  useEffect(() => { void load(); }, []);
  const markPaid = async (id: string) => {
    try {
      await apiFetch(`/platform/payments/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'PAID' }) });
      toast({ type: 'success', title: 'Payment recorded', message: 'Subscription status and renewal metrics were updated.' });
      await load();
    } catch (err: any) { toast({ type: 'error', title: 'Unable to record payment', message: err.message }); }
  };
  return <div className="space-y-5"><div><h1 className="text-lg font-semibold">Payments & Revenue</h1><p className="mt-1 text-xs text-text-secondary">NIRVAGAM SaaS subscription payments only. Business accounting data is not exposed here.</p></div>{error ? <p className="text-sm text-danger">{error}</p> : <div className="overflow-x-auto rounded-lg border border-border bg-surface"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-text-secondary"><th className="p-3">Invoice</th><th className="p-3">Business</th><th className="p-3">Amount</th><th className="p-3">Due</th><th className="p-3">Status</th>{canManage && <th className="p-3">Action</th>}</tr></thead><tbody>{payments.map((payment) => <tr key={payment.id} className="border-b border-border/60"><td className="p-3 font-mono">{payment.invoiceNumber}</td><td className="p-3">{payment.displayName}</td><td className="p-3 font-mono">{payment.currency} {payment.amount}</td><td className="p-3">{new Date(payment.dueAt).toLocaleDateString()}</td><td className="p-3"><Badge size="sm" variant={payment.status === 'PAID' ? 'success' : 'warning'}>{payment.status}</Badge></td>{canManage && <td className="p-3">{payment.status === 'PENDING' && <Button size="sm" variant="secondary" onClick={() => markPaid(payment.id)}>Record payment</Button>}</td>}</tr>)}</tbody></table>{payments.length === 0 && <p className="p-5 text-sm text-text-secondary">No subscription payments found.</p>}</div>}</div>;
}
