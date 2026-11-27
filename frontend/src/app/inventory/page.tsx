"use client";
import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyState,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Package,
  Plus,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

type Tab =
  | "overview"
  | "products"
  | "levels"
  | "movements"
  | "transfers"
  | "reports";
type PaginatedList = "products" | "levels" | "movements" | "transfers";
type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};
const PAGE_SIZE = 10;
const emptyPaginationMeta: PaginationMeta = {
  total: 0,
  page: 1,
  limit: PAGE_SIZE,
  totalPages: 1,
  hasNextPage: false,
  hasPrevPage: false,
};
const tabs = [
  "overview",
  "products",
  "levels",
  "movements",
  "transfers",
  "reports",
].map((id) => ({
  id,
  label: id === "levels" ? "Stock Levels" : id[0].toUpperCase() + id.slice(1),
}));
const money = (n: any) =>
  `₹ ${Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [products, setProducts] = useState<any[]>([]);
  const [inventoryVariants, setInventoryVariants] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<
    "product" | "operation" | "transfer" | null
  >(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [units, setUnits] = useState<any[]>([]);
  const [taxRates, setTaxRates] = useState<any[]>([]);
  const { toast } = useToast();
  const [transferMovements, setTransferMovements] = useState<any[]>([]);
  const [pages, setPages] = useState<Record<PaginatedList, number>>({
    products: 1,
    levels: 1,
    movements: 1,
    transfers: 1,
  });
  const [pageMeta, setPageMeta] = useState<
    Record<PaginatedList, PaginationMeta>
  >({
    products: { ...emptyPaginationMeta },
    levels: { ...emptyPaginationMeta },
    movements: { ...emptyPaginationMeta },
    transfers: { ...emptyPaginationMeta },
  });
  const [form, setForm] = useState<any>({
    name: "",
    sku: "",
    barcode: "",
    hsnCode: "",
    description: "",
    purchasePrice: "",
    mrp: "",
    retailPrice: "",
    minStockLevel: "",
    unitId: "",
    taxRateId: "",
    isTaxInclusive: false,
    hasVariants: false,
    variants: [],
    attributeDefinitions: [],
    stockAllocations: [],
  });
  const [operation, setOperation] = useState<any>({
    type: "IN",
    variantId: "",
    branchId: "",
    quantity: 1,
    unitCost: 0,
    reason: "",
    reference: "",
  });
  const [transfer, setTransfer] = useState<any>({
    variantId: "",
    fromBranchId: "",
    toBranchId: "",
    quantity: 1,
    reason: "",
  });
  const [expandedProducts, setExpandedProducts] = useState<string[]>([]);
  const loadInventoryVariants = async () => {
    try {
      const data = await apiFetch("/products/inventory/variants");
      setInventoryVariants(data || []);
    } catch (error: any) {
      toast({
        type: "error",
        title: "Unable to load inventory variants",
        message: error.message,
      });
    }
  };
  const load = async () => {
    setLoading(true);
    try {
      const [p, o, b, m, tr, br, u, t] = await Promise.all([
        apiFetch("/products", {
          params: { search, page: pages.products, limit: PAGE_SIZE },
        }),
        apiFetch("/products/inventory/overview"),
        apiFetch("/products/inventory/balances", {
          params: { search, page: pages.levels, limit: PAGE_SIZE },
        }),
        apiFetch("/products/inventory/movements", {
          params: { search, page: pages.movements, limit: PAGE_SIZE },
        }),
        apiFetch("/products/inventory/movements", {
          params: {
            search,
            page: pages.transfers,
            limit: PAGE_SIZE,
            transfersOnly: true,
          },
        }),
        apiFetch("/products/inventory/branches"),
        apiFetch("/products/meta/units"),
        apiFetch("/products/meta/tax-rates"),
      ]);
      setProducts(p?.data || []);
      setOverview(o || {});
      setBalances(b?.data || []);
      setMovements(m?.data || []);
      setTransferMovements(tr?.data || []);
      setPageMeta({
        products: p?.meta || { ...emptyPaginationMeta },
        levels: b?.meta || { ...emptyPaginationMeta },
        movements: m?.meta || { ...emptyPaginationMeta },
        transfers: tr?.meta || { ...emptyPaginationMeta },
      });
      setBranches(br || []);
      setUnits(u || []);
      setTaxRates(t || []);
      if (!form.unitId)
        setForm((x: any) => ({
          ...x,
          unitId:
            u?.find((unit: any) => unit.isDefault)?.id || u?.[0]?.id || "",
          taxRateId:
            t?.find((tax: any) => tax.isDefault)?.id || t?.[0]?.id || "",
        }));
    } catch (e: any) {
      toast({
        type: "error",
        title: "Inventory failed to load",
        message: e.message,
      });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [search, pages]);
  useEffect(() => {
    loadInventoryVariants();
  }, []);
  const changePage = (list: PaginatedList, page: number) =>
    setPages((current) => ({ ...current, [list]: page }));
  const variants = inventoryVariants;
  const submit = async (
    url: string,
    body: any,
    title: string,
    method = "POST",
  ) => {
    try {
      setSubmitting(true);
      let payload =
        url === "/products/inventory/operations"
          ? {
              ...body,
              quantity: numberValue(body.quantity),
              unitCost: numberValue(body.unitCost),
            }
          : url === "/products/inventory/transfers"
            ? { ...body, quantity: numberValue(body.quantity) }
            : body;
      if (url === "/products" || method === "PATCH") {
        const { attributeDefinitions, ...productFields } = body;
        payload = {
          ...productFields,
          purchasePrice: numberValue(body.purchasePrice),
          mrp: numberValue(body.mrp),
          retailPrice: numberValue(body.retailPrice),
          minStockLevel: numberValue(body.minStockLevel),
          variants: (body.variants || []).map((variant: any) => ({
            ...variant,
            purchasePrice: numberValue(variant.purchasePrice),
            mrp: numberValue(variant.mrp),
            retailPrice: numberValue(variant.retailPrice),
            minStockLevel: numberValue(variant.minStockLevel),
          })),
          stockAllocations: (body.stockAllocations || []).map(
            (allocation: any) => ({
              ...allocation,
              quantity: numberValue(allocation.quantity),
            }),
          ),
        };
      }
      await apiFetch(url, { method, body: JSON.stringify(payload) });
      toast({
        type: "success",
        title,
        message:
          url === "/products" || method === "PATCH"
            ? "Product details saved."
            : "Balances and movement history updated.",
      });
      if (url === "/products" || method === "PATCH") {
        setForm({
          name: "",
          sku: "",
          barcode: "",
          hsnCode: "",
          description: "",
          purchasePrice: "",
          mrp: "",
          retailPrice: "",
          minStockLevel: "",
          unitId:
            units.find((unit: any) => unit.isDefault)?.id || units[0]?.id || "",
          taxRateId:
            taxRates.find((tax: any) => tax.isDefault)?.id ||
            taxRates[0]?.id ||
            "",
          isTaxInclusive: false,
          hasVariants: false,
          variants: [],
          attributeDefinitions: [],
          stockAllocations: [],
        });
        setEditingProduct(null);
        await loadInventoryVariants();
      }
      setModal(null);
      load();
    } catch (e: any) {
      toast({ type: "error", title: "Operation failed", message: e.message });
    } finally {
      setSubmitting(false);
    }
  };
  const numberValue = (value: any, fallback = 0) =>
    value === "" || value === undefined || value === null
      ? fallback
      : Number(value);
  const saveProduct = (e: any) => {
    e.preventDefault();
    if (!form.name.trim() || !form.sku.trim())
      return toast({
        type: "warning",
        title: "Required fields",
        message: "Product name and SKU are required.",
      });
    if (!form.unitId || !form.taxRateId)
      return toast({
        type: "warning",
        title: "Metadata required",
        message: "Select a unit and GST rate before saving.",
      });
    if (form.hasVariants && !form.variants.length)
      return toast({
        type: "warning",
        title: "Variants required",
        message: "Generate at least one product variant.",
      });
    submit(
      editingProduct ? `/products/${editingProduct.id}` : "/products",
      form,
      editingProduct ? "Product updated" : "Product created",
      editingProduct ? "PATCH" : "POST",
    );
  };
  const openEditProduct = (product: any) => {
    setSelectedProduct(null);
    setEditingProduct(product);
    const variantRows = (product.variants || [])
      .filter((variant: any) => variant.combinationKey)
      .map((variant: any) => ({
        ...variant,
        purchasePrice: Number(variant.purchasePrice || 0),
        mrp: Number(variant.mrp || 0),
        retailPrice: Number(variant.retailPrice || 0),
        minStockLevel: Number(variant.minStockLevel || 0),
      }));
    const attributeNames = Array.from(
      new Set(
        variantRows.flatMap((variant: any) =>
          Object.keys(variant.attributes || {}),
        ),
      ),
    );
    const attributeDefinitions = attributeNames.map((name: any) => ({
      name,
      values: Array.from(
        new Set(
          variantRows
            .map((variant: any) => variant.attributes?.[name])
            .filter(Boolean),
        ),
      ).join(", "),
    }));
    const standard = (product.variants || []).find(
      (variant: any) => variant.name === "Standard",
    );
    const stockAllocations = product.hasVariants
      ? []
      : (standard?.stockBalances || [])
          .filter((balance: any) => Number(balance.quantity) > 0)
          .map((balance: any) => ({
            branchId: balance.branchId,
            sku: "",
            quantity: Number(balance.quantity),
          }));
    setForm({
      name: product.name || "",
      sku: product.sku || "",
      barcode: product.barcode || "",
      hsnCode: product.hsnCode || "",
      description: product.description || "",
      purchasePrice: Number(product.purchasePrice || 0),
      mrp: Number(product.mrp || 0),
      retailPrice: Number(product.retailPrice || 0),
      minStockLevel: Number(product.minStockLevel || 0),
      unitId: product.unitId || "",
      taxRateId: product.taxRateId || "",
      isTaxInclusive: product.isTaxInclusive ?? false,
      imageUrl: product.imageUrl || "",
      hasVariants: Boolean(product.hasVariants),
      variants: variantRows,
      attributeDefinitions,
      stockAllocations,
    });
    setModal("product");
  };
  const stat = (label: string, value: any, icon: any, tone = "text-accent") => (
    <Card className="h-full">
      <CardContent className="flex min-h-[88px] items-center gap-3 p-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent-subtle ${tone}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] leading-tight text-text-secondary">
            {label}
          </div>
          <div className="mt-1 truncate text-lg font-semibold text-text-primary">
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
  const showSearch = ["products", "levels", "movements", "transfers"].includes(
    tab,
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-primary">
            Inventory &amp; Stock
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            Product masters, stock balances, movements and valuation.
          </p>
        </div>
        <div className="flex shrink-0 gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="secondary"
            onClick={load}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setEditingProduct(null);
              setForm({
                name: "",
                sku: "",
                barcode: "",
                hsnCode: "",
                description: "",
                purchasePrice: "",
                mrp: "",
                retailPrice: "",
                minStockLevel: "",
                unitId:
                  units.find((unit: any) => unit.isDefault)?.id ||
                  units[0]?.id ||
                  "",
                taxRateId:
                  taxRates.find((tax: any) => tax.isDefault)?.id ||
                  taxRates[0]?.id ||
                  "",
                isTaxInclusive: false,
                hasVariants: false,
                variants: [],
                attributeDefinitions: [],
                stockAllocations: [],
              });
              setModal("product");
            }}
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add Product
          </Button>
        </div>
      </header>

      <div className="min-w-0 overflow-hidden">
        <Tabs
          tabs={tabs}
          activeTab={tab}
          onChange={(id) => setTab(id as Tab)}
          className="w-full overflow-x-auto whitespace-nowrap"
        />
      </div>

      {showSearch && (
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full max-w-sm">
            <Input
              placeholder="Search products, SKU or barcode..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPages({
                  products: 1,
                  levels: 1,
                  movements: 1,
                  transfers: 1,
                });
              }}
            />
          </div>
          {(tab === "movements" || tab === "transfers") && (
            <Button
              size="sm"
              variant="primary"
              className="w-full shrink-0 sm:w-auto"
              onClick={() => {
                if (tab === "transfers") {
                  setModal("transfer");
                } else {
                  setOperation({ ...operation, type: "IN" });
                  setModal("operation");
                }
              }}
              icon={<Plus className="h-3.5 w-3.5" />}
            >
              {tab === "transfers" ? "Transfer stock" : "Record movement"}
            </Button>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Skeleton className="h-[88px] w-full" />
            <Skeleton className="h-[88px] w-full" />
            <Skeleton className="h-[88px] w-full" />
            <Skeleton className="h-[88px] w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="min-w-0">
          {tab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {stat(
                  "Total products",
                  overview.totalProducts || 0,
                  <Package className="h-4 w-4" />,
                )}
                {stat(
                  "Inventory valuation",
                  money(overview.inventoryValuation),
                  <Boxes className="h-4 w-4" />,
                )}
                {stat(
                  "Low-stock products",
                  overview.lowStockProducts || 0,
                  <AlertTriangle className="h-4 w-4" />,
                  "text-warning",
                )}
                {stat(
                  "Out of stock",
                  overview.outOfStockProducts || 0,
                  <ClipboardList className="h-4 w-4" />,
                  "text-danger",
                )}
              </div>
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Recent stock movements</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <MovementTable rows={overview.recentMovements || []} />
                </CardContent>
              </Card>
            </div>
          )}

          {tab === "products" && (
            <div className="space-y-3">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">SKU</TableHead>
                    <TableHead className="min-w-[200px]">Product</TableHead>
                    <TableHead className="whitespace-nowrap">GST</TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Purchase
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Retail
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Stock
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.length ? (
                    products.map((product) => (
                      <React.Fragment key={product.id}>
                        <TableRow>
                          <TableCell className="whitespace-nowrap font-mono text-accent">
                            {product.hasVariants && (
                              <button
                                type="button"
                                className="mr-2 inline-flex items-center text-text-secondary hover:text-accent"
                                aria-label={`${expandedProducts.includes(product.id) ? "Collapse" : "Expand"} variants for ${product.name}`}
                                aria-expanded={expandedProducts.includes(
                                  product.id,
                                )}
                                onClick={() =>
                                  setExpandedProducts((current) =>
                                    current.includes(product.id)
                                      ? current.filter(
                                          (id) => id !== product.id,
                                        )
                                      : [...current, product.id],
                                  )
                                }
                              >
                                <ChevronRight
                                  className={`h-3.5 w-3.5 transition-transform ${expandedProducts.includes(product.id) ? "rotate-90" : ""}`}
                                />
                              </button>
                            )}
                            <button
                              type="button"
                              className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                              onClick={() => setSelectedProduct(product)}
                              aria-label={`View details for SKU ${product.sku}`}
                            >
                              {product.sku}
                            </button>
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <button
                              type="button"
                              className="text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                              onClick={() => setSelectedProduct(product)}
                              aria-label={`View details for ${product.name}`}
                            >
                              <div className="font-medium">{product.name}</div>
                              <div className="text-[11px] text-text-tertiary">
                                {product.hasVariants
                                  ? `${(product.variants || []).filter((variant: any) => variant.combinationKey).length} variants`
                                  : product.barcode || "No barcode"}
                              </div>
                            </button>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div>{product.taxRate?.name || "—"}</div>
                            <div className="text-[11px] text-text-tertiary">
                              {product.isTaxInclusive
                                ? "GST inclusive"
                                : "GST exclusive"}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {money(product.purchasePrice)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            {money(product.retailPrice)}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right font-mono">
                            {Number(product.totalStock || 0)}{" "}
                            {product.unit?.symbol}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {product.totalStock <= 0 ? (
                              <Badge size="sm" variant="danger">
                                Out
                              </Badge>
                            ) : product.isLowStock ? (
                              <Badge size="sm" variant="warning">
                                Low
                              </Badge>
                            ) : (
                              <Badge size="sm" variant="success">
                                Healthy
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => openEditProduct(product)}
                            >
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                        {product.hasVariants &&
                          expandedProducts.includes(product.id) &&
                          (product.variants || [])
                            .filter((variant: any) => variant.combinationKey)
                            .map((variant: any) => (
                              <TableRow
                                key={variant.id}
                                className="bg-surface-secondary/30"
                              >
                                <TableCell className="whitespace-nowrap pl-10 font-mono text-xs text-accent">
                                  {variant.sku}
                                </TableCell>
                                <TableCell className="min-w-[200px]">
                                  <div className="font-medium">
                                    {variant.attributeSearch || variant.name}
                                  </div>
                                  <div className="text-[11px] text-text-tertiary">
                                    {variant.barcode || "No barcode"}
                                  </div>
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-text-tertiary">
                                  Inherited
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right">
                                  {money(variant.purchasePrice)}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right">
                                  {money(
                                    variant.retailPrice ?? product.retailPrice,
                                  )}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right font-mono">
                                  {Number(variant.totalStock || 0)}{" "}
                                  {product.unit?.symbol}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {!variant.isActive ? (
                                    <Badge size="sm" variant="neutral">
                                      Inactive
                                    </Badge>
                                  ) : variant.totalStock <= 0 ? (
                                    <Badge size="sm" variant="danger">
                                      Out
                                    </Badge>
                                  ) : variant.isLowStock ? (
                                    <Badge size="sm" variant="warning">
                                      Low
                                    </Badge>
                                  ) : (
                                    <Badge size="sm" variant="success">
                                      Healthy
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-right">
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openEditProduct(product)}
                                  >
                                    Edit
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                      </React.Fragment>
                    ))
                  ) : (
                    <TableEmptyState message="No products found." />
                  )}
                </TableBody>
              </Table>
              <Pagination
                meta={pageMeta.products}
                onPageChange={(page) => changePage("products", page)}
              />
            </div>
          )}

          {tab === "levels" && (
            <div className="space-y-3">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[220px]">Product</TableHead>
                    <TableHead className="min-w-[160px]">Branch</TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Quantity
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Average cost
                    </TableHead>
                    <TableHead className="whitespace-nowrap text-right">
                      Valuation
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.length ? (
                    balances.map((balance) => (
                      <TableRow key={balance.id}>
                        <TableCell>
                          <div className="font-medium">
                            {balance.variant.product.name}
                          </div>
                          <div className="text-[11px] text-text-tertiary">
                            {balance.variant.sku}
                          </div>
                          {balance.variant.attributeSearch && (
                            <div className="text-[10px] text-text-tertiary">
                              {balance.variant.attributeSearch}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{balance.branch.name}</TableCell>
                        <TableCell className="whitespace-nowrap text-right font-mono">
                          {Number(balance.quantity)}{" "}
                          {balance.variant.product.unit?.symbol}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {money(balance.averageCost)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right font-semibold">
                          {money(
                            Number(balance.quantity) *
                              Number(balance.averageCost),
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableEmptyState message="No stock balances found." />
                  )}
                </TableBody>
              </Table>
              <Pagination
                meta={pageMeta.levels}
                onPageChange={(page) => changePage("levels", page)}
              />
            </div>
          )}

          {(tab === "movements" || tab === "transfers") && (
            <div className="space-y-3">
              <MovementTable
                rows={tab === "transfers" ? transferMovements : movements}
              />
              <Pagination
                meta={
                  tab === "transfers" ? pageMeta.transfers : pageMeta.movements
                }
                onPageChange={(page) =>
                  changePage(
                    tab === "transfers" ? "transfers" : "movements",
                    page,
                  )
                }
              />
            </div>
          )}

          {tab === "reports" && (
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Report title="Stock summary & valuation" kind="summary" />
              <Report title="Low stock report" kind="low-stock" />
              <Report title="Dead stock" kind="dead-stock" />
            </div>
          )}
        </div>
      )}

      <ProductModal
        open={modal === "product"}
        close={() => {
          setModal(null);
          setEditingProduct(null);
        }}
        form={form}
        setForm={setForm}
        units={units}
        taxes={taxRates}
        branches={branches}
        product={editingProduct}
        submit={saveProduct}
        submitting={submitting}
        editing={Boolean(editingProduct)}
      />
      <ProductDetailsModal
        product={selectedProduct}
        close={() => setSelectedProduct(null)}
        edit={openEditProduct}
      />
      <OperationModal
        open={modal === "operation"}
        close={() => setModal(null)}
        data={operation}
        setData={setOperation}
        variants={variants}
        branches={branches}
        submit={(event: any) => {
          event.preventDefault();
          submit(
            "/products/inventory/operations",
            operation,
            "Stock movement recorded",
          );
        }}
        submitting={submitting}
      />
      <TransferModal
        open={modal === "transfer"}
        close={() => setModal(null)}
        data={transfer}
        setData={setTransfer}
        variants={variants}
        branches={branches}
        submit={(event: any) => {
          event.preventDefault();
          submit(
            "/products/inventory/transfers",
            transfer,
            "Stock transferred",
          );
        }}
        submitting={submitting}
      />
    </div>
  );
}

function MovementTable({ rows }: { rows: any[] }) {
  return (
    <Table className="min-w-[820px]">
      <TableHeader>
        <TableRow>
          <TableHead className="whitespace-nowrap">Date</TableHead>
          <TableHead className="min-w-[180px]">Product</TableHead>
          <TableHead className="min-w-[140px]">Branch</TableHead>
          <TableHead className="whitespace-nowrap">Type</TableHead>
          <TableHead className="whitespace-nowrap text-right">Qty</TableHead>
          <TableHead className="min-w-[200px]">Reason / reference</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows?.length ? (
          rows.map((movement) => (
            <TableRow key={movement.id}>
              <TableCell className="whitespace-nowrap">
                {new Date(movement.createdAt).toLocaleString()}
              </TableCell>
              <TableCell>
                <div>{movement.variant?.product?.name || "—"}</div>
                <div className="text-[11px] text-text-tertiary">
                  {movement.variant?.sku || ""}
                </div>
                {movement.variant?.attributeSearch && (
                  <div className="text-[10px] text-text-tertiary">
                    {movement.variant.attributeSearch}
                  </div>
                )}
              </TableCell>
              <TableCell>{movement.branch?.name || "—"}</TableCell>
              <TableCell className="whitespace-nowrap">
                <Badge
                  size="sm"
                  variant={
                    String(movement.type).includes("OUT") ? "danger" : "success"
                  }
                >
                  {movement.type}
                </Badge>
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono">
                {Number(movement.quantity)}
              </TableCell>
              <TableCell>{movement.reason || movement.notes || "—"}</TableCell>
            </TableRow>
          ))
        ) : (
          <TableEmptyState message="No stock movements found." />
        )}
      </TableBody>
    </Table>
  );
}

function Pagination({
  meta,
  onPageChange,
}: {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}) {
  const firstRecord = meta.total ? (meta.page - 1) * meta.limit + 1 : 0;
  const lastRecord = Math.min(meta.page * meta.limit, meta.total);
  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-text-secondary">
        Showing {firstRecord}-{lastRecord} of {meta.total}
      </p>
      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <Button
          size="sm"
          variant="secondary"
          disabled={!meta.hasPrevPage}
          onClick={() => onPageChange(meta.page - 1)}
          icon={<ChevronLeft className="h-3.5 w-3.5" />}
        >
          Previous
        </Button>
        <span className="min-w-[5rem] text-center text-xs text-text-secondary">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={!meta.hasNextPage}
          onClick={() => onPageChange(meta.page + 1)}
          icon={<ChevronRight className="h-3.5 w-3.5" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

function Field({ form, setForm, k, label, type = "text" }: any) {
  return (
    <Input
      label={label}
      type={type}
      value={form[k] ?? ""}
      onChange={(e: any) =>
        setForm({
          ...form,
          [k]:
            type === "number"
              ? e.target.value === ""
                ? ""
                : Number(e.target.value)
              : e.target.value,
        })
      }
    />
  );
}
function UnitPicker({ units, value, onChange }: any) {
  const selectableUnits = units.filter(
    (unit: any) => unit.isQuickSelect || unit.id === value,
  );

  return (
    <Select
      id="product-unit-picker"
      label="Unit *"
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Select a unit</option>
      {selectableUnits.map((unit: any) => (
        <option key={unit.id} value={unit.id}>
          {unit.symbol} - {unit.name}
        </option>
      ))}
    </Select>
  );
}

function ProductModal({
  open,
  close,
  form,
  setForm,
  units,
  taxes,
  branches,
  product,
  submit,
  submitting,
  editing,
}: any) {
  const { toast } = useToast();
  const handleImageUpload = (file?: File) => {
    if (!file) return;
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 1024 * 1024
    ) {
      toast({
        type: "error",
        title: "Unsupported file",
        message: "Please choose a PNG, JPEG, or WebP image up to 1 MB.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        toast({
          type: "error",
          title: "Upload failed",
          message: "The selected image could not be read.",
        });
        return;
      }
      setForm((current: any) => ({ ...current, imageUrl: reader.result }));
    };
    reader.onerror = () =>
      toast({
        type: "error",
        title: "Upload failed",
        message: "The selected image could not be read.",
      });
    reader.readAsDataURL(file);
  };
  return (
    <Modal
      isOpen={open}
      onClose={close}
      title={editing ? "Edit inventory product" : "Create inventory product"}
      description={
        editing
          ? "Update the product master details."
          : "Product master details."
      }
      maxWidth="3xl"
    >
      <form
        onSubmit={submit}
        className="flex max-h-[calc(100dvh-12rem)] flex-col"
      >
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <section className="space-y-3 rounded-lg border border-border bg-surface-secondary/20 p-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Product details
                </h4>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Name, identifiers and measurement unit.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field
                    form={form}
                    setForm={setForm}
                    k="name"
                    label="Product name *"
                  />
                </div>
                <Field form={form} setForm={setForm} k="sku" label="SKU *" />
                <Field
                  form={form}
                  setForm={setForm}
                  k="barcode"
                  label="Barcode"
                />
                <div className="sm:col-span-2">
                  <Field
                    form={form}
                    setForm={setForm}
                    k="hsnCode"
                    label="HSN code"
                  />
                </div>
                <div className="sm:col-span-2">
                  <UnitPicker
                    units={units}
                    value={form.unitId}
                    onChange={(unitId: string) =>
                      setForm((current: any) => ({ ...current, unitId }))
                    }
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border bg-surface-secondary/20 p-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Pricing &amp; GST
                </h4>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Set prices and how GST is applied.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  form={form}
                  setForm={setForm}
                  k="purchasePrice"
                  label="Purchase price"
                  type="number"
                />
                <Field
                  form={form}
                  setForm={setForm}
                  k="mrp"
                  label="MRP"
                  type="number"
                />
                <div className="col-span-2">
                  <Field
                    form={form}
                    setForm={setForm}
                    k="retailPrice"
                    label="Retail price"
                    type="number"
                  />
                </div>
                <div className="col-span-2">
                  <Select
                    label="GST rate *"
                    value={form.taxRateId}
                    disabled={!taxes.length}
                    onChange={(e) =>
                      setForm({ ...form, taxRateId: e.target.value })
                    }
                  >
                    <option value="">
                      {taxes.length
                        ? "Select GST rate"
                        : "No GST rates configured"}
                    </option>
                    {taxes.map((tax: any) => (
                      <option key={tax.id} value={tax.id}>
                        {tax.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
                  <div>
                    <p className="text-xs font-medium text-text-primary">
                      Inclusive GST
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-tertiary">
                      {form.isTaxInclusive
                        ? "Product price includes GST."
                        : "GST is exclusive of product price."}
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(form.isTaxInclusive)}
                    onChange={(isTaxInclusive: boolean) =>
                      setForm((current: any) => ({
                        ...current,
                        isTaxInclusive,
                      }))
                    }
                    label={form.isTaxInclusive ? "On" : "Off"}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border bg-surface-secondary/20 p-3 sm:col-span-2">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Product variants
                </h4>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Optional; configure combinations when the product has
                  variants.
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
                <p className="text-xs text-text-secondary">
                  This product comes in multiple options
                </p>
                <Switch
                  checked={Boolean(form.hasVariants)}
                  disabled={Boolean(product?.hasVariants)}
                  onChange={(hasVariants: boolean) =>
                    setForm((current: any) => ({
                      ...current,
                      hasVariants,
                      variants: hasVariants ? current.variants : [],
                    }))
                  }
                  label={form.hasVariants ? "On" : "Off"}
                />
              </div>
              {form.hasVariants && (
                <VariantBuilder
                  form={form}
                  setForm={setForm}
                  editing={editing}
                  product={product}
                  branches={branches}
                />
              )}
            </section>

            <section className="space-y-3 rounded-lg border border-border bg-surface-secondary/20 p-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Stock threshold
                </h4>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Used to flag products that need replenishment.
                </p>
              </div>
              {!form.hasVariants && (
                <Field
                  form={form}
                  setForm={setForm}
                  k="minStockLevel"
                  label="Minimum stock"
                  type="number"
                />
              )}
              {form.hasVariants && (
                <p className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-secondary">
                  Minimum stock is configured separately for each variant.
                </p>
              )}
            </section>

            <section className="space-y-3 rounded-lg border border-border bg-surface-secondary/20 p-3">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Product image
                </h4>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Optional image for quick identification.
                </p>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-secondary hover:border-accent">
                    {form.imageUrl ? (
                      <img
                        src={form.imageUrl}
                        alt="Product image preview"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <Upload className="h-5 w-5 text-text-tertiary" />
                    )}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label="Upload product image"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        handleImageUpload(file);
                      }}
                    />
                  </label>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-text-primary">
                      Click the preview to upload or replace
                    </p>
                    <p className="text-[11px] text-text-tertiary">
                      PNG, JPG, or WebP · Max size: 1 MB
                    </p>
                  </div>
                </div>
                {form.imageUrl && (
                  <button
                    type="button"
                    className="self-start text-[11px] font-medium text-danger hover:underline sm:self-center"
                    onClick={() =>
                      setForm((current: any) => ({ ...current, imageUrl: "" }))
                    }
                  >
                    Remove image
                  </button>
                )}
              </div>
            </section>

            <section className="space-y-3 rounded-lg border border-border bg-surface-secondary/20 p-3 sm:col-span-2">
              <div>
                <h4 className="text-sm font-semibold text-text-primary">
                  Description
                </h4>
                <p className="mt-0.5 text-[11px] text-text-tertiary">
                  Optional details about the product.
                </p>
              </div>
              <Field
                form={form}
                setForm={setForm}
                k="description"
                label="Product description"
              />
            </section>
          </div>
        </div>
        <div className="mt-4 flex shrink-0 justify-end gap-2 border-t border-border bg-surface pt-3">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            {editing ? "Save changes" : "Save product"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function VariantBuilder({ form, setForm, editing, product, branches }: any) {
  const { toast } = useToast();
  const definitions = form.attributeDefinitions || [];
  const variants = form.variants || [];
  const setDefinition = (index: number, key: string, value: string) => {
    setForm((current: any) => ({
      ...current,
      attributeDefinitions: current.attributeDefinitions.map(
        (definition: any, i: number) =>
          i === index ? { ...definition, [key]: value } : definition,
      ),
    }));
  };
  const combinationKey = (attributes: any) =>
    Object.entries(attributes || {})
      .sort(([a], [b]) =>
        a.localeCompare(b, undefined, { sensitivity: "base" }),
      )
      .map(
        ([key, value]) =>
          `${key.toLowerCase()}=${String(value).trim().toLowerCase()}`,
      )
      .join("&");
  const generate = () => {
    const parsed = definitions.map((definition: any) => ({
      name: String(definition.name || "").trim(),
      values: String(definition.values || "")
        .split(",")
        .map((value: string) => value.trim())
        .filter(Boolean),
    }));
    if (
      !parsed.length ||
      parsed.some(
        (definition: any) => !definition.name || !definition.values.length,
      )
    ) {
      toast({
        type: "warning",
        title: "Variant attributes required",
        message:
          "Enter each attribute name and at least one comma-separated value.",
      });
      return;
    }
    if (
      new Set(parsed.map((definition: any) => definition.name.toLowerCase()))
        .size !== parsed.length
    ) {
      toast({
        type: "warning",
        title: "Duplicate attribute",
        message: "Attribute names must be unique.",
      });
      return;
    }
    const combinations: any[] = [];
    const build = (index: number, attributes: any) => {
      if (index === parsed.length) {
        combinations.push(attributes);
        return;
      }
      const current = parsed[index];
      current.values.forEach((value: string) =>
        build(index + 1, { ...attributes, [current.name]: value }),
      );
    };
    build(0, {});
    const previous = new Map(
      variants.map((variant: any) => [
        combinationKey(variant.attributes),
        variant,
      ]),
    );
    const generated = combinations.map((attributes: any) => {
      const existing: any = previous.get(combinationKey(attributes));
      const suffix = Object.values(attributes)
        .join("-")
        .normalize("NFKD")
        .replace(/[^a-zA-Z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toUpperCase();
      return (
        existing || {
          sku: `${String(form.sku || "PRODUCT").trim()}-${suffix}`,
          barcode: "",
          attributes,
          attributeSearch: Object.entries(attributes)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" "),
          purchasePrice: Number(form.purchasePrice || 0),
          mrp: Number(form.mrp || 0),
          retailPrice: Number(form.retailPrice || 0),
          minStockLevel: Number(form.minStockLevel || 0),
          imageUrl: "",
          isActive: true,
        }
      );
    });
    setForm((current: any) => ({
      ...current,
      attributeDefinitions: parsed.map((definition: any) => ({
        ...definition,
        values: definition.values.join(", "),
      })),
      variants: generated,
    }));
  };
  const updateVariant = (index: number, key: string, value: any) =>
    setForm((current: any) => ({
      ...current,
      variants: current.variants.map((variant: any, i: number) =>
        i === index ? { ...variant, [key]: value } : variant,
      ),
    }));
  const sourceBalances =
    product && !product.hasVariants
      ? (product.variants || [])
          .find((variant: any) => variant.name === "Standard")
          ?.stockBalances?.filter(
            (balance: any) => Number(balance.quantity) > 0,
          ) || []
      : [];
  const allocations = form.stockAllocations || [];
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {definitions.map((definition: any, index: number) => (
          <div
            key={index}
            className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
          >
            <Input
              label="Attribute name"
              value={definition.name}
              onChange={(event) =>
                setDefinition(index, "name", event.target.value)
              }
              placeholder="e.g. Size"
            />
            <Input
              label="Values (comma separated)"
              value={definition.values}
              onChange={(event) =>
                setDefinition(index, "values", event.target.value)
              }
              placeholder="e.g. Small, Medium, Large"
            />
            <Button
              type="button"
              size="sm"
              onClick={() =>
                setForm((current: any) => ({
                  ...current,
                  attributeDefinitions: current.attributeDefinitions.filter(
                    (_: any, i: number) => i !== index,
                  ),
                }))
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setForm((current: any) => ({
                ...current,
                attributeDefinitions: [
                  ...current.attributeDefinitions,
                  { name: "", values: "" },
                ],
              }))
            }
            icon={<Plus className="h-3.5 w-3.5" />}
          >
            Add attribute
          </Button>
          <Button type="button" size="sm" variant="primary" onClick={generate}>
            Generate combinations
          </Button>
        </div>
      </div>
      {variants.length > 0 && (
        <div className="space-y-3">
          <h5 className="text-xs font-medium text-text-primary">
            {variants.length} variant combinations
          </h5>
          {variants.map((variant: any, index: number) => (
            <div
              key={
                variant.id || `${combinationKey(variant.attributes)}-${index}`
              }
              className="space-y-3 rounded-lg border border-border bg-surface-secondary/30 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary">
                    {variant.attributeSearch ||
                      Object.entries(variant.attributes || {})
                        .map(([key, value]) => `${key}: ${value}`)
                        .join(" · ")}
                  </p>
                  <label className="mt-1 flex items-center gap-2 text-[11px] text-text-secondary">
                    <input
                      type="checkbox"
                      checked={variant.isActive !== false}
                      onChange={(event) =>
                        updateVariant(index, "isActive", event.target.checked)
                      }
                    />
                    Active
                  </label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() =>
                    setForm((current: any) => ({
                      ...current,
                      variants: current.variants.filter(
                        (_: any, i: number) => i !== index,
                      ),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  label="SKU"
                  required
                  value={variant.sku || ""}
                  onChange={(event) =>
                    updateVariant(index, "sku", event.target.value)
                  }
                />
                <Input
                  label="Barcode"
                  value={variant.barcode || ""}
                  onChange={(event) =>
                    updateVariant(index, "barcode", event.target.value)
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <Input
                  label="Purchase price"
                  type="number"
                  min="0"
                  value={variant.purchasePrice ?? ""}
                  onChange={(event) =>
                    updateVariant(
                      index,
                      "purchasePrice",
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    )
                  }
                />
                <Input
                  label="MRP"
                  type="number"
                  min="0"
                  value={variant.mrp ?? ""}
                  onChange={(event) =>
                    updateVariant(
                      index,
                      "mrp",
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    )
                  }
                />
                <Input
                  label="Retail price"
                  type="number"
                  min="0"
                  value={variant.retailPrice ?? ""}
                  onChange={(event) =>
                    updateVariant(
                      index,
                      "retailPrice",
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    )
                  }
                />
                <Input
                  label="Minimum stock"
                  type="number"
                  min="0"
                  value={variant.minStockLevel ?? ""}
                  onChange={(event) =>
                    updateVariant(
                      index,
                      "minStockLevel",
                      event.target.value === ""
                        ? ""
                        : Number(event.target.value),
                    )
                  }
                />
              </div>
              <Input
                label="Variant image URL (optional)"
                value={variant.imageUrl || ""}
                onChange={(event) =>
                  updateVariant(index, "imageUrl", event.target.value)
                }
              />
            </div>
          ))}
        </div>
      )}
      {editing && !product?.hasVariants && sourceBalances.length > 0 && (
        <div className="space-y-3 rounded-lg border border-warning/40 bg-warning-subtle/20 p-3">
          <div>
            <h5 className="text-xs font-semibold text-text-primary">
              Allocate existing stock
            </h5>
            <p className="mt-1 text-[11px] text-text-secondary">
              For each branch, allocations must add up to its current stock.
              Existing movement history is retained.
            </p>
          </div>
          {allocations.map((allocation: any, index: number) => (
            <div
              key={`${allocation.branchId}-${index}`}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto]"
            >
              <Select
                label="Branch"
                value={allocation.branchId}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    stockAllocations: current.stockAllocations.map(
                      (item: any, i: number) =>
                        i === index
                          ? { ...item, branchId: event.target.value }
                          : item,
                    ),
                  }))
                }
              >
                <option value="">Select branch</option>
                {branches.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
              <Select
                label="Variant"
                value={allocation.sku}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    stockAllocations: current.stockAllocations.map(
                      (item: any, i: number) =>
                        i === index
                          ? { ...item, sku: event.target.value }
                          : item,
                    ),
                  }))
                }
              >
                <option value="">Select variant</option>
                {variants.map((variant: any) => (
                  <option key={variant.id || variant.sku} value={variant.sku}>
                    {variant.sku}
                  </option>
                ))}
              </Select>
              <Input
                label="Quantity"
                type="number"
                min="0"
                step="0.01"
                value={allocation.quantity}
                onChange={(event) =>
                  setForm((current: any) => ({
                    ...current,
                    stockAllocations: current.stockAllocations.map(
                      (item: any, i: number) =>
                        i === index
                          ? {
                              ...item,
                              quantity:
                                event.target.value === ""
                                  ? ""
                                  : Number(event.target.value),
                            }
                          : item,
                    ),
                  }))
                }
              />
              <Button
                type="button"
                size="sm"
                onClick={() =>
                  setForm((current: any) => ({
                    ...current,
                    stockAllocations: current.stockAllocations.filter(
                      (_: any, i: number) => i !== index,
                    ),
                  }))
                }
              >
                Remove
              </Button>
            </div>
          ))}
          {sourceBalances.map(
            (balance: any) =>
              !allocations.some(
                (allocation: any) => allocation.branchId === balance.branchId,
              ) && (
                <div
                  key={balance.branchId}
                  className="text-[11px] text-text-secondary"
                >
                  {balance.branch?.name || "Branch"}: {Number(balance.quantity)}{" "}
                  units are not allocated.
                </div>
              ),
          )}
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              setForm((current: any) => ({
                ...current,
                stockAllocations: [
                  ...current.stockAllocations,
                  {
                    branchId: sourceBalances[0]?.branchId || "",
                    sku: "",
                    quantity: 0,
                  },
                ],
              }))
            }
          >
            Add allocation
          </Button>
        </div>
      )}
    </div>
  );
}

function ProductDetailsModal({ product, close, edit }: any) {
  const detail = (label: string, value: any) => (
    <div className="min-w-0">
      <dt className="text-[11px] text-text-tertiary">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-text-primary">
        {value || "—"}
      </dd>
    </div>
  );
  return (
    <Modal
      isOpen={Boolean(product)}
      onClose={close}
      title={product?.name || "Product details"}
      description="Product information and current stock."
      maxWidth="2xl"
    >
      {product && (
        <>
          <dl className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {detail("SKU", product.sku)}
            {detail("Barcode", product.barcode)}
            {detail("HSN code", product.hsnCode)}
            {detail("Unit", product.unit?.name || product.unit?.symbol)}
            {detail("GST rate", product.taxRate?.name)}
            {detail(
              "GST pricing",
              product.isTaxInclusive ? "GST inclusive" : "GST exclusive",
            )}
            {detail("Purchase price", money(product.purchasePrice))}
            {detail("MRP", money(product.mrp))}
            {detail("Retail price", money(product.retailPrice))}
            {detail(
              "Minimum stock",
              `${Number(product.minStockLevel || 0)} ${product.unit?.symbol || ""}`,
            )}
            {detail(
              "Current stock",
              `${Number(product.totalStock || 0)} ${product.unit?.symbol || ""}`,
            )}
            {detail("Status", product.isActive ? "Active" : "Inactive")}
            {product.description && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-[11px] text-text-tertiary">Description</dt>
                <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-text-primary">
                  {product.description}
                </dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-3">
            <Button onClick={close}>Close</Button>
            <Button variant="primary" onClick={() => edit(product)}>
              Edit product
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}

function OperationModal({
  open,
  close,
  data,
  setData,
  variants,
  branches,
  submit,
  submitting,
}: any) {
  const selectedVariant = variants.find(
    (variant: any) => variant.id === data.variantId,
  );
  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="Record stock movement"
      description="Record stock IN or OUT against a branch."
      maxWidth="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Operation"
            value={data.type}
            onChange={(e) => setData({ ...data, type: e.target.value })}
          >
            <option value="IN">Stock IN</option>
            <option value="OUT">Stock OUT</option>
          </Select>
          <Select
            label="Branch"
            required
            value={data.branchId}
            onChange={(e) => setData({ ...data, branchId: e.target.value })}
          >
            <option value="">Select branch</option>
            {branches.map((branch: any) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} · {branch.code}
              </option>
            ))}
          </Select>
        </div>
        <Select
          label="Product"
          required
          value={data.variantId}
          onChange={(e) => setData({ ...data, variantId: e.target.value })}
        >
          <option value="">Select product</option>
          {variants.map((variant: any) => (
            <option key={variant.id} value={variant.id}>
              {variant.productName} ·{" "}
              {variant.attributeSearch ? `${variant.attributeSearch} · ` : ""}
              {variant.sku}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Quantity *"
            type="number"
            min="0.01"
            step={
              selectedVariant?.unit?.quantityType === "WHOLE" ? "1" : "0.01"
            }
            required
            value={data.quantity}
            onChange={(e) => setData({ ...data, quantity: e.target.value })}
          />
          <Input
            label="Unit cost"
            type="number"
            min="0"
            step="0.01"
            value={data.unitCost}
            onChange={(e) => setData({ ...data, unitCost: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Reason"
            value={data.reason}
            onChange={(e) => setData({ ...data, reason: e.target.value })}
          />
          <Input
            label="Reference"
            value={data.reference}
            onChange={(e) => setData({ ...data, reference: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Record movement
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TransferModal({
  open,
  close,
  data,
  setData,
  variants,
  branches,
  submit,
  submitting,
}: any) {
  const selectedVariant = variants.find(
    (variant: any) => variant.id === data.variantId,
  );
  return (
    <Modal
      isOpen={open}
      onClose={close}
      title="Transfer stock"
      description="Moves stock between branches without changing business-wide stock."
      maxWidth="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <Select
          label="Product"
          required
          value={data.variantId}
          onChange={(e) => setData({ ...data, variantId: e.target.value })}
        >
          <option value="">Select product</option>
          {variants.map((variant: any) => (
            <option key={variant.id} value={variant.id}>
              {variant.productName} ·{" "}
              {variant.attributeSearch ? `${variant.attributeSearch} · ` : ""}
              {variant.sku}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="From branch"
            required
            value={data.fromBranchId}
            onChange={(e) => setData({ ...data, fromBranchId: e.target.value })}
          >
            <option value="">Select branch</option>
            {branches.map((branch: any) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} · {branch.code}
              </option>
            ))}
          </Select>
          <Select
            label="To branch"
            required
            value={data.toBranchId}
            onChange={(e) => setData({ ...data, toBranchId: e.target.value })}
          >
            <option value="">Select branch</option>
            {branches.map((branch: any) => (
              <option key={branch.id} value={branch.id}>
                {branch.name} · {branch.code}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Quantity *"
            type="number"
            min="0.01"
            step={
              selectedVariant?.unit?.quantityType === "WHOLE" ? "1" : "0.01"
            }
            required
            value={data.quantity}
            onChange={(e) => setData({ ...data, quantity: e.target.value })}
          />
          <Input
            label="Reason / reference"
            value={data.reason}
            onChange={(e) => setData({ ...data, reason: e.target.value })}
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button type="button" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={submitting}>
            Transfer stock
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Report({ title, kind }: { title: string; kind: string }) {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    apiFetch("/products/inventory/reports", { params: { kind } })
      .then(setRows)
      .catch(() => undefined);
  }, [kind]);
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-h-[112px]">
        <div className="text-2xl font-semibold text-text-primary">
          {rows.length}
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          Live records from the inventory service.
        </p>
      </CardContent>
    </Card>
  );
}
