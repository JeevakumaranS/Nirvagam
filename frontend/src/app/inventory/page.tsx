'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmptyState } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast';
import { Layers, Plus, Search, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    hsnCode: '',
    purchasePrice: 0,
    salesPrice: 0,
    mrp: 0,
    minStockLevel: 10,
    openingStock: 0,
    unitId: '',
    taxRateId: '',
  });

  const { toast } = useToast();

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, unitRes, taxRes] = await Promise.all([
        apiFetch('/products', { params: { search } }),
        apiFetch('/products/meta/units'),
        apiFetch('/products/meta/tax-rates'),
      ]);

      setProducts(prodRes?.data || []);
      setUnits(unitRes || []);
      setTaxRates(taxRes || []);

      if (unitRes?.[0]?.id && !formData.unitId) {
        setFormData((prev) => ({ ...prev, unitId: unitRes[0].id }));
      }
      if (taxRes?.[0]?.id && !formData.taxRateId) {
        setFormData((prev) => ({ ...prev, taxRateId: taxRes[0].id }));
      }
    } catch (err: any) {
      toast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) {
      toast({ type: 'warning', title: 'Required Fields', message: 'Name and SKU are mandatory.' });
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          purchasePrice: Number(formData.purchasePrice),
          salesPrice: Number(formData.salesPrice),
          mrp: Number(formData.mrp || formData.salesPrice),
          minStockLevel: Number(formData.minStockLevel),
          openingStock: Number(formData.openingStock),
        }),
      });

      toast({ type: 'success', title: 'Product Added', message: `${formData.name} added to catalog.` });
      setIsModalOpen(false);
      setFormData({
        name: '',
        sku: '',
        barcode: '',
        hsnCode: '',
        purchasePrice: 0,
        salesPrice: 0,
        mrp: 0,
        minStockLevel: 10,
        openingStock: 0,
        unitId: units[0]?.id || '',
        taxRateId: taxRates[0]?.id || '',
      });
      loadData();
    } catch (err: any) {
      toast({ type: 'error', title: 'Failed to create product', message: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Inventory & Product Catalog</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Multi-branch stock balances, HSN codes, GST tax rates and low-stock reorder monitoring.
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
            Add Product
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 max-w-sm">
        <Input
          placeholder="Search by name, SKU or barcode..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          prefixIcon={<Search className="w-3.5 h-3.5" />}
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product Name</TableHead>
              <TableHead>HSN Code</TableHead>
              <TableHead>GST Slab</TableHead>
              <TableHead className="text-right">Cost Price</TableHead>
              <TableHead className="text-right">Sales Price</TableHead>
              <TableHead className="text-right">Available Stock</TableHead>
              <TableHead className="text-center">Stock Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableEmptyState message="No products in catalog. Click 'Add Product' to create your first stock item." />
            ) : (
              products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-accent font-semibold">{p.sku}</TableCell>
                  <TableCell className="font-medium text-text-primary">{p.name}</TableCell>
                  <TableCell className="font-mono text-text-secondary">{p.hsnCode || '-'}</TableCell>
                  <TableCell>
                    <Badge size="sm" variant="neutral">{p.taxRate?.name || '18%'}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-text-secondary">
                    ₹ {Number(p.purchasePrice).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold text-text-primary">
                    ₹ {Number(p.salesPrice).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono font-semibold">
                    {p.totalStock} {p.unit?.symbol || 'PCS'}
                  </TableCell>
                  <TableCell className="text-center">
                    {p.totalStock <= 0 ? (
                      <Badge size="sm" variant="danger">Out of Stock</Badge>
                    ) : p.isLowStock ? (
                      <Badge size="sm" variant="warning">Low Stock</Badge>
                    ) : (
                      <Badge size="sm" variant="success">Healthy</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      )}

      {/* Add Product Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add New Catalog Product"
        description="Creates product variant and initializes warehouse stock balance."
      >
        <form onSubmit={handleCreateProduct} className="space-y-3">
          <Input
            label="Product Name *"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Slim Fit Denim Jeans"
            required
          />

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="SKU (Unique) *"
              value={formData.sku}
              onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
              placeholder="e.g. JEANS-SLIM-01"
              required
            />
            <Input
              label="Barcode / EAN"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="e.g. 890123456789"
            />
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Input
              label="HSN Code"
              value={formData.hsnCode}
              onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
              placeholder="e.g. 6203"
            />
            <Select
              label="UOM Unit"
              value={formData.unitId}
              onChange={(e) => setFormData({ ...formData, unitId: e.target.value })}
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.symbol})
                </option>
              ))}
            </Select>
            <Select
              label="GST Slab"
              value={formData.taxRateId}
              onChange={(e) => setFormData({ ...formData, taxRateId: e.target.value })}
            >
              {taxRates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <Input
              label="Purchase Price (₹) *"
              type="number"
              step="0.01"
              value={formData.purchasePrice || ''}
              onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
              placeholder="0.00"
              required
            />
            <Input
              label="Sales Price (₹) *"
              type="number"
              step="0.01"
              value={formData.salesPrice || ''}
              onChange={(e) => setFormData({ ...formData, salesPrice: Number(e.target.value) })}
              placeholder="0.00"
              required
            />
            <Input
              label="MRP (₹)"
              type="number"
              step="0.01"
              value={formData.mrp || ''}
              onChange={(e) => setFormData({ ...formData, mrp: Number(e.target.value) })}
              placeholder="0.00"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Input
              label="Min Stock Warning Level"
              type="number"
              value={formData.minStockLevel || ''}
              onChange={(e) => setFormData({ ...formData, minStockLevel: Number(e.target.value) })}
              placeholder="10"
            />
            <Input
              label="Initial Opening Stock"
              type="number"
              value={formData.openingStock || ''}
              onChange={(e) => setFormData({ ...formData, openingStock: Number(e.target.value) })}
              placeholder="0"
            />
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-border">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting}>
              Save Product
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
