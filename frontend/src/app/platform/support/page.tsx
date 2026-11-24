'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';

export default function PlatformSupportPage() {
  const [items, setItems] = useState<any[]>([]);
  const { toast } = useToast();
  const load = () => apiFetch<any[]>('/platform/support-requests').then(setItems).catch((err) => toast({ type: 'error', title: 'Unable to load support requests', message: err.message }));
  useEffect(() => { void load(); }, []);
  const update = async (id: string, changes: Record<string, any>) => { try { await apiFetch(`/platform/support-requests/${id}`, { method: 'PATCH', body: JSON.stringify(changes) }); await load(); } catch (err: any) { toast({ type: 'error', title: 'Unable to update request', message: err.message }); } };
  return <div className="space-y-5"><div><h1 className="text-lg font-semibold">Customer Support</h1><p className="mt-1 text-xs text-text-secondary">Assign, prioritize, resolve, and escalate platform support requests.</p></div><div className="overflow-x-auto rounded-lg border border-border bg-surface"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-text-secondary"><th className="p-3">Request</th><th className="p-3">Business</th><th className="p-3">Priority</th><th className="p-3">Status</th><th className="p-3">Action</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-border/60"><td className="p-3"><div className="font-medium">{item.subject}</div><div className="mt-1 text-text-tertiary">{item.description}</div></td><td className="p-3">{item.displayName || 'Unlinked'}</td><td className="p-3"><select aria-label={`Priority for ${item.subject}`} value={item.priority} onChange={(event) => update(item.id, { priority: event.target.value })} className="rounded border border-border bg-background px-2 py-1 text-xs"><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>URGENT</option></select></td><td className="p-3"><select aria-label={`Status for ${item.subject}`} value={item.status} onChange={(event) => update(item.id, { status: event.target.value })} className="rounded border border-border bg-background px-2 py-1 text-xs"><option>OPEN</option><option>PENDING</option><option>RESOLVED</option><option>CLOSED</option></select></td><td className="p-3"><Button size="sm" variant="secondary" disabled={item.status === 'RESOLVED' || item.status === 'CLOSED'} onClick={() => update(item.id, { status: 'RESOLVED', resolution: 'Resolved by platform support' })}>Resolve</Button><Button size="sm" variant="secondary" className="ml-2" onClick={() => update(item.id, { escalate: true, priority: 'URGENT', status: 'PENDING' })}>Escalate</Button></td></tr>)}</tbody></table>{items.length === 0 && <p className="p-5 text-sm text-text-secondary">No support requests found.</p>}</div></div>;
}
