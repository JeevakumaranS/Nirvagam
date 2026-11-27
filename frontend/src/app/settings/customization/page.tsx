'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Layers,
  Plus,
  SlidersHorizontal,
  Table,
  History,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ArrowUpRight,
  Database,
  Ruler,
  Trash2,
  Receipt,
} from 'lucide-react';

export default function CustomizationPage() {
  const [entities, setEntities] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<string>('customers');
  const [metadata, setMetadata] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [newUnit, setNewUnit] = useState({ symbol: '', name: '', decimalPlaces: '0' });
  const [chargeTypes, setChargeTypes] = useState<any[]>([]);
  const [newChargeType, setNewChargeType] = useState({ name: '', chargeType: 'OTHER' });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'units' | 'charges' | 'fields' | 'entities' | 'templates' | 'history'>('units');

  // Modals
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);
  const [isCreateEntityModalOpen, setIsCreateEntityModalOpen] = useState(false);
  const [impactPreview, setImpactPreview] = useState<any>(null);
  const [isImpactModalOpen, setIsImpactModalOpen] = useState(false);

  // Form states
  const [newField, setNewField] = useState({
    fieldKey: '',
    label: '',
    datatype: 'text',
    storage: 'jsonb',
    required: false,
    showInList: true,
  });

  const [newEntity, setNewEntity] = useState({
    key: '',
    label: '',
    pluralLabel: '',
    icon: 'Layers',
  });

  useEffect(() => {
    loadEntities();
    loadTemplates();
    loadUnits();
    loadChargeTypes();
  }, []);

  async function loadChargeTypes() {
    try {
      const res = await apiFetch('/purchases/charge-types');
      setChargeTypes(Array.isArray(res) ? res : []);
    } catch {}
  }

  async function handleToggleChargeType(id: string, isActive: boolean) {
    try {
      await apiFetch(`/purchases/charge-types/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      setChargeTypes((prev) => prev.map((c) => (c.id === id ? { ...c, isActive } : c)));
    } catch (err: any) {
      alert(err.message || 'Failed to update charge');
    }
  }

  async function handleCreateChargeType(e: React.FormEvent) {
    e.preventDefault();
    if (!newChargeType.name.trim()) return;
    try {
      await apiFetch('/purchases/charge-types', {
        method: 'POST',
        body: JSON.stringify({
          name: newChargeType.name.trim(),
          chargeType: newChargeType.chargeType,
        }),
      });
      setNewChargeType({ name: '', chargeType: 'OTHER' });
      loadChargeTypes();
    } catch (err: any) {
      alert(err.message || 'Failed to create charge');
    }
  }

  async function handleDeleteChargeType(id: string) {
    try {
      await apiFetch(`/purchases/charge-types/${id}`, { method: 'DELETE' });
      setChargeTypes((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete charge');
    }
  }

  async function loadUnits() {
    try {
      const res = await apiFetch('/products/meta/units');
      setUnits(Array.isArray(res) ? res : []);
    } catch {}
  }

  async function handleToggleUnit(id: string, isActive: boolean) {
    try {
      await apiFetch(`/products/meta/units/${id}/toggle`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, isActive } : u)));
    } catch (err: any) {
      alert(err.message || 'Failed to update unit');
    }
  }

  async function handleCreateCustomUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!newUnit.symbol.trim() || !newUnit.name.trim()) return;
    try {
      await apiFetch('/products/meta/units', {
        method: 'POST',
        body: JSON.stringify({
          symbol: newUnit.symbol.trim().toUpperCase(),
          name: newUnit.name.trim(),
          decimalPlaces: Number(newUnit.decimalPlaces || 0),
        }),
      });
      setNewUnit({ symbol: '', name: '', decimalPlaces: '0' });
      loadUnits();
    } catch (err: any) {
      alert(err.message || 'Failed to create unit');
    }
  }

  async function handleDeleteUnit(id: string) {
    try {
      await apiFetch(`/products/meta/units/${id}`, { method: 'DELETE' });
      setUnits((prev) => prev.filter((u) => u.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete unit');
    }
  }

  useEffect(() => {
    if (selectedEntity) {
      loadMetadata(selectedEntity);
    }
  }, [selectedEntity]);

  useEffect(() => {
    if (activeTab === 'history') {
      loadHistory();
    }
  }, [activeTab]);

  async function loadEntities() {
    try {
      setLoading(true);
      const res = await apiFetch('/customization/entities');
      setEntities(res || []);
      if (res && res.length > 0 && !selectedEntity) {
        setSelectedEntity(res[0].key);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMetadata(entityKey: string) {
    try {
      const res = await apiFetch(`/customization/entities/${entityKey}`);
      setMetadata(res);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadTemplates() {
    try {
      const res = await apiFetch('/customization/templates');
      setTemplates(res || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function loadHistory() {
    try {
      const res = await apiFetch('/customization/history');
      setHistory(res || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateField() {
    try {
      await apiFetch('/customization/fields', {
        method: 'POST',
        body: JSON.stringify({
          entityKey: selectedEntity,
          ...newField,
        }),
      });
      setIsAddFieldModalOpen(false);
      setNewField({
        fieldKey: '',
        label: '',
        datatype: 'text',
        storage: 'jsonb',
        required: false,
        showInList: true,
      });
      loadMetadata(selectedEntity);
    } catch (err: any) {
      alert(err.message || 'Failed to create field');
    }
  }

  async function handleCreateEntity() {
    try {
      await apiFetch('/customization/entities', {
        method: 'POST',
        body: JSON.stringify(newEntity),
      });
      setIsCreateEntityModalOpen(false);
      setNewEntity({ key: '', label: '', pluralLabel: '', icon: 'Layers' });
      await loadEntities();
      setSelectedEntity(newEntity.key);
    } catch (err: any) {
      alert(err.message || 'Failed to create custom entity');
    }
  }

  async function handlePromoteField(fieldKey: string) {
    if (!confirm(`Promote "${fieldKey}" to dedicated PostgreSQL physical column? This enables direct SQL indexing.`)) {
      return;
    }
    try {
      await apiFetch('/customization/fields/promote', {
        method: 'POST',
        body: JSON.stringify({ entityKey: selectedEntity, fieldKey }),
      });
      loadMetadata(selectedEntity);
    } catch (err: any) {
      alert(err.message || 'Promotion failed');
    }
  }

  async function handlePreviewDatatype(fieldKey: string, targetType: string) {
    try {
      const preview = await apiFetch('/customization/fields/datatype/preview', {
        method: 'POST',
        body: JSON.stringify({ entityKey: selectedEntity, fieldKey, targetType }),
      });
      setImpactPreview(preview);
      setIsImpactModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Impact analysis failed');
    }
  }

  async function handleApplyDatatypeChange() {
    if (!impactPreview) return;
    try {
      await apiFetch('/customization/fields/datatype/apply', {
        method: 'POST',
        body: JSON.stringify({
          entityKey: impactPreview.entityKey,
          fieldKey: impactPreview.fieldKey,
          targetType: impactPreview.targetType,
        }),
      });
      setIsImpactModalOpen(false);
      setImpactPreview(null);
      loadMetadata(selectedEntity);
    } catch (err: any) {
      alert(err.message || 'Conversion failed');
    }
  }

  async function handleApplyTemplate(code: string) {
    if (!confirm(`Apply the "${code.toUpperCase()}" template attributes to your workspace?`)) return;
    try {
      await apiFetch(`/customization/templates/${code}/apply`, {
        method: 'POST',
      });
      alert('Template applied successfully!');
      loadMetadata(selectedEntity);
    } catch (err: any) {
      alert(err.message || 'Failed to apply template');
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 rounded-md" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-semibold text-text-primary tracking-[-0.01em]">
            Settings
          </h2>
          <p className="text-[12px] text-text-secondary mt-0.5">
            Configure active measurement units, custom fields, and workspace schema settings.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsCreateEntityModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>New Custom Table</span>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => setIsAddFieldModalOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 stroke-[1.5]" />
            <span>Add Field</span>
          </Button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="inline-flex p-1 rounded-lg bg-black/5 dark:bg-white/5 border border-border/60">
        <button
          onClick={() => setActiveTab('units')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'units'
              ? 'bg-surface text-accent shadow-subtle'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Ruler className="w-3.5 h-3.5" />
          Units of Measure ({units.filter((u) => u.isActive).length}/{units.length})
        </button>
        <button
          onClick={() => setActiveTab('charges')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all flex items-center gap-1.5 ${
            activeTab === 'charges'
              ? 'bg-surface text-accent shadow-subtle'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          <Receipt className="w-3.5 h-3.5" />
          Additional Charges ({chargeTypes.filter((c) => c.isActive).length}/{chargeTypes.length})
        </button>
        <button
          onClick={() => setActiveTab('fields')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
            activeTab === 'fields'
              ? 'bg-surface text-accent shadow-subtle'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Fields & Attributes
        </button>
        <button
          onClick={() => setActiveTab('entities')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
            activeTab === 'entities'
              ? 'bg-surface text-accent shadow-subtle'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Custom Tables ({entities.filter((e) => !e.isCore).length})
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
            activeTab === 'templates'
              ? 'bg-surface text-accent shadow-subtle'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Industry Templates
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
            activeTab === 'history'
              ? 'bg-surface text-accent shadow-subtle'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          Change History
        </button>
      </div>

      {/* TAB 0: UNITS OF MEASURE */}
      {activeTab === 'units' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-surface border border-border/80 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Measurement Units</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Enable or disable which units are available in Purchase Requests, Orders, GRNs, Invoices, and Products.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {units.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-surface-secondary/30">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-accent">{u.symbol}</span>
                      <span className="text-xs font-medium text-text-primary">{u.name}</span>
                      {!u.isSystem && <Badge size="sm" variant="neutral">Custom</Badge>}
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-0.5">Decimals: {u.decimalPlaces}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={u.isActive} onChange={(val) => handleToggleUnit(u.id, val)} />
                    {!u.isSystem && (
                      <button type="button" onClick={() => handleDeleteUnit(u.id)} className="text-danger p-1 hover:bg-danger/10 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateCustomUnit} className="bg-surface border border-border/80 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Add Custom Unit</h3>
            <p className="text-xs text-text-secondary">Define additional units specific to your business.</p>
            <Input
              label="Unit Symbol *"
              placeholder="e.g. BUNDLE, DOZEN, SQFT"
              value={newUnit.symbol}
              onChange={(e) => setNewUnit({ ...newUnit, symbol: e.target.value })}
              required
            />
            <Input
              label="Unit Name *"
              placeholder="e.g. Bundle, Dozen, Square Feet"
              value={newUnit.name}
              onChange={(e) => setNewUnit({ ...newUnit, name: e.target.value })}
              required
            />
            <Input
              label="Decimal Places"
              type="number"
              min="0"
              max="3"
              value={newUnit.decimalPlaces}
              onChange={(e) => setNewUnit({ ...newUnit, decimalPlaces: e.target.value })}
            />
            <Button type="submit" variant="primary" size="sm" className="w-full" icon={<Plus className="w-3.5 h-3.5" />}>
              Add Custom Unit
            </Button>
          </form>
        </div>
      )}

      {/* TAB 0B: ADDITIONAL CHARGES */}
      {activeTab === 'charges' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          <div className="lg:col-span-2 bg-surface border border-border/80 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">Purchase Additional Charges</h3>
              <p className="text-xs text-text-secondary mt-0.5">
                Enable or disable which additional charges appear in the Add Charge dropdown on Purchase Orders and Invoices.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {chargeTypes.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-surface-secondary/30">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-text-primary">{c.name}</span>
                      {!c.isSystem && <Badge size="sm" variant="neutral">Custom</Badge>}
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-0.5 font-mono">{c.chargeType}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={c.isActive} onChange={(val) => handleToggleChargeType(c.id, val)} />
                    {!c.isSystem && (
                      <button type="button" onClick={() => handleDeleteChargeType(c.id)} className="text-danger p-1 hover:bg-danger/10 rounded">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleCreateChargeType} className="bg-surface border border-border/80 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-semibold text-text-primary">Add Custom Charge</h3>
            <p className="text-xs text-text-secondary">Define additional purchase charges specific to your business.</p>
            <Input
              label="Charge Name *"
              placeholder="e.g. Packaging, Toll, Insurance"
              value={newChargeType.name}
              onChange={(e) => setNewChargeType({ ...newChargeType, name: e.target.value })}
              required
            />
            <Select
              label="Category"
              value={newChargeType.chargeType}
              onChange={(e) => setNewChargeType({ ...newChargeType, chargeType: e.target.value })}
            >
              <option value="FREIGHT">Transportation / Freight</option>
              <option value="LOADING">Loading / Unloading</option>
              <option value="PACKING">Packing</option>
              <option value="INSURANCE">Insurance</option>
              <option value="OTHER">Other</option>
            </Select>
            <Button type="submit" variant="primary" size="sm" className="w-full" icon={<Plus className="w-3.5 h-3.5" />}>
              Add Custom Charge
            </Button>
          </form>
        </div>
      )}

      {/* TAB 1: FIELDS & ATTRIBUTES */}
      {activeTab === 'fields' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* Left Column: Entity Selector */}
          <div className="lg:col-span-1 space-y-2">
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-text-secondary">
              Target Entity
            </div>
            <div className="space-y-1">
              {entities.map((ent) => {
                const isSelected = selectedEntity === ent.key;
                return (
                  <button
                    key={ent.key}
                    onClick={() => setSelectedEntity(ent.key)}
                    className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-[13px] flex items-center justify-between ${
                      isSelected
                        ? 'bg-accent/12 border-accent/30 text-accent font-medium'
                        : 'bg-surface border-transparent text-text-primary hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      {ent.isCore ? (
                        <Table className="w-3.5 h-3.5 text-text-secondary shrink-0 stroke-[1.5]" />
                      ) : (
                        <Layers className="w-3.5 h-3.5 text-accent shrink-0 stroke-[1.5]" />
                      )}
                      <span className="truncate">{ent.label}</span>
                    </div>
                    {ent.isCore ? (
                      <span className="text-[10px] text-text-tertiary font-mono">Core</span>
                    ) : (
                      <span className="text-[10px] text-accent font-mono">ct_*</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Custom Fields Table */}
          <div className="lg:col-span-3 space-y-4">
            <div className="p-4 rounded-xl bg-surface border border-border/80 shadow-card flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-text-primary">
                  {metadata?.entity?.label || selectedEntity} Attributes
                </h3>
                <p className="text-[12px] text-text-secondary mt-0.5">
                  Storage mode: JSONB (safe, zero-downtime) or Promoted Physical Column (indexable).
                </p>
              </div>
              <Badge size="sm" variant={metadata?.entity?.isCore ? 'neutral' : 'accent'}>
                {metadata?.entity?.isCore ? 'Core Protected Table' : 'Custom Entity Table'}
              </Badge>
            </div>

            {/* Fields List */}
            <div className="bg-surface border border-border/80 rounded-xl overflow-hidden shadow-card">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-surface-secondary/60 border-b border-border/70 text-text-secondary font-medium">
                  <tr>
                    <th className="py-2.5 px-4">Field Label</th>
                    <th className="py-2.5 px-3 font-mono">Key</th>
                    <th className="py-2.5 px-3">Datatype</th>
                    <th className="py-2.5 px-3">Storage</th>
                    <th className="py-2.5 px-3">Required</th>
                    <th className="py-2.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {metadata?.fields && metadata.fields.length > 0 ? (
                    metadata.fields.map((field: any) => (
                      <tr key={field.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 px-4 font-medium text-text-primary">{field.label}</td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-text-secondary">{field.field_key}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-mono text-[11px]">
                            {field.datatype}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {field.storage === 'column' ? (
                            <Badge size="sm" variant="success">Physical Column</Badge>
                          ) : (
                            <Badge size="sm" variant="neutral">JSONB</Badge>
                          )}
                        </td>
                        <td className="py-2.5 px-3">
                          {field.required ? (
                            <span className="text-danger font-semibold">Yes</span>
                          ) : (
                            <span className="text-text-tertiary">Optional</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-2">
                          {field.storage === 'jsonb' && (
                            <button
                              onClick={() => handlePromoteField(field.field_key)}
                              className="text-[11px] text-accent hover:underline font-medium"
                              title="Promote to real PostgreSQL column for high-speed indexing"
                            >
                              Promote to Column
                            </button>
                          )}
                          <button
                            onClick={() => handlePreviewDatatype(field.field_key, 'long_text')}
                            className="text-[11px] text-text-secondary hover:text-text-primary"
                          >
                            Change Type
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-text-tertiary">
                        No custom fields declared on this entity yet. Click &quot;Add Field&quot; to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CUSTOM TABLES */}
      {activeTab === 'entities' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {entities
              .filter((e) => !e.isCore)
              .map((ent) => (
                <div key={ent.key} className="p-4 rounded-xl bg-surface border border-border/80 shadow-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
                      <Layers className="w-4 h-4 stroke-[1.5]" />
                    </div>
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 text-text-secondary">
                      {ent.tableName}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-[14px] font-semibold text-text-primary">{ent.label}</h4>
                    <p className="text-[12px] text-text-secondary mt-0.5">
                      Plural: {ent.pluralLabel} • Version v{ent.version || 1}
                    </p>
                  </div>
                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px]">
                    <span className="text-success font-medium">● Active Module</span>
                    <button
                      onClick={() => {
                        setSelectedEntity(ent.key);
                        setActiveTab('fields');
                      }}
                      className="text-accent hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>Manage Fields</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 3: INDUSTRY TEMPLATES */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div key={tpl.code} className="p-5 rounded-xl bg-surface border border-border/80 shadow-card space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-accent stroke-[1.5]" />
                  <h4 className="text-[14px] font-semibold text-text-primary">{tpl.name}</h4>
                </div>
                <Badge size="sm" variant="accent">Target: {tpl.targetEntity}</Badge>
              </div>
              <p className="text-[12px] text-text-secondary">{tpl.description}</p>
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Attributes Included ({tpl.fields.length}):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tpl.fields.map((f: any) => (
                    <span key={f.fieldKey} className="px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 font-mono text-[11px] text-text-secondary">
                      {f.label} ({f.datatype})
                    </span>
                  ))}
                </div>
              </div>
              <div className="pt-3 border-t border-border/60">
                <Button size="sm" variant="secondary" onClick={() => handleApplyTemplate(tpl.code)}>
                  Apply Template Attributes
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: CHANGE HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-surface border border-border/80 rounded-xl overflow-hidden shadow-card">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-surface-secondary/60 border-b border-border/70 text-text-secondary font-medium">
              <tr>
                <th className="py-2.5 px-4">Change Type</th>
                <th className="py-2.5 px-3">Target</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">DDL / Operation</th>
                <th className="py-2.5 px-4">Applied At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {history.map((h) => (
                <tr key={h.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02]">
                  <td className="py-2.5 px-4 font-mono font-medium text-text-primary">{h.changeType}</td>
                  <td className="py-2.5 px-3 font-mono text-accent">{h.target}</td>
                  <td className="py-2.5 px-3">
                    <Badge size="sm" variant={h.status === 'APPLIED' ? 'success' : 'danger'}>
                      {h.status}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-text-secondary truncate max-w-xs">
                    {h.ddlSql}
                  </td>
                  <td className="py-2.5 px-4 text-text-tertiary">
                    {new Date(h.appliedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL 1: ADD CUSTOM FIELD */}
      <Modal
        isOpen={isAddFieldModalOpen}
        onClose={() => setIsAddFieldModalOpen(false)}
        title={`Add Custom Field to "${selectedEntity}"`}
        description="Creates a typed attribute stored in JSONB or physical column."
      >
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-text-primary">Field Label</label>
            <Input
              placeholder="e.g. Fabric GSM, Material Grade"
              value={newField.label}
              onChange={(e) => {
                const label = e.target.value;
                const autoKey = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
                setNewField({ ...newField, label, fieldKey: `cf_${autoKey}` });
              }}
            />
          </div>

          <div>
            <label className="text-[12px] font-medium text-text-primary">System Field Key (cf_*)</label>
            <Input
              value={newField.fieldKey}
              onChange={(e) => setNewField({ ...newField, fieldKey: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-text-primary">Datatype</label>
              <Select
                value={newField.datatype}
                onChange={(e) => setNewField({ ...newField, datatype: e.target.value })}
              >
                <option value="text">Text (Single Line)</option>
                <option value="long_text">Long Text (Multi-Line)</option>
                <option value="integer">Integer Number</option>
                <option value="decimal">Decimal Amount</option>
                <option value="boolean">Boolean Switch</option>
                <option value="date">Date</option>
                <option value="datetime">Date & Time</option>
                <option value="select">Dropdown Select</option>
                <option value="currency">Currency (INR)</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
              </Select>
            </div>

            <div>
              <label className="text-[12px] font-medium text-text-primary">Storage Architecture</label>
              <Select
                value={newField.storage}
                onChange={(e) => setNewField({ ...newField, storage: e.target.value })}
              >
                <option value="jsonb">JSONB (Zero Downtime, Default)</option>
                <option value="column">Direct Column (Indexable)</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[12px] text-text-primary">Mandatory / Required Field</span>
            <Switch
              checked={newField.required}
              onChange={(c) => setNewField({ ...newField, required: c })}
            />
          </div>

          <div className="pt-4 border-t border-border/70 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsAddFieldModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateField}>
              Create Field
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: CREATE CUSTOM ENTITY */}
      <Modal
        isOpen={isCreateEntityModalOpen}
        onClose={() => setIsCreateEntityModalOpen(false)}
        title="Create New Custom Table (ct_*)"
        description="Provisions an isolated table with audited timestamps, branch scope, and permission matrix integration."
      >
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-text-primary">Entity Singular Label</label>
            <Input
              placeholder="e.g. Quality Check, Vehicle Log"
              value={newEntity.label}
              onChange={(e) => {
                const label = e.target.value;
                const autoKey = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
                setNewEntity({
                  ...newEntity,
                  label,
                  key: autoKey,
                  pluralLabel: `${label}s`,
                });
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] font-medium text-text-primary">System Key</label>
              <Input
                value={newEntity.key}
                onChange={(e) => setNewEntity({ ...newEntity, key: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-text-primary">Plural Label</label>
              <Input
                value={newEntity.pluralLabel}
                onChange={(e) => setNewEntity({ ...newEntity, pluralLabel: e.target.value })}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-surface-secondary text-[11px] text-text-secondary space-y-1">
            <p className="font-semibold text-text-primary">Base Table Invariant:</p>
            <p>Will create table <code className="font-mono text-accent">ct_{newEntity.key || 'name'}</code> with: <code className="font-mono">id, created_at, updated_at, created_by, branch_id, is_deleted, custom_data</code>.</p>
          </div>

          <div className="pt-4 border-t border-border/70 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIsCreateEntityModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateEntity}>
              Create Custom Table
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: IMPACT PREVIEW DIALOG */}
      <Modal
        isOpen={isImpactModalOpen}
        onClose={() => setIsImpactModalOpen(false)}
        title="Datatype Change Impact Analysis"
        description="Dry-run impact evaluation across existing database rows."
      >
        {impactPreview && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-surface-secondary border border-border/60 flex items-center justify-between text-[12px]">
              <div>
                <span className="text-text-secondary">Conversion:</span>{' '}
                <span className="font-mono font-medium text-text-primary">{impactPreview.currentType}</span>{' '}
                → <span className="font-mono font-medium text-accent">{impactPreview.targetType}</span>
              </div>
              <Badge size="sm" variant={impactPreview.isLossless ? 'success' : 'warning'}>
                {impactPreview.isLossless ? 'Lossless Widening' : 'Narrowing / Lossy'}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-[12px]">
              <div className="p-3 rounded-lg bg-surface border border-border/60">
                <p className="text-text-secondary text-[11px]">Total Existing Rows</p>
                <p className="text-[18px] font-semibold text-text-primary">{impactPreview.totalRowCount}</p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border/60">
                <p className="text-text-secondary text-[11px]">Incompatible Rows</p>
                <p className={`text-[18px] font-semibold ${impactPreview.incompatibleRowCount > 0 ? 'text-danger' : 'text-success'}`}>
                  {impactPreview.incompatibleRowCount}
                </p>
              </div>
            </div>

            {impactPreview.warnings && impactPreview.warnings.length > 0 && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
                {impactPreview.warnings.map((w: string, i: number) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            )}

            {impactPreview.requiresShadowBackup && (
              <div className="p-3 rounded-lg bg-surface-secondary text-[11px] text-text-secondary">
                <p className="font-semibold text-text-primary">Reversible Shadow Backup:</p>
                <p>A shadow column <code className="font-mono text-accent">{impactPreview.shadowBackupColumn}</code> will preserve existing data before swap.</p>
              </div>
            )}

            <div className="pt-4 border-t border-border/70 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsImpactModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant={impactPreview.canApplyDirectly ? 'primary' : 'danger'}
                disabled={!impactPreview.canApplyDirectly}
                onClick={handleApplyDatatypeChange}
              >
                {impactPreview.canApplyDirectly ? 'Confirm & Apply Change' : 'Blocked (Resolve Errors)'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
