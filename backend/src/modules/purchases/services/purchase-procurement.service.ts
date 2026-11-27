import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { calculatePurchaseDocument, PaginationParams, PurchaseCalculationLine } from '@nirvagam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertPurchaseTransition } from '../purchase-status';
import { PurchaseCoreService } from './purchase-core.service';
import { PurchaseApprovalsService } from './purchase-approvals.service';
import {
  CreateGrnDto,
  CreatePurchaseOrderDto,
  CreatePurchaseRequestDto,
  UpdateGrnDto,
  UpdatePurchaseOrderDto,
  UpdatePurchaseRequestDto,
} from '../dto/purchase.dto';

const purchaseOrderScalars = {
  id: true,
  businessId: true,
  branchId: true,
  supplierId: true,
  purchaseRequestId: true,
  orderNumber: true,
  orderDate: true,
  expectedDate: true,
  status: true,
  currencyCode: true,
  overReceiptTolerance: true,
  pricesIncludeTax: true,
  invoiceDiscountType: true,
  invoiceDiscountValue: true,
  discountAmount: true,
  roundOff: true,
  taxableAmount: true,
  cgstAmount: true,
  sgstAmount: true,
  igstAmount: true,
  vatAmount: true,
  totalTax: true,
  additionalCharges: true,
  grandTotal: true,
  calculationRule: true,
  taxSummary: true,
  notes: true,
  terms: true,
  createdById: true,
  updatedById: true,
  version: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const;

const grnScalars = {
  id: true,
  businessId: true,
  branchId: true,
  supplierId: true,
  purchaseOrderId: true,
  grnNumber: true,
  grnDate: true,
  deliveryDate: true,
  status: true,
  totalAmount: true,
  taxableAmount: true,
  totalTax: true,
  grandTotal: true,
  journalEntryId: true,
  cancelledAt: true,
  cancellationReason: true,
  notes: true,
  createdById: true,
  updatedById: true,
  version: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class PurchaseProcurementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: PurchaseCoreService,
    private readonly approvals: PurchaseApprovalsService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                             PURCHASE REQUESTS                              */
  /* -------------------------------------------------------------------------- */

  async listRequests(user: any, params: PaginationParams & Record<string, any>) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const where: any = {
      businessId: user.businessId,
      isDeleted: false,
      ...(user.branchId ? { branchId: user.branchId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(params.search
        ? { requestNumber: { contains: params.search, mode: 'insensitive' } }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.purchaseRequest.count({ where }),
      this.prisma.purchaseRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: { supplier: true, branch: true, items: { include: { variant: { include: { product: true } } } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const linkedOrders = data.length
      ? await this.prisma.purchaseOrder.findMany({
          where: {
            businessId: user.businessId,
            isDeleted: false,
            purchaseRequestId: { in: data.map((request) => request.id) },
          },
          select: { purchaseRequestId: true },
        })
      : [];
    const convertedRequestIds = new Set(
      linkedOrders.map((order) => order.purchaseRequestId).filter(Boolean),
    );
    return {
      data: data.map((request) => ({
        ...request,
        isConvertedToPo: convertedRequestIds.has(request.id),
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1 },
    };
  }

  async getRequest(user: any, id: string) {
    const row = await this.prisma.purchaseRequest.findFirst({
      where: { id, businessId: user.businessId, isDeleted: false, ...(user.branchId ? { branchId: user.branchId } : {}) },
      include: { supplier: true, branch: true, items: { include: { variant: { include: { product: true } } } } },
    });
    if (!row) throw new NotFoundException('Purchase request not found');
    return row;
  }

  async createRequest(user: any, dto: CreatePurchaseRequestDto) {
    const branchId = this.core.requireBranch(user);
    return this.prisma.$transaction(async (tx) => {
      const requestNumber = dto.requestNumber || (await this.core.nextNumber(tx, user.businessId, branchId, 'PR'));
      return tx.purchaseRequest.create({
        data: {
          businessId: user.businessId,
          branchId,
          supplierId: dto.supplierId || null,
          requestNumber,
          requestDate: new Date(dto.requestDate || new Date()),
          department: dto.department || null,
          currencyCode: dto.currencyCode || 'INR',
          status: 'DRAFT',
          notes: dto.notes || null,
          createdById: user.id,
          items: {
            create: dto.items.map((item) => ({
              variantId: item.variantId || null,
              itemName: item.itemName || null,
              unit: item.unit || 'PCS',
              description: item.description || null,
              quantity: String(item.quantity),
              requiredDate: item.requiredDate ? new Date(item.requiredDate) : null,
              preferredRate: String(item.preferredRate || 0),
            })),
          },
        },
        include: { items: true, supplier: true },
      });
    });
  }

  async updateRequest(user: any, id: string, dto: UpdatePurchaseRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseRequest.findFirst({ where: { id, businessId: user.businessId, isDeleted: false } });
      if (!existing) throw new NotFoundException('Purchase request not found');
      if (existing.status !== 'DRAFT') throw new BadRequestException('Only DRAFT purchase requests can be edited');
      this.core.assertVersion(dto.version, existing.version, 'Purchase request');

      await tx.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: id } });
      return tx.purchaseRequest.update({
        where: { id },
        data: {
          supplierId: dto.supplierId || null,
          requestDate: dto.requestDate ? new Date(dto.requestDate) : existing.requestDate,
          department: dto.department ?? existing.department,
          notes: dto.notes ?? existing.notes,
          updatedById: user.id,
          version: { increment: 1 },
          items: {
            create: dto.items.map((item) => ({
              variantId: item.variantId || null,
              itemName: item.itemName || null,
              unit: item.unit || 'PCS',
              description: item.description || null,
              quantity: String(item.quantity),
              requiredDate: item.requiredDate ? new Date(item.requiredDate) : null,
              preferredRate: String(item.preferredRate || 0),
            })),
          },
        },
        include: { items: true, supplier: true },
      });
    });
  }

  async submitRequest(user: any, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        include: { items: true },
      });
      if (!pr) throw new NotFoundException('Purchase request not found');
      assertPurchaseTransition('PR', pr.status, 'PENDING_APPROVAL');

      const estimatedTotal = pr.items.reduce((s, i) => s + Number(i.quantity) * Number(i.preferredRate), 0);
      const approval = await this.approvals.submitForApproval(tx, user, {
        documentType: 'PR',
        documentId: pr.id,
        documentNumber: pr.requestNumber,
        amount: estimatedTotal,
        department: pr.department,
      });

      const nextStatus = approval.autoApproved ? 'APPROVED' : 'PENDING_APPROVAL';
      return tx.purchaseRequest.update({
        where: { id },
        data: { status: nextStatus, updatedById: user.id, version: { increment: 1 } },
        include: { items: true },
      });
    });
  }

  async approveRequest(user: any, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.findFirst({ where: { id, businessId: user.businessId, isDeleted: false } });
      if (!pr) throw new NotFoundException('Purchase request not found');
      assertPurchaseTransition('PR', pr.status, 'APPROVED');
      return tx.purchaseRequest.update({
        where: { id },
        data: { status: 'APPROVED', updatedById: user.id, version: { increment: 1 } },
      });
    });
  }

  async rejectRequest(user: any, id: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Rejection reason is mandatory');
    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.findFirst({ where: { id, businessId: user.businessId, isDeleted: false } });
      if (!pr) throw new NotFoundException('Purchase request not found');
      assertPurchaseTransition('PR', pr.status, 'REJECTED');
      return tx.purchaseRequest.update({
        where: { id },
        data: { status: 'REJECTED', notes: reason, updatedById: user.id, version: { increment: 1 } },
      });
    });
  }

  async cancelRequest(user: any, id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.findFirst({ where: { id, businessId: user.businessId, isDeleted: false } });
      if (!pr) throw new NotFoundException('Purchase request not found');
      assertPurchaseTransition('PR', pr.status, 'CANCELLED');
      return tx.purchaseRequest.update({
        where: { id },
        data: { status: 'CANCELLED', notes: reason, updatedById: user.id, version: { increment: 1 } },
      });
    });
  }

  async convertRequestToPo(user: any, prId: string, dto: Partial<CreatePurchaseOrderDto>) {
    const branchId = this.core.requireBranch(user);
    return this.prisma.$transaction(async (tx) => {
      const pr = await tx.purchaseRequest.findFirst({
        where: { id: prId, businessId: user.businessId, isDeleted: false },
        include: { items: { include: { variant: { include: { taxRate: true } } } } },
      });
      if (!pr) throw new NotFoundException('Purchase request not found');
      if (pr.status !== 'APPROVED') {
        throw new BadRequestException('Purchase request must be APPROVED before converting to PO');
      }

      const supplierId = dto.supplierId || pr.supplierId;
      if (!supplierId) throw new BadRequestException('Supplier is required to convert PR to PO');

      const itemsToConvert = dto.items?.length
        ? dto.items
        : pr.items.map((item) => ({
            variantId: item.variantId || undefined,
            itemName: item.itemName || undefined,
            description: item.description || undefined,
            quantity: String(item.quantity),
            unitRate: String(Number(item.preferredRate) > 0 ? item.preferredRate : item.variant?.purchasePrice || 0),
            taxRate: String(item.variant?.taxRate?.rate || 0),
          }));

      const po = await this.createOrderInternal(tx, user, branchId, {
        ...(dto as CreatePurchaseOrderDto),
        supplierId,
        purchaseRequestId: pr.id,
        items: itemsToConvert,
      });

      await tx.purchaseRequest.update({
        where: { id: pr.id },
        data: { status: 'CONVERTED', updatedById: user.id, version: { increment: 1 } },
      });

      return po;
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                              PURCHASE ORDERS                               */
  /* -------------------------------------------------------------------------- */

  async listOrders(user: any, params: PaginationParams & Record<string, any>) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const where: any = {
      businessId: user.businessId,
      isDeleted: false,
      ...(user.branchId ? { branchId: user.branchId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(params.search ? { orderNumber: { contains: params.search, mode: 'insensitive' } } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.purchaseOrder.count({ where }),
      this.prisma.purchaseOrder.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...purchaseOrderScalars,
          supplier: true,
          branch: true,
          charges: true,
          items: { include: { variant: { include: { product: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1 },
    };
  }

  async getOrder(user: any, id: string) {
    const row = await this.prisma.purchaseOrder.findFirst({
      where: { id, businessId: user.businessId, isDeleted: false, ...(user.branchId ? { branchId: user.branchId } : {}) },
      select: {
        ...purchaseOrderScalars,
        supplier: true,
        branch: true,
        charges: true,
        grns: { where: { isDeleted: false }, select: grnScalars },
        invoices: {
          where: { isDeleted: false },
          select: { id: true, invoiceNumber: true, invoiceDate: true, status: true, grandTotal: true },
        },
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!row) throw new NotFoundException('Purchase order not found');
    return row;
  }

  private async createOrderInternal(tx: any, user: any, branchId: string, dto: CreatePurchaseOrderDto) {
    const [supplier, branch, settings] = await Promise.all([
      tx.supplier.findUnique({ where: { id: dto.supplierId } }),
      tx.branch.findUnique({ where: { id: branchId } }),
      this.core.getSettings(user.businessId, tx),
    ]);
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (!branch) throw new NotFoundException('Branch not found');

    const lines: PurchaseCalculationLine[] = dto.items.map((item, idx) => ({
      id: item.variantId || item.itemName || `line-${idx}`,
      quantity: String(item.quantity),
      rate: String(item.unitRate),
      weight: item.weight ? String(item.weight) : undefined,
      lineDiscountType: item.discountType || 'AMOUNT',
      lineDiscountValue: String(item.discountValue || 0),
      taxRate: String(item.taxRate || 0),
    }));

    const calc = calculatePurchaseDocument(lines, {
      businessStateCode: branch.stateCode,
      supplierStateCode: supplier.stateCode || branch.stateCode,
      taxRegime: settings.taxRegime,
      pricesIncludeTax: dto.pricesIncludeTax === true,
      invoiceDiscountType: dto.invoiceDiscountType || 'AMOUNT',
      invoiceDiscountValue: String(dto.invoiceDiscountValue || 0),
      roundOff: String(dto.roundOff || 0),
      charges: (dto.charges || []).map((c) => ({
        ...c,
        amount: String(c.amount),
        isTaxable: Boolean(c.isTaxable),
        taxRate: c.taxRate !== undefined ? String(c.taxRate) : undefined,
      })),
    });

    const orderNumber = dto.orderNumber || (await this.core.nextNumber(tx, user.businessId, branchId, 'PO'));

    return tx.purchaseOrder.create({
      data: {
        businessId: user.businessId,
        branchId,
        supplierId: supplier.id,
        purchaseRequestId: dto.purchaseRequestId || null,
        orderNumber,
        orderDate: new Date(dto.orderDate || new Date()),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
        status: 'DRAFT',
        currencyCode: dto.currencyCode || 'INR',
        overReceiptTolerance: String(dto.overReceiptTolerance ?? settings.defaultOverReceiptTolerance ?? 5),
        pricesIncludeTax: dto.pricesIncludeTax === true,
        invoiceDiscountType: dto.invoiceDiscountType || null,
        invoiceDiscountValue: String(dto.invoiceDiscountValue || 0),
        discountAmount: calc.discountAmount,
        roundOff: calc.roundOff,
        taxableAmount: calc.taxableAmount,
        cgstAmount: calc.cgstAmount,
        sgstAmount: calc.sgstAmount,
        igstAmount: calc.igstAmount,
        vatAmount: calc.vatAmount,
        totalTax: calc.totalTax,
        additionalCharges: calc.additionalCharges,
        grandTotal: calc.grandTotal,
        calculationRule: calc.rule as any,
        taxSummary: calc.taxSummary as any,
        notes: dto.notes || null,
        terms: dto.terms || null,
        createdById: user.id,
        items: {
          create: dto.items.map((item, idx) => {
            const c = calc.items[idx];
            return {
              variantId: item.variantId || null,
              itemName: item.itemName || null,
              unit: item.unit || 'PCS',
              description: item.description || null,
              quantity: String(item.quantity),
              overReceiptTolerance:
                item.overReceiptTolerance !== undefined && item.overReceiptTolerance !== null
                  ? String(item.overReceiptTolerance)
                  : null,
              unitRate: String(item.unitRate),
              discountType: item.discountType || 'AMOUNT',
              discountValue: String(item.discountValue || 0),
              discountAmount: c.lineDiscount,
              taxableValue: c.taxableValue,
              taxRate: String(item.taxRate || 0),
              cgstAmount: c.cgstAmount,
              sgstAmount: c.sgstAmount,
              igstAmount: c.igstAmount,
              vatAmount: c.vatAmount,
              totalAmount: c.totalAmount,
            };
          }),
        },
        charges: dto.charges?.length
          ? {
              create: dto.charges.map((ch) => ({
                name: ch.name,
                amount: String(ch.amount),
                isTaxable: ch.isTaxable === true,
                taxRate: String(ch.taxRate || 0),
                taxAmount: ch.isTaxable ? ((Number(ch.amount) * Number(ch.taxRate || 0)) / 100).toFixed(2) : '0',
                allocationMethod: ch.allocationMethod || null,
                accountId: ch.accountId || null,
              })),
            }
          : undefined,
      },
      select: {
        ...purchaseOrderScalars,
        items: true,
        charges: true,
        supplier: true,
      },
    });
  }

  async createOrder(user: any, dto: CreatePurchaseOrderDto) {
    const branchId = this.core.requireBranch(user);
    return this.prisma.$transaction((tx) => this.createOrderInternal(tx, user, branchId, dto));
  }

  async updateOrder(user: any, id: string, dto: UpdatePurchaseOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseOrder.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        select: purchaseOrderScalars,
      });
      if (!existing) throw new NotFoundException('Purchase order not found');
      if (existing.status !== 'DRAFT') throw new BadRequestException('Only DRAFT purchase orders can be edited');
      this.core.assertVersion(dto.version, existing.version, 'Purchase order');

      const [supplier, branch, settings] = await Promise.all([
        tx.supplier.findUnique({ where: { id: dto.supplierId } }),
        tx.branch.findUnique({ where: { id: existing.branchId } }),
        this.core.getSettings(user.businessId, tx),
      ]);
      if (!supplier || !branch) throw new NotFoundException('Supplier or branch not found');

      const lines: PurchaseCalculationLine[] = dto.items.map((item, idx) => ({
        id: item.variantId || item.itemName || `line-${idx}`,
        quantity: String(item.quantity),
        rate: String(item.unitRate),
        weight: item.weight ? String(item.weight) : undefined,
        lineDiscountType: item.discountType || 'AMOUNT',
        lineDiscountValue: String(item.discountValue || 0),
        taxRate: String(item.taxRate || 0),
      }));

      const calc = calculatePurchaseDocument(lines, {
        businessStateCode: branch.stateCode,
        supplierStateCode: supplier.stateCode || branch.stateCode,
        taxRegime: settings.taxRegime,
        pricesIncludeTax: dto.pricesIncludeTax === true,
        invoiceDiscountType: dto.invoiceDiscountType || 'AMOUNT',
        invoiceDiscountValue: String(dto.invoiceDiscountValue || 0),
        roundOff: String(dto.roundOff || 0),
        charges: (dto.charges || []).map((c) => ({
          ...c,
          amount: String(c.amount),
          isTaxable: Boolean(c.isTaxable),
          taxRate: c.taxRate !== undefined ? String(c.taxRate) : undefined,
        })),
      });

      await tx.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: id } });
      await tx.purchaseOrderCharge.deleteMany({ where: { purchaseOrderId: id } });

      return tx.purchaseOrder.update({
        where: { id },
        data: {
          supplierId: supplier.id,
          orderDate: dto.orderDate ? new Date(dto.orderDate) : existing.orderDate,
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : existing.expectedDate,
          overReceiptTolerance: String(dto.overReceiptTolerance ?? existing.overReceiptTolerance),
          pricesIncludeTax: dto.pricesIncludeTax === true,
          invoiceDiscountType: dto.invoiceDiscountType || null,
          invoiceDiscountValue: String(dto.invoiceDiscountValue || 0),
          discountAmount: calc.discountAmount,
          roundOff: calc.roundOff,
          taxableAmount: calc.taxableAmount,
          cgstAmount: calc.cgstAmount,
          sgstAmount: calc.sgstAmount,
          igstAmount: calc.igstAmount,
          vatAmount: calc.vatAmount,
          totalTax: calc.totalTax,
          additionalCharges: calc.additionalCharges,
          grandTotal: calc.grandTotal,
          calculationRule: calc.rule as any,
          taxSummary: calc.taxSummary as any,
          notes: dto.notes ?? existing.notes,
          terms: dto.terms ?? existing.terms,
          updatedById: user.id,
          version: { increment: 1 },
          items: {
            create: dto.items.map((item, idx) => {
              const c = calc.items[idx];
              return {
                variantId: item.variantId || null,
                itemName: item.itemName || null,
                description: item.description || null,
                quantity: String(item.quantity),
                overReceiptTolerance: item.overReceiptTolerance !== undefined ? String(item.overReceiptTolerance) : null,
                unitRate: String(item.unitRate),
                discountType: item.discountType || 'AMOUNT',
                discountValue: String(item.discountValue || 0),
                discountAmount: c.lineDiscount,
                taxableValue: c.taxableValue,
                taxRate: String(item.taxRate || 0),
                cgstAmount: c.cgstAmount,
                sgstAmount: c.sgstAmount,
                igstAmount: c.igstAmount,
                vatAmount: c.vatAmount,
                totalAmount: c.totalAmount,
              };
            }),
          },
          charges: dto.charges?.length
            ? {
                create: dto.charges.map((ch) => ({
                  name: ch.name,
                  amount: String(ch.amount),
                  isTaxable: ch.isTaxable === true,
                  taxRate: String(ch.taxRate || 0),
                  taxAmount: ch.isTaxable ? ((Number(ch.amount) * Number(ch.taxRate || 0)) / 100).toFixed(2) : '0',
                  allocationMethod: ch.allocationMethod || null,
                  accountId: ch.accountId || null,
                })),
              }
            : undefined,
        },
        select: {
          ...purchaseOrderScalars,
          items: true,
          charges: true,
          supplier: true,
        },
      });
    });
  }

  async submitOrder(user: any, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        select: purchaseOrderScalars,
      });
      if (!po) throw new NotFoundException('Purchase order not found');
      assertPurchaseTransition('PO', po.status, 'PENDING_APPROVAL');

      const approval = await this.approvals.submitForApproval(tx, user, {
        documentType: 'PO',
        documentId: po.id,
        documentNumber: po.orderNumber,
        amount: Number(po.grandTotal),
      });

      const nextStatus = approval.autoApproved ? 'APPROVED' : 'PENDING_APPROVAL';
      return tx.purchaseOrder.update({
        where: { id },
        data: { status: nextStatus, updatedById: user.id, version: { increment: 1 } },
        select: purchaseOrderScalars,
      });
    });
  }

  async approveOrder(user: any, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        select: purchaseOrderScalars,
      });
      if (!po) throw new NotFoundException('Purchase order not found');
      assertPurchaseTransition('PO', po.status, 'APPROVED');
      return tx.purchaseOrder.update({
        where: { id },
        data: { status: 'APPROVED', updatedById: user.id, version: { increment: 1 } },
        select: purchaseOrderScalars,
      });
    });
  }

  async closeOrder(user: any, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        select: purchaseOrderScalars,
      });
      if (!po) throw new NotFoundException('Purchase order not found');
      assertPurchaseTransition('PO', po.status, 'CLOSED');
      return tx.purchaseOrder.update({
        where: { id },
        data: { status: 'CLOSED', updatedById: user.id, version: { increment: 1 } },
        select: purchaseOrderScalars,
      });
    });
  }

  async cancelOrder(user: any, id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        select: purchaseOrderScalars,
      });
      if (!po) throw new NotFoundException('Purchase order not found');
      const postedGrns = await tx.grn.count({ where: { purchaseOrderId: id, status: 'POSTED', isDeleted: false } });
      if (postedGrns > 0) throw new BadRequestException('Cannot cancel a PO that has posted GRNs');
      assertPurchaseTransition('PO', po.status, 'CANCELLED');
      return tx.purchaseOrder.update({
        where: { id },
        data: { status: 'CANCELLED', notes: reason, updatedById: user.id, version: { increment: 1 } },
        select: purchaseOrderScalars,
      });
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                         GOODS RECEIVED NOTES (GRN)                         */
  /* -------------------------------------------------------------------------- */

  async listGrns(user: any, params: PaginationParams & Record<string, any>) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const where: any = {
      businessId: user.businessId,
      isDeleted: false,
      ...(user.branchId ? { branchId: user.branchId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(params.search ? { grnNumber: { contains: params.search, mode: 'insensitive' } } : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.grn.count({ where }),
      this.prisma.grn.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...grnScalars,
          supplier: true,
          branch: true,
          purchaseOrder: {
            select: { id: true, orderNumber: true, status: true },
          },
          items: { include: { variant: { include: { product: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1 },
    };
  }

  async getGrn(user: any, id: string) {
    const row = await this.prisma.grn.findFirst({
      where: { id, businessId: user.businessId, isDeleted: false, ...(user.branchId ? { branchId: user.branchId } : {}) },
      select: {
        ...grnScalars,
        supplier: true,
        branch: true,
        purchaseOrder: {
          select: {
            ...purchaseOrderScalars,
            items: true,
          },
        },
        invoiceLinks: {
          include: {
            purchaseInvoice: {
              select: { id: true, invoiceNumber: true, invoiceDate: true, status: true, grandTotal: true },
            },
          },
        },
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!row) throw new NotFoundException('GRN not found');
    return row;
  }

  private calculateGrnTax(items: any[], branch: any, supplier: any, settings: any) {
    return calculatePurchaseDocument(
      items.map((item, index) => ({
        id: item.variantId || item.itemName || `grn-line-${index}`,
        quantity: String(item.quantity),
        rate: String(item.unitCost),
        taxRate: String(item.taxRate),
      })),
      {
        businessStateCode: branch.stateCode,
        supplierStateCode: supplier.stateCode || branch.stateCode,
        taxRegime: settings.taxRegime,
        pricesIncludeTax: false,
        invoiceDiscountType: 'AMOUNT',
        invoiceDiscountValue: '0',
        charges: [],
      },
    );
  }

  async createGrn(user: any, dto: CreateGrnDto) {
    const branchId = this.core.requireBranch(user);
    return this.prisma.$transaction(async (tx) => {
      let purchaseOrder: any = null;
      if (dto.purchaseOrderId) {
        purchaseOrder = await tx.purchaseOrder.findFirst({
          where: { id: dto.purchaseOrderId, businessId: user.businessId, isDeleted: false },
          select: { ...purchaseOrderScalars, items: true },
        });
        if (!purchaseOrder) throw new NotFoundException('Linked Purchase Order not found');
        if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(purchaseOrder.status)) {
          throw new BadRequestException('PO must be APPROVED or PARTIALLY_RECEIVED before creating a GRN');
        }
      }

      const grnNumber = dto.grnNumber || (await this.core.nextNumber(tx, user.businessId, branchId, 'GRN'));
      const resolvedItems = dto.items.map((item) => {
        const poItem = purchaseOrder?.items?.find(
          (p: any) => p.id === item.purchaseOrderItemId || (item.variantId && p.variantId === item.variantId),
        );
        const unitCost = Number(item.unitCost ?? poItem?.unitRate ?? 0);
        return {
          item,
          poItem,
          unitCost,
          landedCost: Number(item.landedCost ?? unitCost),
          taxRate: purchaseOrder ? 0 : Number(item.taxRate ?? poItem?.taxRate ?? 0),
        };
      });
      const totalAmount = resolvedItems.reduce(
        (sum, resolved) => sum + Number(resolved.item.quantity) * resolved.landedCost,
        0,
      );
      const calculation = purchaseOrder
        ? {
            taxableAmount: totalAmount.toFixed(2),
            totalTax: '0',
            grandTotal: totalAmount.toFixed(2),
            items: resolvedItems.map((r) => ({
              taxableValue: (Number(r.item.quantity) * r.unitCost).toFixed(2),
              cgstAmount: '0',
              sgstAmount: '0',
              igstAmount: '0',
              vatAmount: '0',
              taxAmount: '0',
            })),
          }
        : this.calculateGrnTax(
            resolvedItems.map(({ item, unitCost, taxRate }) => ({
              ...item,
              quantity: item.quantity,
              unitCost,
              taxRate,
            })),
            branch,
            supplier,
            settings,
          );

      const grn = await tx.grn.create({
        data: {
          businessId: user.businessId,
          branchId,
          supplierId,
          purchaseOrderId: purchaseOrder?.id || null,
          grnNumber,
          grnDate: new Date(dto.grnDate || new Date()),
          deliveryDate: dto.deliveryDate ? new Date(dto.deliveryDate) : null,
          status: 'DRAFT',
          totalAmount: totalAmount.toFixed(2),
          taxableAmount: calculation.taxableAmount,
          totalTax: calculation.totalTax,
          grandTotal: calculation.grandTotal,
          notes: dto.notes || null,
          createdById: user.id,
          items: {
            create: resolvedItems.map(({ item, poItem, unitCost, landedCost, taxRate }, index) => {
              const calculatedItem = calculation.items[index];
              return {
                variantId: item.variantId || null,
                itemName: item.itemName || poItem?.itemName || null,
                unit: item.unit || poItem?.unit || 'PCS',
                purchaseOrderItemId: item.purchaseOrderItemId || poItem?.id || null,
                quantity: String(item.quantity),
                rejectedQuantity: String(item.rejectedQuantity || 0),
                unitCost: cost.toFixed(4),
                landedCost: landed.toFixed(4),
              };
            }),
          },
        },
        select: { ...grnScalars, items: true, supplier: true },
      });

      if (dto.post) {
        return this.postGrnInTx(tx, user, grn.id);
      }
      return grn;
    });
  }

  async updateGrn(user: any, id: string, dto: UpdateGrnDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.grn.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        select: grnScalars,
      });
      if (!existing) throw new NotFoundException('GRN not found');
      if (existing.status !== 'DRAFT') throw new BadRequestException('Only DRAFT GRNs can be edited');
      this.core.assertVersion(dto.version, existing.version, 'GRN');

      await tx.grnItem.deleteMany({ where: { grnId: id } });
      const purchaseOrderId = dto.purchaseOrderId || existing.purchaseOrderId;
      const purchaseOrder = purchaseOrderId
        ? await tx.purchaseOrder.findFirst({
            where: { id: purchaseOrderId, businessId: user.businessId, isDeleted: false },
            select: { ...purchaseOrderScalars, items: true },
          })
        : null;
      const supplierId = purchaseOrder?.supplierId || dto.supplierId || existing.supplierId;
      const [branch, supplier, settings] = await Promise.all([
        tx.branch.findUnique({ where: { id: existing.branchId } }),
        tx.supplier.findUnique({ where: { id: supplierId } }),
        this.core.getSettings(user.businessId, tx),
      ]);
      if (!branch) throw new NotFoundException('Branch not found');
      if (!supplier) throw new NotFoundException('Supplier not found');
      const resolvedItems = dto.items.map((item) => {
        const poItem = purchaseOrder?.items?.find(
          (p: any) => p.id === item.purchaseOrderItemId || (item.variantId && p.variantId === item.variantId),
        );
        const unitCost = Number(item.unitCost ?? poItem?.unitRate ?? 0);
        return {
          item,
          poItem,
          unitCost,
          landedCost: Number(item.landedCost ?? unitCost),
          taxRate: purchaseOrder ? 0 : Number(item.taxRate ?? poItem?.taxRate ?? 0),
        };
      });
      const totalAmount = resolvedItems.reduce(
        (sum, resolved) => sum + Number(resolved.item.quantity) * resolved.landedCost,
        0,
      );
      const calculation = purchaseOrder
        ? {
            taxableAmount: totalAmount.toFixed(2),
            totalTax: '0',
            grandTotal: totalAmount.toFixed(2),
            items: resolvedItems.map((r) => ({
              taxableValue: (Number(r.item.quantity) * r.unitCost).toFixed(2),
              cgstAmount: '0',
              sgstAmount: '0',
              igstAmount: '0',
              vatAmount: '0',
              taxAmount: '0',
            })),
          }
        : this.calculateGrnTax(
            resolvedItems.map(({ item, unitCost, taxRate }) => ({
              ...item,
              quantity: item.quantity,
              unitCost,
              taxRate,
            })),
            branch,
            supplier,
            settings,
          );

      return tx.grn.update({
        where: { id },
        data: {
          grnDate: dto.grnDate ? new Date(dto.grnDate) : existing.grnDate,
          totalAmount: totalAmount.toFixed(2),
          taxableAmount: calculation.taxableAmount,
          totalTax: calculation.totalTax,
          grandTotal: calculation.grandTotal,
          notes: dto.notes ?? existing.notes,
          updatedById: user.id,
          version: { increment: 1 },
          items: {
            create: dto.items.map((item) => ({
              variantId: item.variantId || null,
              itemName: item.itemName || null,
              unit: item.unit || 'PCS',
              purchaseOrderItemId: item.purchaseOrderItemId || null,
              quantity: String(item.quantity),
              rejectedQuantity: String(item.rejectedQuantity || 0),
              unitCost: String(item.unitCost || 0),
              landedCost: String(item.landedCost ?? item.unitCost ?? 0),
            })),
          },
        },
        select: { ...grnScalars, items: true, supplier: true },
      });
    });
  }

  async postGrn(user: any, id: string) {
    return this.prisma.$transaction((tx) => this.postGrnInTx(tx, user, id));
  }

  private async postGrnInTx(tx: any, user: any, id: string) {
    const grn = await tx.grn.findFirst({
      where: { id, businessId: user.businessId, isDeleted: false },
      select: {
        ...grnScalars,
        items: { include: { variant: true } },
        purchaseOrder: { select: { ...purchaseOrderScalars, items: true } },
        supplier: true,
      },
    });
    if (!grn) throw new NotFoundException('GRN not found');
    assertPurchaseTransition('GRN', grn.status, 'POSTED');

    const settings = await this.core.getSettings(user.businessId, tx);
    let totalAccrualValue = 0;

    for (const item of grn.items) {
      if (grn.purchaseOrder) {
        const poItem = grn.purchaseOrder.items.find(
          (p: any) => p.id === item.purchaseOrderItemId || p.variantId === item.variantId,
        );
        if (poItem) {
          // Tolerance precedence: PO Line > ProductVariant > PO Header > Business Settings (default 5%)
          const tolPct = Number(
            poItem.overReceiptTolerance ??
              item.variant?.overReceiptTolerance ??
              grn.purchaseOrder.overReceiptTolerance ??
              settings.defaultOverReceiptTolerance ??
              5,
          );
          const maxAllowed = Number(poItem.quantity) * (1 + tolPct / 100);
          const newReceived = Number(poItem.receivedQuantity) + Number(item.quantity);
          if (newReceived > maxAllowed + 0.0001) {
            throw new BadRequestException(
              `Over-receipt tolerance (${tolPct}%) exceeded for ${item.variant?.name || item.variantId}`,
            );
          }
        }
      }

      const qty = Number(item.quantity);
      const unitLanded = Number(item.landedCost || item.unitCost || 0);
      totalAccrualValue += qty * unitLanded;

      if (item.variantId) {
        await this.core.applyStockIn(tx, {
          branchId: grn.branchId,
          variantId: item.variantId,
          quantity: qty,
          landedUnitCost: unitLanded,
          costingMethod: settings.costingMethod,
          referenceId: grn.id,
          referenceDocumentType: 'GRN',
          idempotencyKey: `GRN:${grn.id}:${item.id}:POST`,
          performedById: user.id,
          notes: `Goods received under ${grn.grnNumber}`,
        });
      }
    }

    // Update PO received quantities & status
    if (grn.purchaseOrder) {
      for (const poItem of grn.purchaseOrder.items) {
        const added = grn.items
          .filter((gi: any) => gi.purchaseOrderItemId === poItem.id || (!gi.purchaseOrderItemId && gi.variantId === poItem.variantId))
          .reduce((s: number, gi: any) => s + Number(gi.quantity), 0);
        if (added > 0) {
          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: { receivedQuantity: (Number(poItem.receivedQuantity) + added).toFixed(3) },
          });
        }
      }
      const updatedPoItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: grn.purchaseOrder.id } });
      const anyRemaining = updatedPoItems.some((i: any) => Number(i.receivedQuantity) < Number(i.quantity));
      await tx.purchaseOrder.update({
        where: { id: grn.purchaseOrder.id },
        data: {
          status: anyRemaining ? 'PARTIALLY_RECEIVED' : 'FULLY_RECEIVED',
          updatedById: user.id,
          version: { increment: 1 },
        },
        select: { id: true },
      });
    }

    // Optional (enabled by default) GRN Accrual Accounting: Dr Inventory / Cr GRN Clearing
    let journalId: string | null = null;
    if (settings.enableGrnAccrual && totalAccrualValue > 0) {
      const accounts = await this.core.resolveAccounts(tx, user.businessId, settings);
      if (!accounts.inventory || !accounts.grnClearing) {
        throw new BadRequestException('Inventory or GRN Clearing account is not configured for GRN accrual');
      }
      const journal = await this.core.createBalancedJournal(tx, {
        businessId: user.businessId,
        entryNumber: `JRN-${grn.grnNumber}`,
        date: grn.grnDate,
        narration: `GRN Accrual ${grn.grnNumber} from ${grn.supplier?.name || 'Supplier'}`,
        reference: grn.grnNumber,
        lines: [
          { accountId: accounts.inventory.id, debit: totalAccrualValue, credit: 0, notes: `Inventory received (${grn.grnNumber})` },
          { accountId: accounts.grnClearing.id, debit: 0, credit: totalAccrualValue, notes: `GRN Clearing accrual (${grn.grnNumber})` },
        ],
      });
      journalId = journal.id;
    }

    return tx.grn.update({
      where: { id: grn.id },
      data: {
        status: 'POSTED',
        totalAmount: totalAccrualValue.toFixed(2),
        journalEntryId: journalId,
        updatedById: user.id,
        version: { increment: 1 },
      },
      select: {
        ...grnScalars,
        items: true,
        supplier: true,
        purchaseOrder: { select: { ...purchaseOrderScalars } },
      },
    });
  }

  async cancelGrn(user: any, id: string, reason: string) {
    return this.prisma.$transaction(async (tx) => {
      const grn = await tx.grn.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        select: {
          ...grnScalars,
          items: true,
          purchaseOrder: { select: { ...purchaseOrderScalars, items: true } },
        },
      });
      if (!grn) throw new NotFoundException('GRN not found');

      const linkedInvoices = await tx.purchaseInvoiceGrn.count({
        where: { grnId: id, purchaseInvoice: { status: { not: 'CANCELLED' }, isDeleted: false } },
      });
      if (linkedInvoices > 0) {
        throw new BadRequestException('Cannot cancel a GRN that is linked to an active Purchase Invoice');
      }

      assertPurchaseTransition('GRN', grn.status, 'CANCELLED');

      if (grn.status === 'POSTED') {
        const settings = await this.core.getSettings(user.businessId, tx);
        for (const item of grn.items) {
          if (item.variantId) {
            await this.core.applyStockOut(tx, {
              branchId: grn.branchId,
              variantId: item.variantId,
              quantity: Number(item.quantity),
              unitCost: Number(item.landedCost || item.unitCost || 0),
              costingMethod: settings.costingMethod,
              blockOnInsufficient: true,
              movementType: 'ADJUSTMENT_SUB',
              referenceId: grn.id,
              referenceDocumentType: 'GRN_CANCEL',
              idempotencyKey: `GRN:${grn.id}:${item.id}:CANCEL`,
              performedById: user.id,
              notes: `Cancelled GRN ${grn.grnNumber}: ${reason}`,
            });
          }

          if (grn.purchaseOrder && item.purchaseOrderItemId) {
            const poItem = grn.purchaseOrder.items.find((p: any) => p.id === item.purchaseOrderItemId);
            if (poItem) {
              const nextRec = Math.max(0, Number(poItem.receivedQuantity) - Number(item.quantity));
              await tx.purchaseOrderItem.update({
                where: { id: poItem.id },
                data: { receivedQuantity: nextRec.toFixed(3) },
              });
            }
          }
        }

        if (grn.purchaseOrder) {
          const allItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: grn.purchaseOrder.id } });
          const anyRec = allItems.some((i: any) => Number(i.receivedQuantity) > 0);
          await tx.purchaseOrder.update({
            where: { id: grn.purchaseOrder.id },
            data: { status: anyRec ? 'PARTIALLY_RECEIVED' : 'APPROVED', updatedById: user.id, version: { increment: 1 } },
            select: { id: true },
          });
        }

        if (grn.journalEntryId) {
          await this.core.reverseJournal(tx, user.businessId, grn.journalEntryId, `REV-${grn.grnNumber}`, reason);
        }
      }

      return tx.grn.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
          updatedById: user.id,
          version: { increment: 1 },
        },
        select: grnScalars,
      });
    });
  }
}
