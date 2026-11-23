'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs } from '@/components/ui/tabs';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { BookOpen, Plus, RefreshCw, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState('coa');
  const [coa, setCoa] = useState<any[]>([]);
  const [journals, setJournals] = useState<any[]>([]);
  const [trialBalance, setTrialBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Journal Entry Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [narration, setNarration] = useState('');
  const [reference, setReference] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [lines, setLines] = useState<Array<{ accountId: string; debit: number; credit: number; notes: string }>>([
    { accountId: '', debit: 0, credit: 0, notes: '' },
    { accountId: '', debit: 0, credit: 0, notes: '' },
  ]);

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [coaRes, jrnRes, tbRes] = await Promise.all([
        apiFetch('/accounting/chart-of-accounts'),
        apiFetch('/accounting/journals'),
        apiFetch('/accounting/trial-balance'),
      ]);
      setCoa(coaRes || []);
      setJournals(jrnRes?.data || []);
      setTrialBalance(tbRes);

      if (coaRes?.[0]?.id) {
        setLines([
          { accountId: coaRes[0].id, debit: 0, credit: 0, notes: '' },
          { accountId: coaRes[1]?.id || coaRes[0].id, debit: 0, credit: 0, notes: '' },
        ]);
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Validation math for journal
  const totalDebit = lines.reduce((sum, l) => sum + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + Number(l.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const addLine = () => {
    setLines([...lines, { accountId: coa[0]?.id || '', debit: 0, credit: 0, notes: '' }]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, idx) => idx !== index));
  };

  const updateLine = (index: number, field: string, val: any) => {
    const copy = [...lines];
    (copy[index] as any)[field] = val;
    setLines(copy);
  };

  const handleCreateJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!narration.trim()) {
      toast({ type: 'warning', title: 'Missing Narration', message: 'Please describe the transaction.' });
      return;
    }
    if (!isBalanced) {
      toast({
        type: 'warning',
        title: 'Unbalanced Entry',
        message: `Debit (₹${totalDebit}) must equal Credit (₹${totalCredit}).`,
      });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/accounting/journals', {
        method: 'POST',
        body: JSON.stringify({
          narration,
          reference,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit || 0),
            credit: Number(l.credit || 0),
            notes: l.notes,
          })),
        }),
      });

      toast({ type: 'success', title: 'Journal Posted', message: 'Double-entry transaction posted.' });
      setIsModalOpen(false);
      setNarration('');
      setReference('');
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to post', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Double-Entry Financial Accounting</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Strict double-entry general ledger, chart of accounts, automated journal postings, and trial balance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={loadData} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsModalOpen(true)}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            New Journal Entry
          </Button>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: 'coa', label: 'Chart of Accounts', count: coa.length },
          { id: 'journals', label: 'Journal Entries', count: journals.length },
          { id: 'trial_balance', label: 'Trial Balance' },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : activeTab === 'coa' ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead>Classification</TableHead>
              <TableHead>Sub-Group</TableHead>
              <TableHead className="text-right">Total Debits</TableHead>
              <TableHead className="text-right">Total Credits</TableHead>
              <TableHead className="text-right">Net Ledger Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coa.map((acc) => (
              <TableRow key={acc.id}>
                <TableCell className="font-mono text-accent font-semibold">{acc.code}</TableCell>
                <TableCell className="font-medium text-text-primary">{acc.name}</TableCell>
                <TableCell>
                  <Badge
                    size="sm"
                    variant={
                      acc.group === 'ASSET'
                        ? 'success'
                        : acc.group === 'LIABILITY'
                        ? 'warning'
                        : acc.group === 'INCOME'
                        ? 'accent'
                        : 'neutral'
                    }
                  >
                    {acc.group}
                  </Badge>
                </TableCell>
                <TableCell className="text-text-secondary text-xs">{acc.subGroup || '-'}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ₹ {Number(acc.totalDebit).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-xs">
                  ₹ {Number(acc.totalCredit).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono font-semibold text-text-primary">
                  ₹ {Number(acc.netBalance).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : activeTab === 'journals' ? (
        <div className="space-y-3">
          {journals.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-tertiary border border-border rounded">
              No journal entries recorded.
            </div>
          ) : (
            journals.map((j) => (
              <div key={j.id} className="p-3 bg-background border border-border rounded-lg space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-border text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-accent">{j.entryNumber}</span>
                    <span className="text-text-primary font-medium">{j.narration}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-text-tertiary font-mono">
                      {new Date(j.date).toLocaleDateString()}
                    </span>
                    <Badge size="sm" variant="success">Posted</Badge>
                  </div>
                </div>

                <div className="space-y-1 pt-1 font-mono text-xs">
                  {j.lines?.map((line: any) => (
                    <div key={line.id} className="flex justify-between py-0.5 text-[11px]">
                      <span className="text-text-secondary">
                        {line.debit > 0 ? line.account?.name : `  To ${line.account?.name}`}
                      </span>
                      <div className="flex gap-4">
                        <span className="w-20 text-right">
                          {line.debit > 0 ? `Dr ₹${Number(line.debit).toFixed(2)}` : ''}
                        </span>
                        <span className="w-20 text-right text-text-tertiary">
                          {line.credit > 0 ? `Cr ₹${Number(line.credit).toFixed(2)}` : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Trial Balance */
        <div className="space-y-3">
          <div className="p-3 bg-surface-secondary border border-border rounded-lg flex items-center justify-between">
            <span className="text-xs font-semibold text-text-primary font-mono uppercase tracking-wider">
              Trial Balance Integrity Check
            </span>
            {trialBalance?.isBalanced ? (
              <Badge size="sm" variant="success">
                <CheckCircle2 className="w-3 h-3" /> Balanced (Dr = Cr)
              </Badge>
            ) : (
              <Badge size="sm" variant="danger">
                <AlertCircle className="w-3 h-3" /> Unbalanced Discrepancy
              </Badge>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Code</TableHead>
                <TableHead>Account Title</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="text-right">Debit Balance (₹)</TableHead>
                <TableHead className="text-right">Credit Balance (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trialBalance?.accounts?.map((row: any, idx: number) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-accent">{row.code}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-text-secondary">{row.group}</TableCell>
                  <TableCell className="text-right font-mono">
                    {row.debit > 0 ? Number(row.debit).toFixed(2) : '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {row.credit > 0 ? Number(row.credit).toFixed(2) : '-'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-surface-secondary font-bold">
                <TableCell colSpan={3}>TOTAL</TableCell>
                <TableCell className="text-right font-mono text-accent">
                  ₹ {Number(trialBalance?.totalDebit || 0).toFixed(2)}
                </TableCell>
                <TableCell className="text-right font-mono text-accent">
                  ₹ {Number(trialBalance?.totalCredit || 0).toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* New Journal Entry Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Post Double-Entry Journal Voucher"
        description="Every posted entry must satisfy Sum(Debit) = Sum(Credit)."
        maxWidth="xl"
      >
        <form onSubmit={handleCreateJournal} className="space-y-4">
          <Input
            label="Transaction Narration *"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="e.g. Electricity bill payment from Bank Account"
            required
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                Debit / Credit Lines
              </span>
              <Button type="button" size="sm" variant="secondary" onClick={addLine}>
                + Add Line
              </Button>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
              {lines.map((l, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-surface-secondary border border-border rounded">
                  <div className="flex-1">
                    <select
                      value={l.accountId}
                      onChange={(e) => updateLine(idx, 'accountId', e.target.value)}
                      className="w-full h-8 px-2 text-xs bg-background border border-border rounded"
                    >
                      {coa.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Debit"
                    value={l.debit || ''}
                    onChange={(e) => updateLine(idx, 'debit', Number(e.target.value))}
                    className="w-24 h-8 px-2 text-right font-mono text-xs bg-background border border-border rounded"
                  />

                  <input
                    type="number"
                    step="0.01"
                    placeholder="Credit"
                    value={l.credit || ''}
                    onChange={(e) => updateLine(idx, 'credit', Number(e.target.value))}
                    className="w-24 h-8 px-2 text-right font-mono text-xs bg-background border border-border rounded"
                  />

                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="p-1 text-text-tertiary hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Balance Box */}
          <div className="p-3 bg-surface-secondary border border-border rounded space-y-1 text-xs font-mono">
            <div className="flex justify-between">
              <span>Total Debit:</span>
              <span className="font-bold">₹ {totalDebit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Credit:</span>
              <span className="font-bold">₹ {totalCredit.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t border-border">
              <span>Difference:</span>
              <span className={isBalanced ? 'text-emerald-500 font-bold' : 'text-red-500 font-bold'}>
                ₹ {Math.abs(totalDebit - totalCredit).toFixed(2)} {isBalanced ? '(Balanced ✓)' : '(Unbalanced ✗)'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting} disabled={!isBalanced}>
              Post Journal Voucher
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
