import { BadRequestException } from '@nestjs/common';
import { PurchaseCoreService } from './services/purchase-core.service';
import { PurchaseApprovalsService } from './services/purchase-approvals.service';
import { PurchaseProcurementService } from './services/purchase-procurement.service';
import { PurchaseBillingService } from './services/purchase-billing.service';
import { PurchaseFinancialsReportsService } from './services/purchase-financials-reports.service';

describe('Module 3 Purchase Management Integration Flows', () => {
  const user = { id: 'u1', businessId: 'b1', branchId: 'br1' };

  it('lists purchase invoices without removed warehouse and unit-price columns', async () => {
    const prisma: any = {
      purchaseInvoice: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const billing = new PurchaseBillingService(prisma, {} as any, {} as any);

    await billing.listInvoices(user, {});

    const query = prisma.purchaseInvoice.findMany.mock.calls[0][0];
    expect(query.select).not.toHaveProperty('warehouseId');
    expect(query.select.items.select).not.toHaveProperty('unitPrice');
  });

  it('lists purchase returns without the removed warehouse column', async () => {
    const prisma: any = {
      purchaseReturn: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const billing = new PurchaseBillingService(prisma, {} as any, {} as any);

    await billing.listReturns(user, {});

    const query = prisma.purchaseReturn.findMany.mock.calls[0][0];
    expect(query.select).not.toHaveProperty('warehouseId');
  });

  it('loads purchase-order print data without the removed warehouse column', async () => {
    const prisma: any = {
      business: { findUnique: jest.fn().mockResolvedValue({ id: 'b1' }) },
      purchaseOrder: { findFirst: jest.fn().mockResolvedValue({ id: 'po1' }) },
    };
    const reports = new PurchaseFinancialsReportsService(prisma);

    await reports.getPrintData(user, 'PO', 'po1');

    const query = prisma.purchaseOrder.findFirst.mock.calls[0][0];
    expect(query.select).not.toHaveProperty('warehouseId');
    expect(query.select.items.select).not.toHaveProperty('warehouseId');
  });

  const makeMockPrisma = () => {
    const state: any = {
      settings: {
        id: 's1',
        businessId: 'b1',
        taxRegime: 'GST',
        costingMethod: 'WAC',
        enableGrnAccrual: true,
        blockReturnOnInsufficientStock: true,
        defaultOverReceiptTolerance: 5,
      },
      branch: { id: 'br1', businessId: 'b1', name: 'HQ', stateCode: '33' },
      supplier: { id: 'sup1', businessId: 'b1', name: 'Mill Co', stateCode: '33', creditPeriodDays: 30 },
      accounts: [
        { id: 'coa-ap', code: '2010', businessId: 'b1', isActive: true },
        { id: 'coa-inv', code: '1020', businessId: 'b1', isActive: true },
        { id: 'coa-pur', code: '5020', businessId: 'b1', isActive: true },
        { id: 'coa-grn', code: '2015', businessId: 'b1', isActive: true },
        { id: 'coa-ppv', code: '5025', businessId: 'b1', isActive: true },
        { id: 'coa-cgst', code: '1051', businessId: 'b1', isActive: true },
        { id: 'coa-sgst', code: '1052', businessId: 'b1', isActive: true },
        { id: 'coa-igst', code: '1053', businessId: 'b1', isActive: true },
        { id: 'coa-adv', code: '2020', businessId: 'b1', isActive: true },
        { id: 'coa-bank', code: '1000', businessId: 'b1', isActive: true },
      ],
      journals: [] as any[],
      journalLines: [] as any[],
      stockBalances: new Map<string, any>(),
      stockMovements: [] as any[],
      prs: new Map<string, any>(),
      pos: new Map<string, any>(),
      poItems: new Map<string, any>(),
      grns: new Map<string, any>(),
      grnItems: new Map<string, any>(),
      invoices: new Map<string, any>(),
      returns: new Map<string, any>(),
      payments: new Map<string, any>(),
      approvalRules: [] as any[],
      approvalRequests: new Map<string, any>(),
      seq: 1,
    };

    const tx: any = {
      documentNumberSeries: {
        findFirst: jest.fn(async () => ({ id: 'ser1', prefix: 'DOC-', currentNumber: state.seq++, padding: 4, resetPeriod: 'YEAR', resetYear: 2026 })),
        create: jest.fn(async ({ data }: any) => data),
        update: jest.fn(async () => ({})),
      },
      purchaseSettings: {
        findUnique: jest.fn(async () => state.settings),
        create: jest.fn(async ({ data }: any) => data),
      },
      chartOfAccount: {
        findMany: jest.fn(async () => state.accounts),
      },
      fiscalPeriod: {
        findFirst: jest.fn(async () => null),
      },
      branch: { findUnique: jest.fn(async () => state.branch) },
      supplier: { findUnique: jest.fn(async () => state.supplier) },
      approvalRule: { findMany: jest.fn(async () => state.approvalRules), findUnique: jest.fn(async ({ where }: any) => state.approvalRules.find((r: any) => r.id === where.id)) },
      approvalRequest: {
        create: jest.fn(async ({ data }: any) => {
          const req = { id: `req-${state.seq++}`, ...data };
          state.approvalRequests.set(req.id, req);
          return req;
        }),
        findFirst: jest.fn(async ({ where }: any) => state.approvalRequests.get(where.id) || null),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = state.approvalRequests.get(where.id);
          const next = { ...cur, ...data };
          state.approvalRequests.set(where.id, next);
          return next;
        }),
      },
      approvalHistory: { create: jest.fn(async ({ data }: any) => data) },
      inAppNotification: { create: jest.fn(async ({ data }: any) => data) },
      user: { findMany: jest.fn(async () => []) },
      journalEntry: {
        create: jest.fn(async ({ data }: any) => {
          const j = { id: `jrn-${state.seq++}`, ...data };
          state.journals.push(j);
          return j;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          const j = state.journals.find((x: any) => x.id === where.id);
          if (!j) return null;
          return { ...j, lines: state.journalLines.filter((l: any) => l.journalEntryId === j.id) };
        }),
      },
      journalLine: {
        create: jest.fn(async ({ data }: any) => {
          state.journalLines.push(data);
          return data;
        }),
      },
      stockBalance: {
        findUnique: jest.fn(async ({ where }: any) => state.stockBalances.get(`${where.branchId_variantId.branchId}:${where.branchId_variantId.variantId}`) || null),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const k = `${where.branchId_variantId.branchId}:${where.branchId_variantId.variantId}`;
          const cur = state.stockBalances.get(k);
          const next = cur ? { ...cur, ...update } : { id: `sb-${state.seq++}`, ...create };
          state.stockBalances.set(k, next);
          return next;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          for (const [k, v] of state.stockBalances.entries()) {
            if (v.id === where.id) {
              const next = { ...v, ...data };
              state.stockBalances.set(k, next);
              return next;
            }
          }
          return null;
        }),
      },
      stockMovement: {
        create: jest.fn(async ({ data }: any) => {
          state.stockMovements.push(data);
          return data;
        }),
      },
      purchaseRequest: {
        count: jest.fn(async () => state.prs.size),
        findMany: jest.fn(async () => Array.from(state.prs.values())),
        create: jest.fn(async ({ data }: any) => {
          const pr = { id: `pr-${state.seq++}`, ...data, version: 1, items: (data.items?.create || []).map((i: any, idx: number) => ({ id: `pri-${idx}`, ...i, variant: { purchasePrice: 100, product: { taxRate: { rate: 18 } } } })) };
          state.prs.set(pr.id, pr);
          return pr;
        }),
        findFirst: jest.fn(async ({ where }: any) => state.prs.get(where.id) || null),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = state.prs.get(where.id);
          const next = { ...cur, ...data };
          state.prs.set(where.id, next);
          return next;
        }),
      },
      purchaseOrder: {
        create: jest.fn(async ({ data }: any) => {
          const items = (data.items?.create || []).map((i: any, idx: number) => {
            const item = { id: `poi-${state.seq++}-${idx}`, ...i, receivedQuantity: '0', invoicedQuantity: '0' };
            state.poItems.set(item.id, item);
            return item;
          });
          const po = { id: `po-${state.seq++}`, ...data, items, version: 1 };
          state.pos.set(po.id, po);
          return po;
        }),
        findMany: jest.fn(async ({ where }: any) =>
          Array.from(state.pos.values())
            .filter((po: any) =>
              po.businessId === where.businessId &&
              !po.isDeleted &&
              where.purchaseRequestId.in.includes(po.purchaseRequestId),
            )
            .map((po: any) => ({ purchaseRequestId: po.purchaseRequestId })),
        ),
        findFirst: jest.fn(async ({ where }: any) => state.pos.get(where.id) || null),
        findUnique: jest.fn(async ({ where }: any) => state.pos.get(where.id) || null),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = state.pos.get(where.id);
          const next = { ...cur, ...data };
          state.pos.set(where.id, next);
          return next;
        }),
      },
      purchaseOrderItem: {
        findMany: jest.fn(async ({ where }: any) => Array.from(state.poItems.values()).filter((i: any) => i.purchaseOrderId === where.purchaseOrderId || state.pos.get(where.purchaseOrderId)?.items.some((x: any) => x.id === i.id))),
        findUnique: jest.fn(async ({ where }: any) => state.poItems.get(where.id) || null),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = state.poItems.get(where.id);
          const next = { ...cur, ...data };
          state.poItems.set(where.id, next);
          return next;
        }),
      },
      grn: {
        create: jest.fn(async ({ data }: any) => {
          const items = (data.items?.create || []).map((i: any, idx: number) => {
            const gi = { id: `gi-${state.seq++}-${idx}`, ...i, invoicedQuantity: '0' };
            state.grnItems.set(gi.id, gi);
            return gi;
          });
          const grn = { id: `grn-${state.seq++}`, ...data, items, version: 1, purchaseOrder: data.purchaseOrderId ? state.pos.get(data.purchaseOrderId) : null, supplier: state.supplier };
          state.grns.set(grn.id, grn);
          return grn;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          const g = state.grns.get(where.id);
          if (!g) return null;
          return { ...g, purchaseOrder: g.purchaseOrderId ? state.pos.get(g.purchaseOrderId) : null };
        }),
        count: jest.fn(async () => 0),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = state.grns.get(where.id);
          const next = { ...cur, ...data };
          state.grns.set(where.id, next);
          return next;
        }),
      },
      grnItem: {
        findUnique: jest.fn(async ({ where }: any) => state.grnItems.get(where.id) || null),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = state.grnItems.get(where.id);
          const next = { ...cur, ...data };
          state.grnItems.set(where.id, next);
          return next;
        }),
      },
      purchaseInvoice: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where?.id) {
            const invoice = state.invoices.get(where.id);
            return invoice ? { ...invoice, paymentAllocations: [] } : null;
          }
          return null;
        }),
        findUnique: jest.fn(async ({ where }: any) => state.invoices.get(where.id) || null),
        create: jest.fn(async ({ data }: any) => {
          const inv = {
            id: `inv-${state.seq++}`,
            ...data,
            items: (data.items?.create || []).map((i: any, idx: number) => ({ id: `ii-${idx}`, ...i })),
            allocations: [],
            paymentAllocations: [],
            supplier: state.supplier,
            branch: state.branch,
            version: 1,
          };
          state.invoices.set(inv.id, inv);
          return inv;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = state.invoices.get(where.id);
          const next = { ...cur, ...data };
          state.invoices.set(where.id, next);
          return next;
        }),
      },
      purchaseInvoiceGrn: { count: jest.fn(async () => 0) },
      purchaseReturn: {
        count: jest.fn(async ({ where }: any) => Array.from(state.returns.values()).filter(
          (ret: any) => ret.purchaseInvoiceId === where.purchaseInvoiceId && ret.status !== 'CANCELLED',
        ).length),
        create: jest.fn(async ({ data }: any) => {
          const ret = { id: `ret-${state.seq++}`, ...data, items: (data.items?.create || []).map((i: any, idx: number) => ({ id: `ri-${idx}`, ...i })), supplier: state.supplier, version: 1 };
          state.returns.set(ret.id, ret);
          return ret;
        }),
        findFirst: jest.fn(async ({ where }: any) => state.returns.get(where.id) || null),
        update: jest.fn(async ({ where, data }: any) => {
          const cur = state.returns.get(where.id);
          const next = { ...cur, ...data };
          state.returns.set(where.id, next);
          return next;
        }),
      },
      purchasePayment: {
        findUnique: jest.fn(async () => null),
        findFirst: jest.fn(async ({ where }: any) => state.payments.get(where.id) || null),
        create: jest.fn(async ({ data }: any) => {
          const pay = { id: `pay-${state.seq++}`, ...data, supplier: state.supplier, version: 1 };
          state.payments.set(pay.id, pay);
          return pay;
        }),
      },
    };

    const prisma: any = {
      ...tx,
      $transaction: async (cb: any) => cb(tx),
    };
    return { prisma, state };
  };

  it('marks purchase requests that already have a linked PO', async () => {
    const { prisma, state } = makeMockPrisma();
    state.prs.set('pr-1', { id: 'pr-1' });
    state.prs.set('pr-2', { id: 'pr-2' });
    state.pos.set('po-1', {
      id: 'po-1',
      businessId: 'b1',
      purchaseRequestId: 'pr-1',
      isDeleted: false,
    });
    const core = new PurchaseCoreService(prisma);
    const approvals = new PurchaseApprovalsService(prisma, core);
    const procurement = new PurchaseProcurementService(prisma, core, approvals);

    const result = await procurement.listRequests(user, {});

    expect(result.data.map((request: any) => [request.id, request.isConvertedToPo])).toEqual([
      ['pr-1', true],
      ['pr-2', false],
    ]);
  });

  it('Flow 1 & 3: Full PR -> PO -> Partial GRN (Accrual) -> Partial Invoice -> Partial Payment', async () => {
    const { prisma, state } = makeMockPrisma();
    const core = new PurchaseCoreService(prisma);
    const approvals = new PurchaseApprovalsService(prisma, core);
    const proc = new PurchaseProcurementService(prisma, core, approvals);
    const billing = new PurchaseBillingService(prisma, core, approvals);

    // 1. PR Create -> Submit (auto-approved when no rules)
    const pr = await proc.createRequest(user, { items: [{ variantId: 'v1', quantity: '10', preferredRate: '100' }] });
    await proc.submitRequest(user, pr.id);
    expect(state.prs.get(pr.id).status).toBe('APPROVED');

    // 2. Convert PR to PO
    const po = await proc.convertRequestToPo(user, pr.id, { supplierId: 'sup1' });
    expect(state.prs.get(pr.id).status).toBe('CONVERTED');
    await proc.submitOrder(user, po.id);
    expect(state.pos.get(po.id).status).toBe('APPROVED');

    // 3. Partial GRN (6 of 10 received) + GRN Accrual Journal
    const grn = await proc.createGrn(user, {
      supplierId: 'sup1',
      purchaseOrderId: po.id,
      post: true,
      items: [{ variantId: 'v1', purchaseOrderItemId: po.items[0].id, quantity: '6', unitCost: '100' }],
    });
    expect(grn.status).toBe('POSTED');
    expect(state.pos.get(po.id).status).toBe('PARTIALLY_RECEIVED');
    expect(prisma.warehouse.findFirst).not.toHaveBeenCalled();
    expect(state.stockBalances.get('br1:v1').quantity).toBe('6.00');
    expect(state.stockMovements[0]).toMatchObject({ branchId: 'br1', variantId: 'v1' });
    expect(state.stockMovements[0]).not.toHaveProperty('warehouseId');
    expect(prisma.stockBalance.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true, quantity: true, averageCost: true },
    }));
    expect(prisma.stockBalance.upsert).toHaveBeenCalledWith(expect.objectContaining({
      select: { id: true },
    }));

    // 4. Partial Invoice against GRN (4 of 6 invoiced) -> Clears GRN Accrual, never double counts stock
    const inv = await billing.createInvoice(user, {
      supplierId: 'sup1',
      mode: 'AGAINST_PO_GRN',
      purchaseOrderId: po.id,
      grnIds: [grn.id],
      supplierBillNumber: 'BILL-101',
      post: true,
      items: [{ variantId: 'v1', grnItemId: grn.items[0].id, purchaseOrderItemId: po.items[0].id, quantity: '4', unitRate: '100', taxRate: '18' }],
    });
    expect(inv.status).toBe('APPROVED');
    expect(state.stockBalances.get('br1:v1').quantity).toBe('6.00'); // Still 6!

    // 5. Partial Payment
    await billing.createPayment(user, {
      supplierId: 'sup1',
      amount: '200',
      allocations: [{ purchaseInvoiceId: inv.id, amount: '200' }],
    });
    expect(state.invoices.get(inv.id).status).toBe('PARTIALLY_PAID');
  });

  it('Flow 2 & 4 & 6: Direct Invoice -> Purchase Return (balanced reversal) -> Cancellation check', async () => {
    const { prisma, state } = makeMockPrisma();
    const core = new PurchaseCoreService(prisma);
    const approvals = new PurchaseApprovalsService(prisma, core);
    const billing = new PurchaseBillingService(prisma, core, approvals);

    const inv = await billing.createInvoice(user, {
      supplierId: 'sup1',
      mode: 'DIRECT',
      supplierBillNumber: 'DIRECT-001',
      post: true,
      items: [{ variantId: 'v1', quantity: '5', unitRate: '100', taxRate: '18' }],
    });
    expect(state.stockBalances.get('br1:v1').quantity).toBe('5.00');

    // Cannot cancel invoice if return exists; first test return
    const ret = await billing.createReturn(user, {
      purchaseInvoiceId: inv.id,
      reason: 'Defective',
      items: [{ variantId: 'v1', quantity: '2' }],
    });
    const postedRet = await billing.postReturn(user, ret.id);
    expect(postedRet.status).toBe('POSTED');
    expect(state.stockBalances.get('br1:v1').quantity).toBe('3.00');

    // Verify journal lines for return are balanced (AP debit = Inventory + CGST + SGST credit)
    const retLines = state.journalLines.filter((l: any) => l.journalEntryId === postedRet.journalEntryId);
    const dr = retLines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const cr = retLines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(Math.abs(dr - cr)).toBeLessThan(0.01);

    // Cancellation of invoice blocked because return exists
    await expect(billing.cancelInvoice(user, inv.id, 'Cancel test')).rejects.toThrow(BadRequestException);
  });

  it('Flow 5: Approval rejection requires mandatory reason and blocks downstream conversion', async () => {
    const { prisma, state } = makeMockPrisma();
    state.approvalRules.push({
      id: 'rule1',
      businessId: 'b1',
      documentType: 'PR',
      minAmount: 100,
      maxAmount: null,
      isActive: true,
      levels: [{ level: 1, roleName: 'MANAGER' }],
    });

    const core = new PurchaseCoreService(prisma);
    const approvals = new PurchaseApprovalsService(prisma, core);
    const proc = new PurchaseProcurementService(prisma, core, approvals);

    const pr = await proc.createRequest(user, { items: [{ variantId: 'v1', quantity: '5', preferredRate: '100' }] });
    const submitted = await proc.submitRequest(user, pr.id);
    expect(submitted.status).toBe('PENDING_APPROVAL');

    // Downstream conversion blocked before approval
    await expect(proc.convertRequestToPo(user, pr.id, { supplierId: 'sup1' })).rejects.toThrow(BadRequestException);

    // Reject without reason fails
    const req = Array.from(state.approvalRequests.values())[0] as any;
    await expect(approvals.actOnRequest(user, req.id, 'REJECT', {})).rejects.toThrow(BadRequestException);

    // Reject with reason updates PR to REJECTED
    await approvals.actOnRequest(user, req.id, 'REJECT', { reason: 'Budget exceeded' });
    expect(state.prs.get(pr.id).status).toBe('REJECTED');
  });
});
