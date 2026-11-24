'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function PlatformAuditLogsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [error, setError] = useState('');
  useEffect(() => { apiFetch<any[]>('/platform/audit-logs').then(setItems).catch((err) => setError(err.message)); }, []);
  return <div className="space-y-5"><div><h1 className="text-lg font-semibold">Platform Activity Logs</h1><p className="mt-1 text-xs text-text-secondary">Sensitive SaaS administration and support actions.</p></div>{error ? <p className="text-sm text-danger">{error}</p> : <div className="overflow-x-auto rounded-lg border border-border bg-surface"><table className="w-full text-left text-xs"><thead><tr className="border-b border-border text-text-secondary"><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Target</th><th className="p-3">Reason</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-border/60"><td className="p-3 font-mono">{new Date(item.createdAt).toLocaleString()}</td><td className="p-3 font-medium">{item.action}</td><td className="p-3">{item.targetType} · {item.targetId || '—'}</td><td className="p-3 text-text-secondary">{item.reason || '—'}</td></tr>)}</tbody></table>{items.length === 0 && <p className="p-5 text-sm text-text-secondary">No platform activity recorded.</p>}</div>}</div>;
}
