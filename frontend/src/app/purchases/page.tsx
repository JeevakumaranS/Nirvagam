"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { formatSupplierDisplayName } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyState,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import {
  PurchaseDocumentDrawer,
  PurchaseDocKind,
} from "@/components/purchases/purchase-document-drawer";
import { PurchasePrintModal } from "@/components/purchases/purchase-print-modal";
import {
  Plus,
  RefreshCw,
  Search,
  Printer,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
} from "lucide-react";

type MainTab =
  | "invoices"
  | "requests"
  | "orders"
  | "grns";

export default function PurchasesPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<MainTab>("requests");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branchStateCode, setBranchStateCode] = useState("33");
  const [taxRegime, setTaxRegime] = useState<"GST" | "VAT">("GST");
  const [cancelRequest, setCancelRequest] = useState<{ url: string } | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<any | null>(null);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKind, setDrawerKind] = useState<PurchaseDocKind>("INVOICE");
  const [drawerMode, setDrawerMode] = useState<"DIRECT" | "AGAINST_PO_GRN">(
    "DIRECT",
  );
  const [drawerPrefill, setDrawerPrefill] = useState<any>(null);

  // Print modal
  const [printState, setPrintState] = useState<{
    open: boolean;
    type: "PO" | "GRN" | "INVOICE";
    id: string | null;
  }>({
    open: false,
    type: "INVOICE",
    id: null,
  });

  const loadMasterData = useCallback(async () => {
    try {
      const [suppRes, prodRes, branchesRes, settingsRes] = await Promise.all([
        apiFetch("/suppliers"),
        apiFetch("/products"),
        apiFetch("/products/inventory/branches"),
        apiFetch("/purchases/settings").catch(() => null),
      ]);
      setSuppliers(suppRes?.data || (Array.isArray(suppRes) ? suppRes : []));
      setProducts(prodRes?.data || (Array.isArray(prodRes) ? prodRes : []));
      const branches = branchesRes?.data || (Array.isArray(branchesRes) ? branchesRes : []);
      if (settingsRes?.taxRegime) setTaxRegime(settingsRes.taxRegime);
      if (branches?.[0]?.stateCode) setBranchStateCode(branches[0].stateCode);
    } catch {}
  }, []);

  const loadTabList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiFetch(`/purchases/${tab}`, { params: { search } });
      setRows(res?.data || (Array.isArray(res) ? res : []));
    } catch (err: any) {
      toast({
        type: "error",
        title: "Failed to load data",
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  }, [tab, search, toast]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    loadTabList();
  }, [loadTabList]);

  const openNewDoc = (
    kind: PurchaseDocKind,
    mode: "DIRECT" | "AGAINST_PO_GRN" = "DIRECT",
    prefill: any = null,
  ) => {
    setDrawerKind(kind);
    setDrawerMode(mode);
    setDrawerPrefill(prefill);
    setDrawerOpen(true);
  };

  const runAction = async (url: string, successTitle: string, body?: any) => {
    try {
      await apiFetch(url, {
        method: "POST",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      toast({ type: "success", title: successTitle });
      loadTabList();
    } catch (err: any) {
      toast({ type: "error", title: "Action failed", message: err.message });
    }
  };

  const handleCancel = (url: string) => {
    setCancelReason("");
    setCancelRequest({ url });
  };

  const closeCancelModal = () => {
    if (cancelSubmitting) return;
    setCancelRequest(null);
    setCancelReason("");
  };

  const submitCancellation = async (event: React.FormEvent) => {
    event.preventDefault();
    const reason = cancelReason.trim();
    if (!reason) {
      toast({
        type: "warning",
        title: "Reason required",
        message: "Enter a reason before cancelling this document.",
      });
      return;
    }
    if (!cancelRequest) return;

    setCancelSubmitting(true);
    try {
      await apiFetch(cancelRequest.url, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      setCancelRequest(null);
      setCancelReason("");
      toast({ type: "success", title: "Document cancelled" });
      await loadTabList();
    } catch (err: any) {
      toast({ type: "error", title: "Cancellation failed", message: err.message });
    } finally {
      setCancelSubmitting(false);
    }
  };

  const statusBadge = (status: string) => {
    const variant =
      status === "APPROVED" ||
      status === "ORDER_PLACED" ||
      status === "POSTED" ||
      status === "PAID" ||
      status === "FULLY_RECEIVED"
        ? "success"
        : status === "CANCELLED" || status === "REJECTED"
          ? "danger"
          : status === "PENDING_APPROVAL" ||
              status === "PARTIALLY_PAID" ||
              status === "PARTIALLY_RECEIVED"
            ? "warning"
            : "neutral";
    return (
      <Badge size="sm" variant={variant}>
        {status === "ORDER_PLACED" ? "Order Placed" : status}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">
            Purchase Management
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage purchase requests, orders, goods received, and supplier invoices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={loadTabList}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => openNewDoc("INVOICE", "DIRECT")}
            icon={<Plus className="w-3.5 h-3.5" />}
          >
            Direct Purchase Invoice
          </Button>
          {tab === "requests" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openNewDoc("PR")}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              New Purchase Request
            </Button>
          )}
          {tab === "orders" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openNewDoc("PO")}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              New Purchase Order
            </Button>
          )}
          {tab === "grns" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => openNewDoc("GRN")}
              icon={<Plus className="w-3.5 h-3.5" />}
            >
              New GRN
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-surface-secondary/70 rounded-xl border border-border text-xs">
        {[
          { id: "requests", label: "Purchase Requests (PR)" },
          { id: "orders", label: "Purchase Orders (PO)" },
          { id: "grns", label: "Goods Received (GRN)" },
          { id: "invoices", label: "Purchase Invoices" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as MainTab)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${tab === t.id ? "bg-surface text-accent shadow-xs" : "text-text-secondary hover:text-text-primary"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Sub-views */}
      <>
          <div className="max-w-sm">
            <Input
              placeholder="Search document number..."
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
                  <TableHead>Document</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Date</TableHead>
                  {tab !== "requests" && (
                    <TableHead className="text-right">Total</TableHead>
                  )}
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableEmptyState message={`No ${tab} records found.`} />
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-accent font-semibold">
                        {row.invoiceNumber ||
                          row.orderNumber ||
                          row.grnNumber ||
                          row.requestNumber}
                        {row.supplierBillNumber && (
                          <div className="text-[10px] text-text-tertiary">
                            Bill: {row.supplierBillNumber}
                          </div>
                        )}
                        {row.mode && (
                          <Badge
                            size="sm"
                            variant="neutral"
                            className="ml-1.5 text-[9px]"
                          >
                            {row.mode}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-text-primary">
                        {formatSupplierDisplayName(row.supplier) || row.department || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {new Date(
                          row.invoiceDate ||
                            row.orderDate ||
                            row.grnDate ||
                            row.requestDate,
                        ).toLocaleDateString()}
                      </TableCell>
                      {tab !== "requests" && (
                        <TableCell className="text-right font-mono font-semibold">
                          ₹{" "}
                          {Number(
                            row.grandTotal ?? row.totalAmount ?? row.amount ?? 0,
                          ).toFixed(2)}
                          {row.balanceAmount !== undefined &&
                            Number(row.balanceAmount) > 0 && (
                              <div className="text-[10px] text-warning font-normal">
                                Bal: ₹{Number(row.balanceAmount).toFixed(2)}
                              </div>
                            )}
                        </TableCell>
                      )}
                      <TableCell className="text-center">
                        {statusBadge(row.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* PR Actions */}
                          {tab === "requests" && row.status === "DRAFT" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                runAction(
                                  `/purchases/requests/${row.id}/submit`,
                                  "PR Submitted",
                                )
                              }
                              icon={<Send className="w-3 h-3" />}
                            >
                              Submit
                            </Button>
                          )}
                          {tab === "requests" &&
                            ["APPROVED", "PENDING_APPROVAL"].includes(row.status) &&
                            !row.isConvertedToPo && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                openNewDoc("PO", "AGAINST_PO_GRN", {
                                  purchaseRequestId: row.id,
                                  supplierId: row.supplierId,
                                  items: row.items?.map((i: any) => ({
                                    ...i,
                                    unitRate: 0,
                                  })),
                                })
                              }
                              icon={<ArrowRight className="w-3 h-3" />}
                            >
                              Convert to PO
                            </Button>
                          )}

                          {/* PO Actions */}
                          {tab === "orders" && row.status === "DRAFT" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                runAction(
                                  `/purchases/orders/${row.id}/submit`,
                                  "PO Submitted",
                                )
                              }
                              icon={<Send className="w-3 h-3" />}
                            >
                              Submit
                            </Button>
                          )}
                          {tab === "orders" &&
                            (row.status === "ORDER_PLACED" ||
                              row.status === "APPROVED" ||
                              row.status === "PENDING_APPROVAL" ||
                              row.status === "PARTIALLY_RECEIVED") && (
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={() =>
                                  openNewDoc("GRN", "AGAINST_PO_GRN", {
                                    purchaseOrderId: row.id,
                                    supplierId: row.supplierId,
                                    items: row.items
                                      ?.filter(
                                        (i: any) =>
                                          Number(i.quantity) >
                                          Number(i.receivedQuantity),
                                      )
                                      .map((i: any) => ({
                                        variantId: i.variantId,
                                        purchaseOrderItemId: i.id,
                                        quantity:
                                          Number(i.quantity) -
                                          Number(i.receivedQuantity),
                                        unitRate: i.unitRate,
                                      })),
                                  })
                                }
                                icon={<ArrowRight className="w-3 h-3" />}
                              >
                                Create GRN
                              </Button>
                            )}

                          {/* GRN Actions */}
                          {tab === "grns" && row.status === "DRAFT" && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                runAction(
                                  `/purchases/grns/${row.id}/post`,
                                  "GRN Posted",
                                )
                              }
                              icon={<CheckCircle2 className="w-3 h-3" />}
                            >
                              Post GRN
                            </Button>
                          )}
                          {tab === "grns" && row.status === "POSTED" && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                openNewDoc("INVOICE", "AGAINST_PO_GRN", {
                                  purchaseOrderId: row.purchaseOrderId,
                                  grnIds: [row.id],
                                  supplierId: row.supplierId,
                                  items: row.items
                                    ?.filter(
                                      (i: any) =>
                                        Number(i.quantity) >
                                        Number(i.invoicedQuantity || 0),
                                    )
                                    .map((i: any) => ({
                                      variantId: i.variantId,
                                      itemName:
                                        i.itemName ||
                                        (i.variant
                                          ? `${i.variant.product?.name || ""} — ${i.variant.name}`
                                          : undefined),
                                      unit: i.unit || "PCS",
                                      grnItemId: i.id,
                                      purchaseOrderItemId:
                                        i.purchaseOrderItemId,
                                      quantity:
                                        Number(i.quantity) -
                                        Number(i.invoicedQuantity || 0),
                                      unitRate: i.unitCost,
                                      taxRate: "0",
                                    })),
                                })
                              }
                              icon={<ArrowRight className="w-3 h-3" />}
                            >
                              Create Invoice
                            </Button>
                          )}

                          {/* Invoice Actions */}
                          {tab === "invoices" && row.status === "DRAFT" && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                runAction(
                                  `/purchases/invoices/${row.id}/post`,
                                  "Invoice Posted",
                                )
                              }
                              icon={<CheckCircle2 className="w-3 h-3" />}
                            >
                              Post
                            </Button>
                          )}
                          {/* Print */}
                          {["orders", "grns", "invoices"].includes(tab) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setPrintState({
                                  open: true,
                                  type:
                                    tab === "orders"
                                      ? "PO"
                                      : tab === "grns"
                                        ? "GRN"
                                        : "INVOICE",
                                  id: row.id,
                                })
                              }
                              icon={<Printer className="w-3 h-3" />}
                            >
                              Print
                            </Button>
                          )}

                          {/* Cancel */}
                          {["requests", "orders", "grns", "invoices"].includes(
                            tab,
                          ) &&
                            !(tab === "requests" && row.status === "APPROVED") &&
                            ![
                              "CANCELLED",
                              "PAID",
                              "CONVERTED",
                              "CLOSED",
                            ].includes(row.status) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleCancel(
                                    `/purchases/${tab}/${row.id}/cancel`,
                                  )
                                }
                                className="text-danger"
                                icon={<XCircle className="w-3 h-3" />}
                              >
                                Cancel
                              </Button>
                            )}
                          {tab === "requests" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setViewingRequest(row)}
                              icon={<Eye className="w-3 h-3" />}
                            >
                              View Details
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
      </>

      {/* Document Drawer */}
      <PurchaseDocumentDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        kind={drawerKind}
        initialMode={drawerMode}
        prefill={drawerPrefill}
        suppliers={suppliers}
        products={products}
        branchStateCode={branchStateCode}
        taxRegime={taxRegime}
        onSaved={loadTabList}
      />

      {/* Print Voucher Modal */}
      <PurchasePrintModal
        isOpen={printState.open}
        onClose={() => setPrintState({ ...printState, open: false })}
        documentType={printState.type}
        documentId={printState.id}
      />

      <Modal
        isOpen={Boolean(cancelRequest)}
        onClose={closeCancelModal}
        title="Cancel document"
        description="Provide a reason for cancelling this purchase document."
        maxWidth="md"
      >
        <form onSubmit={submitCancellation} className="space-y-4">
          <label className="block space-y-1.5 text-xs font-medium text-text-primary">
            <span>Cancellation reason *</span>
            <textarea
              autoFocus
              required
              rows={4}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Enter the reason for cancellation..."
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={closeCancelModal}>
              Keep document
            </Button>
            <Button type="submit" variant="danger" loading={cancelSubmitting}>
              Confirm cancellation
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(viewingRequest)}
        onClose={() => setViewingRequest(null)}
        title={viewingRequest ? `Purchase Request ${viewingRequest.requestNumber}` : "Purchase Request Details"}
        description="Purchase request details"
        maxWidth="lg"
      >
        {viewingRequest && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-text-tertiary">Supplier</div>
                <div className="font-medium text-text-primary">{formatSupplierDisplayName(viewingRequest.supplier) || "—"}</div>
              </div>
              <div>
                <div className="text-text-tertiary">Request date</div>
                <div className="text-text-primary">
                  {viewingRequest.requestDate
                    ? new Date(viewingRequest.requestDate).toLocaleDateString()
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-text-tertiary">Department</div>
                <div className="text-text-primary">{viewingRequest.department || "—"}</div>
              </div>
              <div>
                <div className="text-text-tertiary">Status</div>
                <div className="text-text-primary">{viewingRequest.status}</div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-text-primary">Requested items</h4>
              <div className="grid grid-cols-12 gap-2 px-2.5 pb-1 text-[10px] font-semibold uppercase text-text-tertiary">
                <div className="col-span-9">Item</div>
                <div className="col-span-3 text-right">Quantity</div>
              </div>
              <div className="max-h-72 overflow-y-auto rounded-md border border-border divide-y divide-border">
                {(viewingRequest.items || []).map((item: any) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 p-2.5">
                    <div className="col-span-9">
                      <div className="font-medium text-text-primary">
                        {item.itemName ||
                          [item.variant?.product?.name, item.variant?.name].filter(Boolean).join(" — ") ||
                          item.description ||
                          "Item"}
                      </div>
                      {item.description && (
                        <div className="mt-0.5 text-[11px] text-text-tertiary">{item.description}</div>
                      )}
                    </div>
                    <div className="col-span-3 text-right text-text-secondary">
                      {item.quantity} {item.unit || ""}
                    </div>
                  </div>
                ))}
                {!viewingRequest.items?.length && (
                  <div className="p-3 text-center text-text-tertiary">No items recorded.</div>
                )}
              </div>
            </div>

            {viewingRequest.notes && (
              <div>
                <div className="text-text-tertiary">Notes</div>
                <p className="mt-1 whitespace-pre-wrap text-text-primary">{viewingRequest.notes}</p>
              </div>
            )}
            <div className="flex justify-end border-t border-border pt-3">
              <Button type="button" variant="secondary" onClick={() => setViewingRequest(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}
