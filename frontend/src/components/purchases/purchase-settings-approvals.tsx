'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/toast';
import { Check, X, RotateCcw, Plus, Trash2 } from 'lucide-react';

export function PurchaseSettingsApprovals({ mode }: { mode: 'settings' | 'approvals' }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  // New Rule Form
  const [docType, setDocType] = useState('PO');
  const [minAmount, setMinAmount] = useState('10000');
  const [roleName, setRoleName] = useState('MANAGER');

  const load = async () => {
    try {
      if (mode === 'settings') {
        const [s, coa] = await Promise.all([apiFetch('/purchases/settings'), apiFetch('/accounting/accounts')]);
        setSettings(s);
        setAccounts(Array.isArray(coa) ? coa : coa?.data || []);
      } else {
        const [r, req] = await Promise.all([apiFetch('/purchases/approvals/rules'), apiFetch('/purchases/approvals/requests')]);
        setRules(Array.isArray(r) ? r : []);
        setRequests(Array.isArray(req) ? req : []);
      }
    } catch {}
  };

  useEffect(() => {
    load();
  }, [mode]);

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await apiFetch('/purchases/settings', { method: 'PUT', body: JSON.stringify(settings) });
      toast({ type: 'success', title: 'Settings saved', message: 'Purchase & accounting mappings updated.' });
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const addRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/purchases/approvals/rules', {
        method: 'POST',
        body: JSON.stringify({
          documentType: docType,
          minAmount: Number(minAmount || 0),
          levels: [{ level: 1, roleName }],
        }),
      });
      toast({ type: 'success', title: 'Approval rule created' });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const act = async (id: string, action: 'approve' | 'reject' | 'send-back') => {
    const reason = action === 'approve' ? 'Approved' : window.prompt(`Enter reason for ${action}:`) || '';
    if (action !== 'approve' && !reason.trim()) return;
    try {
      await apiFetch(`/purchases/approvals/requests/${id}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      toast({ type: 'success', title: `Request ${action}d` });
      load();
    } catch (err: any) {
      toast({ type: 'error', title: 'Action failed', message: err.message });
    }
  };

  if (mode === 'settings' && settings) {
    return (
      <form onSubmit={saveSettings} className="space-y-4 max-w-3xl">
        <div className="p-4 rounded-xl border border-border bg-surface space-y-4">
          <h3 className="text-sm font-semibold text-text-primary">Tax, Costing & Inventory Policies</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select label="Tax Regime" value={settings.taxRegime} onChange={(e) => setSettings({ ...settings, taxRegime: e.target.value })}>
              <option value="GST">Indian GST (CGST+SGST / IGST)</option>
              <option value="VAT">VAT</option>
            </Select>
            <Select label="Inventory Costing Method" value={settings.costingMethod} onChange={(e) => setSettings({ ...settings, costingMethod: e.target.value })}>
              <option value="WAC">Weighted Average Cost (WAC)</option>
              <option value="FIFO">FIFO</option>
            </Select>
            <Input
              label="Default Over-Receipt Tolerance (%)"
              type="number"
              value={settings.defaultOverReceiptTolerance}
              onChange={(e) => setSettings({ ...settings, defaultOverReceiptTolerance: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={settings.enableGrnAccrual} onChange={(e) => setSettings({ ...settings, enableGrnAccrual: e.target.checked })} />
              <span>Enable GRN Accrual Accounting (Dr Inventory / Cr GRN Clearing on GRN post, cleared by Invoice)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={settings.blockReturnOnInsufficientStock} onChange={(e) => setSettings({ ...settings, blockReturnOnInsufficientStock: e.target.checked })} />
              <span>Strictly block Purchase Return when warehouse stock is insufficient</span>
            </label>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Accounting Ledger Mappings (Optional Overrides)</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'accountsPayableAccountId', label: 'Accounts Payable (Default: 2010)' },
              { key: 'inventoryAccountId', label: 'Inventory Account (Default: 1020)' },
              { key: 'grnClearingAccountId', label: 'GRN Clearing / Accrual (Default: 2015)' },
              { key: 'priceVarianceAccountId', label: 'Purchase Price Variance (Default: 5025)' },
              { key: 'supplierAdvanceAccountId', label: 'Supplier Advance (Default: 2020)' },
              { key: 'defaultBankAccountId', label: 'Default Bank Account (Default: 1000)' },
            ].map((field) => (
              <Select
                key={field.key}
                label={field.label}
                value={settings[field.key] || ''}
                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value || null })}
              >
                <option value="">Use System Default</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                ))}
              </Select>
            ))}
          </div>
        </div>

        <Button type="submit" variant="primary" loading={saving}>Save Purchase Settings</Button>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Approval Inbox */}
      <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Approval Requests</h3>
        {requests.length === 0 ? (
          <div className="py-8 text-center text-xs text-text-tertiary">No approval requests pending.</div>
        ) : (
          requests.map((req) => (
            <div key={req.id} className="p-3 rounded-lg border border-border bg-surface-secondary/30 flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold">{req.documentType} • Level {req.currentLevel}</div>
                <div className="text-[11px] text-text-tertiary font-mono">{req.documentId.slice(0, 8)} • <Badge size="sm" variant="accent">{req.status}</Badge></div>
              </div>
              {req.status === 'PENDING' && (
                <div className="flex gap-1">
                  <Button size="sm" variant="primary" onClick={() => act(req.id, 'approve')} icon={<Check className="w-3 h-3" />}>Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => act(req.id, 'send-back')} icon={<RotateCcw className="w-3 h-3" />}>Send Back</Button>
                  <Button size="sm" variant="danger" onClick={() => act(req.id, 'reject')} icon={<X className="w-3 h-3" />}>Reject</Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Approval Rules */}
      <div className="p-4 rounded-xl border border-border bg-surface space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Configurable Approval Rules</h3>
        <form onSubmit={addRule} className="grid grid-cols-3 gap-2 items-end">
          <Select label="Document" value={docType} onChange={(e) => setDocType(e.target.value)}>
            <option value="PR">PR</option>
            <option value="PO">PO</option>
            <option value="INVOICE">Invoice</option>
            <option value="RETURN">Return</option>
          </Select>
          <Input label="Min Amount (₹)" type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
          <div className="flex gap-1">
            <Input label="Role" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
            <Button type="submit" size="sm" variant="primary" className="mb-0.5" icon={<Plus className="w-3.5 h-3.5" />}>Add</Button>
          </div>
        </form>

        <div className="space-y-2 pt-2">
          {rules.map((r) => (
            <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border text-xs">
              <div>
                <span className="font-semibold">{r.documentType}</span> ≥ ₹{Number(r.minAmount)}
                <span className="text-text-tertiary ml-2">({(r.levels || []).map((l: any) => l.roleName).join(' → ')})</span>
              </div>
              <button
                onClick={async () => {
                  await apiFetch(`/purchases/approvals/rules/${r.id}`, { method: 'DELETE' });
                  load();
                }}
                className="text-danger p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
