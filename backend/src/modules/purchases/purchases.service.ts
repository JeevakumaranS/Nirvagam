import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationParams } from '@nirvagam/shared';
import { calculatePurchaseDocument, PurchaseCalculationLine } from '@nirvagam/shared';
import { assertPurchaseTransition, PurchaseDocumentType } from './purchase-status';

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  private async nextNumber(
    tx: any,
    businessId: string,
    branchId: string,
    documentType: 'PR' | 'PO' | 'GRN' | 'PI' | 'PRN' | 'PAY',
  ) {
    const series = await tx.documentNumberSeries.findFirst({
      where: { businessId, branchId, documentType, isActive: true },
    });
    if (!series) {
      return `${documentType}-${Date.now()}`;
    }
    const number = series.currentNumber;
    await tx.documentNumberSeries.update({
      where: { id: series.id },
      data: { currentNumber: { increment: 1 }, resetYear: new Date().getUTCFullYear() },
    });
    return `${series.prefix}${String(number).padStart(series.padding, '0')}${series.suffix || ''}`;
  }

  private requireBranch(user: any) {
    if (!user.branchId) throw new BadRequestException('A branch is required for purchase transactions');
  }

  async findAll(user: any, params: PaginationParams & Record<string, any>, document: 'requests' | 'orders' | 'grns' | 'invoices' | 'returns' | 'payments') {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;
    const model = ({
      requests: 'purchaseRequest',
      orders: 'purchaseOrder',
      grns: 'grn',
      invoices: 'purchaseInvoice',
      returns: 'purchaseReturn',
      payments: 'purchasePayment',
    } as const)[document];
    const where: any = {
      businessId: user.businessId,
      isDeleted: false,
      ...(user.branchId ? { branchId: user.branchId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
    };
    const [total, data] = await Promise.all([
      (this.prisma as any)[model].count({ where }),
      (this.prisma as any)[model].findMany({
        where,
        skip,
        take: limit,
        include: {
          supplier: true,
          branch: true,
          items: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1 },
    };
  }

  async findOne(user: any, document: 'requests' | 'orders' | 'grns' | 'invoices' | 'returns' | 'payments', id: string) {
    const model = ({
      requests: 'purchaseRequest',
      orders: 'purchaseOrder',
      grns: 'grn',
      invoices: 'purchaseInvoice',
      returns: 'purchaseReturn',
      payments: 'purchasePayment',
    } as const)[document];
    const row = await (this.prisma as any)[model].findFirst({
      where: { id, businessId: user.businessId, isDeleted: false, ...(user.branchId ? { branchId: user.branchId } : {}) },
      include: {
        supplier: true,
        branch: true,
        items: true,
        ...(document === 'invoices' ? { charges: true, grnLinks: true, allocations: true } : {}),
        ...(document === 'payments' ? { allocations: true } : {}),
      },
    });
    if (!row) throw new NotFoundException(`Purchase ${document.replace(/s$/, '')} not found`);
    return row;
  }

  async createRequest(user: any, dto: any) {
    this.requireBranch(user);
    return this.prisma.$transaction(async (tx) => {
      const number = dto.requestNumber || await this.nextNumber(tx, user.businessId, user.branchId, 'PR');
      return tx.purchaseRequest.create({
        data: {
          businessId: user.businessId,
          branchId: user.branchId,
          supplierId: dto.supplierId || null,
          requestNumber: number,
          requestDate: new Date(dto.requestDate || new Date()),
          department: dto.department,
          status: 'DRAFT',
          notes: dto.notes,
          createdById: user.id,
          items: dto.items?.length ? {
            create: dto.items.map((item: any) => ({
              variantId: item.variantId,
              description: item.description,
              quantity: String(item.quantity),
              requiredDate: item.requiredDate ? new Date(item.requiredDate) : null,
              preferredRate: String(item.preferredRate || 0),
            })),
          } : undefined,
        },
        include: { items: true, supplier: true },
      });
    });
  }

  async changeRequestStatus(user: any, id: string, action: 'submit' | 'approve' | 'reject' | 'cancel', dto: any = {}) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.purchaseRequest.findFirst({ where: { id, businessId: user.businessId, isDeleted: false } });
      if (!document) throw new NotFoundException('Purchase request not found');
      const target = action === 'submit' ? 'PENDING_APPROVAL'
        : action === 'approve' ? 'APPROVED'
        : action === 'reject' ? 'REJECTED' : 'CANCELLED';
      assertPurchaseTransition('PR', document.status, target);
      if ((action === 'reject') && !dto.reason) throw new BadRequestException('Rejection reason is mandatory');
      return tx.purchaseRequest.update({
        where: { id },
        data: {
          status: target,
          updatedById: user.id,
          version: { increment: 1 },
          ...(action === 'reject' ? { notes: dto.reason } : {}),
        },
      });
    });
  }

  async convertRequestToPo(user: any, id: string, dto: any = {}) {
    this.requireBranch(user);
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.purchaseRequest.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        include: { items: true },
      });
      if (!request) throw new NotFoundException('Purchase request not found');
      if (request.status !== 'APPROVED') throw new BadRequestException('Only approved purchase requests can be converted');
      const number = dto.orderNumber || await this.nextNumber(tx, user.businessId, user.branchId, 'PO');
      const order = await tx.purchaseOrder.create({
        data: {
          businessId: user.businessId,
          branchId: user.branchId,
          supplierId: dto.supplierId || request.supplierId,
          purchaseRequestId: request.id,
          orderNumber: number,
          orderDate: new Date(dto.orderDate || new Date()),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          warehouseId: dto.warehouseId,
          status: 'DRAFT',
          createdById: user.id,
          items: {
            create: (dto.items || request.items).map((item: any) => ({
              variantId: item.variantId,
              description: item.description,
              quantity: String(item.quantity),
              unitRate: String(item.unitRate || item.preferredRate || 0),
              discountType: item.discountType || 'AMOUNT',
              discountValue: String(item.discountValue || 0),
              taxRate: String(item.taxRate || 0),
            })),
          },
        },
        include: { items: true },
      });
      await tx.purchaseRequest.update({
        where: { id },
        data: { status: 'CONVERTED', updatedById: user.id, version: { increment: 1 } },
      });
      return order;
    });
  }

  async createOrder(user: any, dto: any) {
    this.requireBranch(user);
    return this.prisma.$transaction(async (tx) => {
      if (!dto.supplierId) throw new BadRequestException('Supplier is required');
      if (!dto.items?.length) throw new BadRequestException('At least one PO item is required');
      if (!dto.warehouseId) throw new BadRequestException('Warehouse is required');
      const number = dto.orderNumber || await this.nextNumber(tx, user.businessId, user.branchId, 'PO');
      return tx.purchaseOrder.create({
        data: {
          businessId: user.businessId,
          branchId: user.branchId,
          supplierId: dto.supplierId,
          purchaseRequestId: dto.purchaseRequestId || null,
          orderNumber: number,
          orderDate: new Date(dto.orderDate || new Date()),
          expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
          warehouseId: dto.warehouseId,
          overReceiptTolerance: String(dto.overReceiptTolerance ?? 5),
          pricesIncludeTax: dto.pricesIncludeTax === true,
          invoiceDiscountType: dto.invoiceDiscountType || null,
          invoiceDiscountValue: String(dto.invoiceDiscountValue || 0),
          roundOff: String(dto.roundOff || 0),
          notes: dto.notes,
          terms: dto.terms,
          createdById: user.id,
          items: {
            create: dto.items.map((item: any) => ({
              variantId: item.variantId,
              description: item.description,
              quantity: String(item.quantity),
              unitRate: String(item.unitRate),
              discountType: item.discountType || 'AMOUNT',
              discountValue: String(item.discountValue || 0),
              taxRate: String(item.taxRate || 0),
            })),
          },
        },
        include: { items: true, supplier: true },
      });
  });
  }

  async changeOrderStatus(user: any, id: string, action: 'submit' | 'approve' | 'cancel', dto: any = {}) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.purchaseOrder.findFirst({ where: { id, businessId: user.businessId, isDeleted: false } });
      if (!document) throw new NotFoundException('Purchase order not found');
      const target = action === 'submit' ? 'PENDING_APPROVAL' : action === 'approve' ? 'APPROVED' : 'CANCELLED';
      assertPurchaseTransition('PO', document.status, target);
      return tx.purchaseOrder.update({ where: { id }, data: { status: target, updatedById: user.id, version: { increment: 1 } } });
    });
  }

  async createGrn(user: any, dto: any) {
    this.requireBranch(user);
    return this.prisma.$transaction(async (tx) => {
      if (!dto.items?.length) throw new BadRequestException('At least one GRN item is required');
      let supplierId = dto.supplierId;
      let po: any = null;
      if (dto.purchaseOrderId) {
        po = await tx.purchaseOrder.findFirst({
          where: { id: dto.purchaseOrderId, businessId: user.businessId },
          include: { items: true, supplier: true },
        });
        if (!po) throw new NotFoundException('Purchase order not found');
        if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) throw new BadRequestException('PO must be approved before GRN');
        supplierId = po.supplierId;
      }
      const warehouseId = dto.warehouseId || (await tx.warehouse.findFirst({ where: { branchId: user.branchId, isDefault: true } }))?.id;
      if (!warehouseId) throw new BadRequestException('A warehouse is required');
      const number = dto.grnNumber || await this.nextNumber(tx, user.businessId, user.branchId, 'GRN');
      const grn = await tx.grn.create({
        data: {
          businessId: user.businessId,
          branchId: user.branchId,
          supplierId,
          purchaseOrderId: po?.id || null,
          warehouseId,
          grnNumber: number,
          grnDate: new Date(dto.grnDate || new Date()),
          status: 'DRAFT',
          notes: dto.notes,
          createdById: user.id,
          items: {
            create: dto.items.map((item: any) => ({
              variantId: item.variantId,
              purchaseOrderItemId: item.purchaseOrderItemId || null,
              quantity: String(item.quantity),
              rejectedQuantity: String(item.rejectedQuantity || 0),
              unitCost: String(item.unitCost || 0),
              landedCost: String(item.landedCost || item.unitCost || 0),
              batchNumber: item.batchNumber,
              serialNumber: item.serialNumber,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
            })),
          },
        },
        include: { items: true },
      });
      return grn;
  });
  }

  async postGrn(user: any, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const grn = await tx.grn.findFirst({ where: { id, businessId: user.businessId, isDeleted: false }, include: { items: true, purchaseOrder: { include: { items: true } } } });
      if (!grn) throw new NotFoundException('GRN not found');
      assertPurchaseTransition('GRN', grn.status, 'POSTED');
      for (const item of grn.items) {
        if (grn.purchaseOrder) {
          const poItem = grn.purchaseOrder.items.find((p: any) => p.id === item.purchaseOrderItemId);
          if (poItem) {
            const tolerance = Number(grn.purchaseOrder.overReceiptTolerance) / 100;
            const received = Number(poItem.receivedQuantity) + Number(item.quantity);
            if (received > Number(poItem.quantity) * (1 + tolerance)) throw new BadRequestException(`Over-receipt tolerance exceeded for item ${item.variantId}`);
          }
        }
        await tx.stockBalance.upsert({
          where: { warehouseId_variantId: { warehouseId: grn.warehouseId, variantId: item.variantId } },
          create: { warehouseId: grn.warehouseId, variantId: item.variantId, quantity: item.quantity, averageCost: item.landedCost },
          update: { quantity: { increment: item.quantity }, averageCost: item.landedCost },
        });
        await tx.stockMovement.create({
          data: {
            warehouseId: grn.warehouseId,
            variantId: item.variantId,
            type: 'IN_PURCHASE',
            quantity: item.quantity,
            unitCost: item.landedCost,
            totalCost: String(Number(item.quantity) * Number(item.landedCost)),
            referenceId: grn.id,
            referenceDocumentType: 'GRN',
            batchNumber: item.batchNumber,
            serialNumber: item.serialNumber,
            expiryDate: item.expiryDate,
            idempotencyKey: `GRN:${grn.id}:${item.id}:POST`,
            notes: `Goods received under ${grn.grnNumber}`,
          },
        });
      }
      if (grn.purchaseOrder) {
        for (const poItem of grn.purchaseOrder.items) {
          const received = grn.items.filter((item: any) => item.purchaseOrderItemId === poItem.id).reduce((sum: number, item: any) => sum + Number(item.quantity), Number(poItem.receivedQuantity));
          await tx.purchaseOrderItem.update({ where: { id: poItem.id }, data: { receivedQuantity: String(received) } });
        }
        const allItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: grn.purchaseOrder.id } });
        const anyPartial = allItems.some((item: any) => Number(item.receivedQuantity) < Number(item.quantity));
        const poStatus = anyPartial ? 'PARTIALLY_RECEIVED' : 'FULLY_RECEIVED';
        await tx.purchaseOrder.update({ where: { id: grn.purchaseOrder.id }, data: { status: poStatus, version: { increment: 1 }, updatedById: user.id } });
      }
      return tx.grn.update({ where: { id }, data: { status: 'POSTED', updatedById: user.id, version: { increment: 1 } } });
  });
  }

  async createInvoice(user: any, dto: any) {
    this.requireBranch(user);
    if (!dto.supplierId) throw new BadRequestException('Supplier is required');
    if (!dto.items?.length) throw new BadRequestException('At least one invoice item is required');
    if (dto.invoiceDate && dto.purchaseOrderId) {
      const po = await this.prisma.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId } });
      if (po && new Date(dto.invoiceDate) < po.orderDate) throw new BadRequestException('Invoice date cannot be before PO date');
    }
    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.purchaseInvoice.findFirst({
        where: { branchId: user.branchId, supplierId: dto.supplierId, supplierBillNumber: dto.supplierBillNumber, isDeleted: false },
      });
      if (duplicate) throw new ConflictException('Duplicate supplier invoice number');
      const supplier = await tx.supplier.findUnique({ where: { id: dto.supplierId } });
      if (!supplier) throw new NotFoundException('Supplier not found');
      const branch = await tx.branch.findUnique({ where: { id: user.branchId } });
      if (!branch) throw new NotFoundException('Branch not found');

      const mode = dto.mode === 'DIRECT' ? 'DIRECT' : 'AGAINST_PO_GRN';
      const lines: PurchaseCalculationLine[] = dto.items.map((item: any) => ({
        id: item.variantId,
        quantity: String(item.quantity),
        rate: String(item.unitRate),
        weight: item.weight ? String(item.weight) : undefined,
        lineDiscountType: item.discountType || 'AMOUNT',
        lineDiscountValue: String(item.discountValue || 0),
        taxRate: String(item.taxRate || 0),
      }));
      const result = calculatePurchaseDocument(lines, {
        businessStateCode: branch.stateCode,
        supplierStateCode: supplier.stateCode || branch.stateCode,
        pricesIncludeTax: dto.pricesIncludeTax === true,
        invoiceDiscountType: dto.invoiceDiscountType || 'AMOUNT',
        invoiceDiscountValue: String(dto.invoiceDiscountValue || 0),
        roundOff: String(dto.roundOff || 0),
        charges: dto.charges || [],
      });

      if (mode === 'AGAINST_PO_GRN') {
        if (!dto.grnIds?.length && !dto.purchaseOrderId) throw new BadRequestException('Against-PO/GRN invoice requires a PO or GRN');
        for (const item of dto.items) {
          if (item.grnItemId) {
            const grnItem = await tx.grnItem.findUnique({ where: { id: item.grnItemId } });
            if (!grnItem) throw new BadRequestException('Linked GRN item not found');
            if (Number(item.quantity) <= 0) throw new BadRequestException('Invoice quantity must be positive');
          }
        }
      }

      const number = dto.invoiceNumber || await this.nextNumber(tx, user.businessId, user.branchId, 'PI');
      const warehouseId = dto.warehouseId || (await tx.warehouse.findFirst({ where: { branchId: user.branchId, isDefault: true } }))?.id;
      if (mode === 'DIRECT' && !warehouseId) throw new BadRequestException('A warehouse is required for direct purchase invoices');

      const dueDate = dto.dueDate
        ? new Date(dto.dueDate)
        : new Date(new Date(dto.invoiceDate || new Date()).getTime() + Number(supplier.creditPeriodDays || 30) * 86400000);

      const invoice = await tx.purchaseInvoice.create({
        data: {
          businessId: user.businessId,
          branchId: user.branchId,
          supplierId: supplier.id,
          purchaseOrderId: dto.purchaseOrderId || null,
          invoiceNumber: number,
          supplierBillNumber: dto.supplierBillNumber,
          invoiceDate: new Date(dto.invoiceDate || new Date()),
          dueDate,
          mode,
          status: dto.post === true ? 'APPROVED' : 'DRAFT',
          warehouseId: mode === 'DIRECT' ? warehouseId : null,
          pricesIncludeTax: dto.pricesIncludeTax === true,
          invoiceDiscountType: dto.invoiceDiscountType || null,
          invoiceDiscountValue: String(dto.invoiceDiscountValue || 0),
          roundOff: result.roundOff,
          taxableAmount: result.taxableAmount,
          cgstAmount: result.cgstAmount,
          sgstAmount: result.sgstAmount,
          igstAmount: result.igstAmount,
          vatAmount: result.vatAmount,
          totalTax: result.totalTax,
          additionalCharges: result.additionalCharges,
          grandTotal: result.grandTotal,
          paidAmount: 0,
          balanceAmount: result.grandTotal,
          calculationRule: result.rule as any,
          taxSummary: result.taxSummary,
          idempotencyKey: dto.idempotencyKey,
          postedAt: dto.post === true ? new Date() : null,
          notes: dto.notes,
          terms: dto.terms,
          createdById: user.id,
          items: {
            create: dto.items.map((item: any, index: number) => {
              const computed = result.items[index];
              return {
                variantId: item.variantId,
                grnItemId: item.grnItemId || null,
                purchaseOrderItemId: item.purchaseOrderItemId || null,
                description: item.description,
                quantity: String(item.quantity),
                unitRate: String(item.unitRate),
                discountType: item.discountType || 'AMOUNT',
                discountValue: String(item.discountValue || 0),
                discountAmount: computed.lineDiscount,
                taxableValue: computed.taxableValue,
                taxRate: String(item.taxRate || 0),
                cgstAmount: computed.cgstAmount,
                sgstAmount: computed.sgstAmount,
                igstAmount: computed.igstAmount,
                vatAmount: computed.vatAmount,
                landedCost: computed.landedCost,
                totalAmount: computed.totalAmount,
                batchNumber: item.batchNumber,
                serialNumber: item.serialNumber,
                expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              };
            }),
          },
          charges: dto.charges?.length ? {
            create: dto.charges.map((charge: any) => ({
              chargeType: charge.type,
              name: charge.name,
              amount: String(charge.amount),
              isTaxable: charge.isTaxable === true,
              taxRate: String(charge.taxRate || 0),
              allocationMethod: charge.allocationMethod || null,
              accountId: charge.accountId || null,
            })),
          } : undefined,
          grnLinks: dto.grnIds?.length ? {
            create: dto.grnIds.map((grnId: string) => ({ grnId })),
          } : undefined,
        },
        include: { items: true, charges: true, grnLinks: true },
      });

      if (dto.post === true) {
        await this.postInvoiceInTransaction(tx, user, invoice);
      }
      return invoice;
    });
  }

  private async postInvoiceInTransaction(tx: any, user: any, invoice: any) {
    const branch = await tx.branch.findUnique({ where: { id: invoice.branchId } });
    const supplier = await tx.supplier.findUnique({ where: { id: invoice.supplierId } });
    const [ap, purchase, inventory, cgst, sgst, igst] = await Promise.all([
      tx.chartOfAccount.findFirst({ where: { businessId: invoice.businessId, code: '2010' } }),
      tx.chartOfAccount.findFirst({ where: { businessId: invoice.businessId, code: '5020' } }),
      tx.chartOfAccount.findFirst({ where: { businessId: invoice.businessId, code: '1020' } }),
      tx.chartOfAccount.findFirst({ where: { businessId: invoice.businessId, code: '1051' } }),
      tx.chartOfAccount.findFirst({ where: { businessId: invoice.businessId, code: '1052' } }),
      tx.chartOfAccount.findFirst({ where: { businessId: invoice.businessId, code: '1053' } }),
    ]);
    if (!ap || !purchase) throw new BadRequestException('Default Accounts Payable and Purchase accounts are not configured');

    const debitTotal = Number(invoice.taxableAmount) + Number(invoice.additionalCharges) + Number(invoice.totalTax);
    const creditTotal = Number(invoice.grandTotal);
    if (Math.abs(debitTotal - creditTotal) > 0.01) throw new BadRequestException('Purchase journal entry is out of balance');

    const journal = await tx.journalEntry.create({
      data: {
        businessId: invoice.businessId,
        entryNumber: `JRN-${invoice.invoiceNumber}`,
        date: invoice.invoiceDate,
        narration: `Purchase invoice ${invoice.invoiceNumber} from ${supplier.name}`,
        reference: invoice.invoiceNumber,
        isPosted: true,
      },
    });
    await tx.journalLine.create({
      data: { journalEntryId: journal.id, accountId: (inventory || purchase).id, debit: Number(invoice.taxableAmount) + Number(invoice.additionalCharges), credit: 0, notes: 'Purchase inventory and charges' },
    });
    if (Number(invoice.cgstAmount) > 0 && cgst) await tx.journalLine.create({ data: { journalEntryId: journal.id, accountId: cgst.id, debit: invoice.cgstAmount, credit: 0, notes: 'Input CGST' } });
    if (Number(invoice.sgstAmount) > 0 && sgst) await tx.journalLine.create({ data: { journalEntryId: journal.id, accountId: sgst.id, debit: invoice.sgstAmount, credit: 0, notes: 'Input SGST' } });
    if (Number(invoice.igstAmount) > 0 && igst) await tx.journalLine.create({ data: { journalEntryId: journal.id, accountId: igst.id, debit: invoice.igstAmount, credit: 0, notes: 'Input IGST' } });
    await tx.journalLine.create({ data: { journalEntryId: journal.id, accountId: ap.id, debit: 0, credit: invoice.grandTotal, notes: `Payable to ${supplier.name}` } });

    if (invoice.mode === 'DIRECT') {
      const items = await tx.purchaseInvoiceItem.findMany({ where: { purchaseInvoiceId: invoice.id } });
      for (const item of items) {
        await tx.stockBalance.upsert({
          where: { warehouseId_variantId: { warehouseId: invoice.warehouseId!, variantId: item.variantId } },
          create: { warehouseId: invoice.warehouseId!, variantId: item.variantId, quantity: item.quantity, averageCost: item.landedCost },
          update: { quantity: { increment: item.quantity }, averageCost: item.landedCost },
        });
        await tx.stockMovement.create({
          data: {
            warehouseId: invoice.warehouseId!,
            variantId: item.variantId,
            type: 'IN_PURCHASE',
            quantity: item.quantity,
            unitCost: item.landedCost,
            totalCost: String(Number(item.quantity) * Number(item.landedCost)),
            referenceId: invoice.id,
            referenceDocumentType: 'PURCHASE_INVOICE',
            batchNumber: item.batchNumber,
            serialNumber: item.serialNumber,
            expiryDate: item.expiryDate,
            idempotencyKey: `INVOICE:${invoice.id}:${item.id}:POST`,
            notes: `Direct purchase invoice ${invoice.invoiceNumber}`,
          },
        });
      }
    }

    await tx.purchaseInvoice.update({
      where: { id: invoice.id },
      data: { status: 'APPROVED', journalEntryId: journal.id, postedAt: new Date(), balanceAmount: invoice.grandTotal, updatedById: user.id, version: { increment: 1 } },
    });
  }

  async postInvoice(user: any, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        include: { items: true, charges: true, grnLinks: true },
      });
      if (!invoice) throw new NotFoundException('Purchase invoice not found');
      assertPurchaseTransition('INVOICE', invoice.status, 'APPROVED');
      await this.postInvoiceInTransaction(tx, user, invoice);
      return tx.purchaseInvoice.findUnique({ where: { id }, include: { items: true, charges: true, supplier: true } });
    });
  }

  async cancelInvoice(user: any, id: string, dto: any = {}) {
    if (!dto.reason) throw new BadRequestException('Cancellation reason is mandatory');
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        include: { items: true, allocations: true, grnLinks: true },
      });
      if (!invoice) throw new NotFoundException('Purchase invoice not found');
      if (invoice.allocations.length) throw new BadRequestException('Cannot cancel an invoice with payment allocations');
      if (invoice.status === 'PAID') throw new BadRequestException('Paid invoices cannot be cancelled');
      assertPurchaseTransition('INVOICE', invoice.status, 'CANCELLED');
      if (invoice.mode === 'DIRECT') {
        for (const item of invoice.items) {
          await tx.stockMovement.create({
            data: {
              warehouseId: invoice.warehouseId!,
              variantId: item.variantId,
              type: 'ADJUSTMENT_SUB',
              quantity: item.quantity,
              unitCost: item.landedCost,
              totalCost: String(Number(item.quantity) * Number(item.landedCost)),
              referenceId: invoice.id,
              referenceDocumentType: 'PURCHASE_INVOICE_CANCEL',
              idempotencyKey: `INVOICE:${invoice.id}:${item.id}:CANCEL`,
              notes: dto.reason,
            },
          });
          await tx.stockBalance.update({
            where: { warehouseId_variantId: { warehouseId: invoice.warehouseId!, variantId: item.variantId } },
            data: { quantity: { decrement: item.quantity } },
          });
        }
      }
      return tx.purchaseInvoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: dto.reason,
          updatedById: user.id,
          version: { increment: 1 },
        },
      });
    });
  }

  async createReturn(user: any, dto: any) {
    this.requireBranch(user);
    if (!dto.purchaseInvoiceId) throw new BadRequestException('Original purchase invoice is required');
    if (!dto.items?.length) throw new BadRequestException('At least one return item is required');
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { id: dto.purchaseInvoiceId, businessId: user.businessId, isDeleted: false },
        include: { items: true, supplier: true },
      });
      if (!invoice) throw new NotFoundException('Purchase invoice not found');
      if (!['APPROVED', 'PARTIALLY_PAID', 'PAID'].includes(invoice.status)) throw new BadRequestException('Only posted purchase invoices can be returned');

      let taxable = 0;
      let totalTax = 0;
      const itemRows = dto.items.map((item: any) => {
        const original = invoice.items.find((line: any) => line.variantId === item.variantId);
        if (!original) throw new BadRequestException(`Item ${item.variantId} does not belong to the purchase invoice`);
        if (Number(item.quantity) > Number(original.quantity)) throw new BadRequestException('Cannot return more than the invoiced quantity');
        const rate = Number(original.unitRate);
        const taxableValue = Number(item.quantity) * rate;
        const tax = taxableValue * Number(original.taxRate) / 100;
        taxable += taxableValue;
        totalTax += tax;
        return {
          variantId: item.variantId,
          invoiceItemId: original.id,
          quantity: String(item.quantity),
          unitRate: String(rate),
          taxableValue: taxableValue.toFixed(2),
          taxRate: original.taxRate,
          cgstAmount: String((tax / (invoice.igstAmount ? 1 : 2)).toFixed(2)),
          sgstAmount: String((tax / (invoice.igstAmount ? 1 : 2)).toFixed(2)),
          igstAmount: String(invoice.igstAmount ? tax.toFixed(2) : '0'),
          vatAmount: '0',
          totalAmount: (taxableValue + tax).toFixed(2),
        };
      });
      const number = dto.returnNumber || await this.nextNumber(tx, user.businessId, user.branchId, 'PRN');
      const returnWarehouseId = dto.warehouseId || invoice.warehouseId || (await tx.warehouse.findFirst({ where: { branchId: user.branchId, isDefault: true } }))?.id;
      if (!returnWarehouseId) throw new BadRequestException('A warehouse is required for the purchase return');
      return tx.purchaseReturn.create({
        data: {
          businessId: user.businessId,
          branchId: user.branchId,
          supplierId: invoice.supplierId,
          purchaseInvoiceId: invoice.id,
          returnNumber: number,
          returnDate: new Date(dto.returnDate || new Date()),
          status: 'DRAFT',
          warehouseId: returnWarehouseId,
          taxableAmount: taxable.toFixed(2),
          totalTax: totalTax.toFixed(2),
          grandTotal: (taxable + totalTax).toFixed(2),
          reason: dto.reason,
          createdById: user.id,
          items: { create: itemRows },
        },
        include: { items: true },
      });
    });
  }

  async postReturn(user: any, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.purchaseReturn.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        include: { items: true },
      });
      if (!document) throw new NotFoundException('Purchase return not found');
      assertPurchaseTransition('RETURN', document.status, 'POSTED');
      for (const item of document.items) {
        const balance = await tx.stockBalance.findUnique({
          where: { warehouseId_variantId: { warehouseId: document.warehouseId, variantId: item.variantId } },
        });
        if (!balance || Number(balance.quantity) < Number(item.quantity)) throw new BadRequestException(`Insufficient stock for purchase return item ${item.variantId}`);
        await tx.stockBalance.update({
          where: { id: balance.id },
          data: { quantity: { decrement: item.quantity } },
        });
        await tx.stockMovement.create({
          data: {
            warehouseId: document.warehouseId,
            variantId: item.variantId,
            type: 'RETURN_OUT_DEBIT_NOTE',
            quantity: item.quantity,
            unitCost: item.unitRate,
            totalCost: String(Number(item.quantity) * Number(item.unitRate)),
            referenceId: document.id,
            referenceDocumentType: 'PURCHASE_RETURN',
            idempotencyKey: `RETURN:${document.id}:${item.id}:POST`,
            notes: document.reason || `Purchase return ${document.returnNumber}`,
          },
        });
      }
      const supplier = await tx.supplier.findUnique({ where: { id: document.supplierId } });
      const ap = await tx.chartOfAccount.findFirst({ where: { businessId: document.businessId, code: '2010' } });
      const purchase = await tx.chartOfAccount.findFirst({ where: { businessId: document.businessId, code: '5020' } });
      if (!ap || !purchase) throw new BadRequestException('Accounts Payable or Purchase account is not configured');
      const journal = await tx.journalEntry.create({
        data: {
          businessId: document.businessId,
          entryNumber: `JRN-${document.returnNumber}`,
          date: document.returnDate,
          narration: `Purchase return ${document.returnNumber} to ${supplier?.name || 'supplier'}`,
          reference: document.returnNumber,
          isPosted: true,
        },
      });
      await tx.journalLine.create({ data: { journalEntryId: journal.id, accountId: ap.id, debit: document.grandTotal, credit: 0, notes: 'Debit supplier' } });
      await tx.journalLine.create({ data: { journalEntryId: journal.id, accountId: purchase.id, debit: 0, credit: document.taxableAmount, notes: 'Credit purchase/inventory' } });
      await tx.purchaseReturn.update({
        where: { id },
        data: { status: 'POSTED', journalEntryId: journal.id, updatedById: user.id, version: { increment: 1 } },
      });
      return document;
    });
  }

  async createPayment(user: any, dto: any) {
    this.requireBranch(user);
    if (!dto.supplierId || !dto.amount || Number(dto.amount) <= 0) throw new BadRequestException('Supplier and positive payment amount are required');
    return this.prisma.$transaction(async (tx) => {
      const number = dto.paymentNumber || await this.nextNumber(tx, user.businessId, user.branchId, 'PAY');
      const paymentType = dto.paymentType === 'ADVANCE' ? 'ADVANCE' : 'BILL_PAYMENT';
      const allocations: Array<{ purchaseInvoiceId: string; amount: string }> = dto.allocations || [];
      let allocated = 0;
      for (const allocation of allocations) {
        const invoice = await tx.purchaseInvoice.findFirst({ where: { id: allocation.purchaseInvoiceId, supplierId: dto.supplierId, isDeleted: false } });
        if (!invoice) throw new BadRequestException('Payment allocation references an invalid supplier invoice');
        const amount = Number(allocation.amount);
        if (amount <= 0 || amount > Number(invoice.balanceAmount)) throw new BadRequestException('Payment allocation exceeds invoice outstanding');
        allocated += amount;
      }
      if (allocated > Number(dto.amount)) throw new BadRequestException('Payment allocations exceed payment amount');
      if (paymentType === 'ADVANCE' && allocations.length) throw new BadRequestException('Advance payments cannot be allocated to invoices');

      const payment = await tx.purchasePayment.create({
        data: {
          businessId: user.businessId,
          branchId: user.branchId,
          supplierId: dto.supplierId,
          paymentNumber: number,
          paymentDate: new Date(dto.paymentDate || new Date()),
          paymentType,
          mode: dto.mode || 'BANK_TRANSFER',
          amount: String(dto.amount),
          allocatedAmount: allocated.toFixed(2),
          unallocatedAmount: (Number(dto.amount) - allocated).toFixed(2),
          status: 'POSTED',
          bankAccountId: dto.bankAccountId || null,
          reference: dto.reference,
          notes: dto.notes,
          idempotencyKey: dto.idempotencyKey,
          createdById: user.id,
          allocations: allocations.length ? {
            create: allocations.map((allocation) => ({
              purchaseInvoiceId: allocation.purchaseInvoiceId,
              amount: String(allocation.amount),
            })),
          } : undefined,
        },
        include: { allocations: true },
      });

      for (const allocation of allocations) {
        const invoice = await tx.purchaseInvoice.findUnique({ where: { id: allocation.purchaseInvoiceId } });
        if (!invoice) throw new BadRequestException('Payment allocation invoice not found');
        const paid = Number(invoice.paidAmount) + Number(allocation.amount);
        const balance = Number(invoice.grandTotal) - paid;
        await tx.purchaseInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: paid.toFixed(2),
            balanceAmount: Math.max(0, balance).toFixed(2),
            status: balance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID',
            version: { increment: 1 },
            updatedById: user.id,
          },
        });
      }

      const supplier = await tx.supplier.findUnique({ where: { id: dto.supplierId } });
      const ap = await tx.chartOfAccount.findFirst({ where: { businessId: user.businessId, code: '2010' } });
      const bank = await tx.chartOfAccount.findFirst({ where: { businessId: user.businessId, code: dto.mode === 'CASH' ? '1010' : '1000' } });
      const advance = await tx.chartOfAccount.findFirst({ where: { businessId: user.businessId, code: '2020' } });
      if (!bank) throw new BadRequestException('Bank/Cash account is not configured');
      const debitAccount = paymentType === 'ADVANCE' ? advance : ap;
      if (!debitAccount) throw new BadRequestException('Supplier advance or Accounts Payable account is not configured');
      const journal = await tx.journalEntry.create({
        data: {
          businessId: user.businessId,
          entryNumber: `JRN-${payment.paymentNumber}`,
          date: payment.paymentDate,
          narration: `${paymentType === 'ADVANCE' ? 'Supplier advance' : 'Supplier payment'} ${payment.paymentNumber} to ${supplier?.name || 'supplier'}`,
          reference: payment.paymentNumber,
          isPosted: true,
        },
      });
      await tx.journalLine.create({ data: { journalEntryId: journal.id, accountId: debitAccount.id, debit: dto.amount, credit: 0, notes: 'Supplier liability/advance' } });
      await tx.journalLine.create({ data: { journalEntryId: journal.id, accountId: bank.id, debit: 0, credit: dto.amount, notes: 'Payment made' } });
      await tx.purchasePayment.update({ where: { id: payment.id }, data: { journalEntryId: journal.id } });
      return payment;
    });
  }

  async cancelGeneric(user: any, document: 'request' | 'order' | 'grn' | 'return', id: string, dto: any = {}) {
    if (!dto.reason) throw new BadRequestException('Cancellation reason is mandatory');
    return this.prisma.$transaction(async (tx) => {
      if (document === 'request') {
        const row = await tx.purchaseRequest.findFirst({ where: { id, businessId: user.businessId } });
        if (!row) throw new NotFoundException('Purchase request not found');
        assertPurchaseTransition('PR', row.status, 'CANCELLED');
        return tx.purchaseRequest.update({ where: { id }, data: { status: 'CANCELLED', notes: dto.reason, updatedById: user.id, version: { increment: 1 } } });
      }
      if (document === 'order') {
        const row = await tx.purchaseOrder.findFirst({ where: { id, businessId: user.businessId } });
        if (!row) throw new NotFoundException('Purchase order not found');
        const grnCount = await tx.grn.count({ where: { purchaseOrderId: id, status: 'POSTED' } });
        if (grnCount) throw new BadRequestException('Cannot cancel a PO with posted GRNs');
        assertPurchaseTransition('PO', row.status, 'CANCELLED');
        return tx.purchaseOrder.update({ where: { id }, data: { status: 'CANCELLED', updatedById: user.id, version: { increment: 1 } } });
      }
      if (document === 'grn') {
        const row = await tx.grn.findFirst({ where: { id, businessId: user.businessId }, include: { items: true } });
        if (!row) throw new NotFoundException('GRN not found');
        const invoiceCount = await tx.purchaseInvoiceGrn.count({ where: { grnId: id } });
        if (invoiceCount) throw new BadRequestException('Cannot cancel a GRN linked to an invoice');
        assertPurchaseTransition('GRN', row.status, 'CANCELLED');
        if (row.status === 'POSTED') {
          for (const item of row.items) {
            await tx.stockBalance.update({
              where: { warehouseId_variantId: { warehouseId: row.warehouseId, variantId: item.variantId } },
              data: { quantity: { decrement: item.quantity } },
            });
          }
        }
        return tx.grn.update({ where: { id }, data: { status: 'CANCELLED', notes: dto.reason, updatedById: user.id, version: { increment: 1 } } });
      }
      const row = await tx.purchaseReturn.findFirst({ where: { id, businessId: user.businessId } });
      if (!row) throw new NotFoundException('Purchase return not found');
      assertPurchaseTransition('RETURN', row.status, 'CANCELLED');
      return tx.purchaseReturn.update({ where: { id }, data: { status: 'CANCELLED', reason: dto.reason, updatedById: user.id, version: { increment: 1 } } });
    });
  }

  async approveDocument(user: any, document: 'request' | 'order' | 'invoice' | 'return', id: string, dto: any = {}) {
    return this.prisma.$transaction(async (tx) => {
      if (document === 'request') {
        const row = await tx.purchaseRequest.findFirst({ where: { id, businessId: user.businessId } });
        if (!row) throw new NotFoundException('Purchase request not found');
        assertPurchaseTransition('PR', row.status, 'APPROVED');
        return tx.purchaseRequest.update({ where: { id }, data: { status: 'APPROVED', updatedById: user.id, version: { increment: 1 } } });
      }
      if (document === 'order') {
        const row = await tx.purchaseOrder.findFirst({ where: { id, businessId: user.businessId } });
        if (!row) throw new NotFoundException('Purchase order not found');
        assertPurchaseTransition('PO', row.status, 'APPROVED');
        return tx.purchaseOrder.update({ where: { id }, data: { status: 'APPROVED', updatedById: user.id, version: { increment: 1 } } });
      }
      if (document === 'invoice') {
        const row = await tx.purchaseInvoice.findFirst({ where: { id, businessId: user.businessId } });
        if (!row) throw new NotFoundException('Purchase invoice not found');
        assertPurchaseTransition('INVOICE', row.status, 'APPROVED');
        return tx.purchaseInvoice.update({ where: { id }, data: { status: 'APPROVED', updatedById: user.id, version: { increment: 1 } } });
      }
      if (document === 'return') {
        const row = await tx.purchaseReturn.findFirst({ where: { id, businessId: user.businessId } });
        if (!row) throw new NotFoundException('Purchase return not found');
        assertPurchaseTransition('RETURN', row.status, 'APPROVED');
        return tx.purchaseReturn.update({ where: { id }, data: { status: 'APPROVED', updatedById: user.id, version: { increment: 1 } } });
      }
    });
  }

  async rejectDocument(user: any, document: 'request' | 'order' | 'invoice' | 'return', id: string, dto: any) {
    if (!dto.reason) throw new BadRequestException('Rejection reason is mandatory');
    return this.prisma.$transaction(async (tx) => {
      if (document === 'request') return tx.purchaseRequest.update({ where: { id }, data: { status: 'REJECTED', notes: dto.reason, updatedById: user.id, version: { increment: 1 } } });
      if (document === 'invoice') return tx.purchaseInvoice.update({ where: { id }, data: { status: 'CANCELLED', cancellationReason: dto.reason, updatedById: user.id, version: { increment: 1 } } });
      throw new BadRequestException(`Approval rejection is not supported for ${document}`);
    });
  }

  async addAttachment(user: any, documentType: string, documentId: string, dto: any) {
    if (!dto.filePath || !dto.mimeType) throw new BadRequestException('File path and MIME type are required');
    if (dto.size > 25 * 1024 * 1024) throw new BadRequestException('Attachment exceeds 25 MB');
    return this.prisma.purchaseAttachment.create({
      data: {
        businessId: user.businessId,
        branchId: user.branchId,
        documentType,
        documentId,
        fileName: dto.fileName,
        filePath: dto.filePath,
        mimeType: dto.mimeType,
        size: dto.size,
        checksum: dto.checksum,
        uploadedById: user.id,
      },
    });
  }

  async listAttachments(user: any, documentType: string, documentId: string) {
    return this.prisma.purchaseAttachment.findMany({
      where: { businessId: user.businessId, branchId: user.branchId, documentType, documentId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteAttachment(user: any, id: string) {
    return this.prisma.purchaseAttachment.updateMany({
      where: { id, businessId: user.businessId, ...(user.branchId ? { branchId: user.branchId } : {}) },
      data: { isDeleted: true },
    });
  }
}
