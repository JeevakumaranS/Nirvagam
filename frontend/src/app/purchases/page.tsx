"use client";

import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
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
import { PurchaseFinancialsReports } from "@/components/purchases/purchase-financials-reports";
import { PurchaseSettingsApprovals } from "@/components/purchases/purchase-settings-approvals";
import {
  Plus,
  RefreshCw,
  Search,
  Printer,
  ArrowRight,
  CreditCard,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Send,
} from "lucide-react";

type MainTab =
  | "invoices"
  | "requests"
  | "orders"
  | "grns"
  | "returns"
  | "payments"
  | "approvals"
  | "reports"
  | "settings";

export default function PurchasesPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<MainTab>("invoices");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [branchStateCode, setBranchStateCode] = useState("33");
  const [taxRegime, setTaxRegime] = useState<"GST" | "VAT">("GST");

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
    type: "PO" | "GRN" | "INVOICE" | "RETURN" | "PAYMENT";
    id: string | null;
  }>({
    open: false,
    type: "INVOICE",
    id: null,
  });

  // Payment modal
  const [payModal, setPayModal] = useState<{
    open: boolean;
    invoice?: any;
    isAdvance?: boolean;
  }>({ open: false });
  const [paySupplierId, setPaySupplierId] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payMode, setPayMode] = useState<
    "BANK_TRANSFER" | "CASH" | "UPI" | "CHEQUE"
  >("BANK_TRANSFER");
  const [payRef, setPayRef] = useState("");

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
    if (["approvals", "reports", "settings"].includes(tab)) {
      setLoading(false);
      return;
    }
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

  const handleCancel = async (url: string) => {
    const reason = window.prompt("Enter mandatory cancellation reason:");
    if (!reason?.trim()) return;
    await runAction(url, "Document cancelled", { reason });
  };

  const handleCreateReturn = async (invoice: any) => {
    if (!invoice.items?.length) return;
    const reason =
      window.prompt("Enter reason for Purchase Return (Debit Note):") ||
      "Damaged / Returned goods";
    try {
      const ret = await apiFetch("/purchases/returns", {
        method: "POST",
        body: JSON.stringify({
          purchaseInvoiceId: invoice.id,
          reason,
          items: invoice.items.map((i: any) => ({
            variantId: i.variantId,
            invoiceItemId: i.id,
            quantity: i.quantity,
          })),
        }),
      });
      await apiFetch(`/purchases/returns/${ret.id}/post`, { method: "POST" });
      toast({
        type: "success",
        title: "Purchase Return Posted",
        message: "Stock and supplier ledger reversed.",
      });
      setTab("returns");
      loadTabList();
    } catch (err: any) {
      toast({ type: "error", title: "Return failed", message: err.message });
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/purchases/payments", {
        method: "POST",
        body: JSON.stringify({
          supplierId: payModal.invoice?.supplierId || paySupplierId,
          paymentType: payModal.isAdvance ? "ADVANCE" : "BILL_PAYMENT",
          mode: payMode,
          amount: payAmount,
          reference: payRef || undefined,
          allocations: payModal.invoice
            ? [{ purchaseInvoiceId: payModal.invoice.id, amount: payAmount }]
            : [],
        }),
      });
      toast({
        type: "success",
        title: "Payment Posted",
        message: "Accounts Payable & Supplier Ledger updated.",
      });
      setPayModal({ open: false });
      setPayAmount("");
      setPayRef("");
      loadTabList();
    } catch (err: any) {
      toast({ type: "error", title: "Payment failed", message: err.message });
    }
  };

  const statusBadge = (status: string) => {
    const variant =
      status === "APPROVED" ||
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
        {status}
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
            Complete procurement lifecycle: PR → PO → GRN → Purchase Invoice
            (Direct & Linked) → Returns → Supplier Payments & Ledger.
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
          {tab === "payments" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setPaySupplierId(suppliers[0]?.id || "");
                setPayAmount("");
                setPayModal({ open: true, isAdvance: true });
              }}
              icon={<CreditCard className="w-3.5 h-3.5" />}
            >
              Record Advance Payment
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-surface-secondary/70 rounded-xl border border-border text-xs">
        {[
          { id: "invoices", label: "Purchase Invoices" },
          { id: "requests", label: "Purchase Requests (PR)" },
          { id: "orders", label: "Purchase Orders (PO)" },
          { id: "grns", label: "Goods Received (GRN)" },
          { id: "returns", label: "Returns (Debit Notes)" },
          { id: "payments", label: "Payments & Advances" },
          { id: "approvals", label: "Approvals" },
          { id: "reports", label: "Supplier Ledger & Reports" },
          { id: "settings", label: "Settings" },
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
      {tab === "approvals" && <PurchaseSettingsApprovals mode="approvals" />}
      {tab === "settings" && <PurchaseSettingsApprovals mode="settings" />}
      {tab === "reports" && (
        <PurchaseFinancialsReports suppliers={suppliers} products={products} />
      )}

      {!["approvals", "reports", "settings"].includes(tab) && (
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
                  <TableHead className="text-right">Total</TableHead>
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
                          row.requestNumber ||
                          row.returnNumber ||
                          row.paymentNumber}
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
                        {row.supplier?.name || row.department || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-text-secondary">
                        {new Date(
                          row.invoiceDate ||
                            row.orderDate ||
                            row.grnDate ||
                            row.requestDate ||
                            row.returnDate ||
                            row.paymentDate,
                        ).toLocaleDateString()}
                      </TableCell>
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
                          {tab === "requests" && row.status === "APPROVED" && (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                openNewDoc("PO", "AGAINST_PO_GRN", {
                                  purchaseRequestId: row.id,
                                  supplierId: row.supplierId,
                                  items: row.items?.map((i: any) => ({
                                    ...i,
                                    unitRate: i.preferredRate || 0,
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
                            (row.status === "APPROVED" ||
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
                                      grnItemId: i.id,
                                      purchaseOrderItemId:
                                        i.purchaseOrderItemId,
                                      quantity:
                                        Number(i.quantity) -
                                        Number(i.invoicedQuantity || 0),
                                      unitRate: i.unitCost,
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
                          {tab === "invoices" &&
                            (row.status === "APPROVED" ||
                              row.status === "PARTIALLY_PAID") && (
                              <>
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => {
                                    setPayAmount(String(row.balanceAmount));
                                    setPayModal({
                                      open: true,
                                      invoice: row,
                                      isAdvance: false,
                                    });
                                  }}
                                  icon={<CreditCard className="w-3 h-3" />}
                                >
                                  Pay
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleCreateReturn(row)}
                                  icon={<RotateCcw className="w-3 h-3" />}
                                >
                                  Return
                                </Button>
                              </>
                            )}

                          {/* Print */}
                          {[
                            "orders",
                            "grns",
                            "invoices",
                            "returns",
                            "payments",
                          ].includes(tab) && (
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
                                        : tab === "invoices"
                                          ? "INVOICE"
                                          : tab === "returns"
                                            ? "RETURN"
                                            : "PAYMENT",
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
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </>
      )}

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

      {/* Payment Modal */}
      <Modal
        isOpen={payModal.open}
        onClose={() => setPayModal({ open: false })}
        title={
          payModal.isAdvance
            ? "Record Supplier Advance Payment"
            : `Pay Invoice ${payModal.invoice?.invoiceNumber}`
        }
      >
        <form onSubmit={handleSavePayment} className="space-y-3">
          {payModal.isAdvance && (
            <Select
              label="Supplier *"
              value={paySupplierId}
              onChange={(e) => setPaySupplierId(e.target.value)}
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
          <Input
            label="Amount (₹) *"
            type="number"
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            required
          />
          <Select
            label="Payment Mode"
            value={payMode}
            onChange={(e) => setPayMode(e.target.value as any)}
          >
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CHEQUE">Cheque</option>
          </Select>
          <Input
            label="Reference / UTR #"
            value={payRef}
            onChange={(e) => setPayRef(e.target.value)}
            placeholder="Optional transaction reference"
          />
          <div className="pt-3 flex justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPayModal({ open: false })}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Post Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
