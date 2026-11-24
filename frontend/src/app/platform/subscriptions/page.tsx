'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useAuth } from '@/lib/auth-context';

export default function PlatformSubscriptionsPage() {
  const [items, setItems] = useState<any[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const canRenew = user?.roles?.some((role) => role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPER_ADMIN') || user?.permissions?.includes('renewals:manage');
  const load = () => apiFetch<any[]>('/platform/subscriptions').then(setItems).catch((err) => toast({ type: 'error', title: 'Unable to load subscriptions', message: err.message }));
  useEffect(() => { void load(); }, []);
  const renew = async (id: string) => { try { await apiFetch(`/platform/subscriptions/${id}/renew`, { method: 'POST', body: JSON.stringify({ periodDays: 30 }) }); toast({ type: 'success', title: 'Subscription renewed', message: 'The tenant status and renewal date were updated.' }); await load(); } catch (err: any) { toast({ type: 'error', title: 'Unable to renew subscription', message: err.message }); } };
  return <div className="space-y-5"><div><h1 className="text-lg font-semibold">Subscriptions</h1><p className="mt-1 text-xs text-text-secondary">Read-only subscription visibility for Support; management access is permission-controlled for Finance.</p></div><div className="overflow-x-auto rounded-lg border border-border bg-surface"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-text-secondary"><th className="p-3">Business</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Renewal</th>{canRenew && <th className="p-3">Action</th>}</tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-border/60"><td className="p-3">{item.displayName}</td><td className="p-3">{item.planName}</td><td className="p-3"><Badge size="sm" variant={item.status === 'ACTIVE' ? 'success' : 'warning'}>{item.status}</Badge></td><td className="p-3">{new Date(item.periodEnd).toLocaleDateString()}</td>{canRenew && <td className="p-3"><Button size="sm" variant="secondary" onClick={() => renew(item.id)}>Renew 30 days</Button></td>}</tr>)}</tbody></table></div></div>;
}
