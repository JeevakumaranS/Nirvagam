import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { calculatePurchaseDocument, PaginationParams, PurchaseCalculationLine } from '@nirvagam/shared';
import { PrismaService } from '../../../prisma/prisma.service';
import { assertPurchaseTransition } from '../purchase-status';
import { PurchaseCoreService, JournalLineInput } from './purchase-core.service';
import { PURCHASE_INVOICE_BILL_MIME_TYPES } from './purchase-attachments.service';
import {
  CreateInvoicePaymentDto,
  CreatePurchaseInvoiceDto,
  UpdatePurchaseInvoiceDto,
} from '../dto/purchase.dto';

const purchaseInvoiceScalars = {
  id: true,
  businessId: true,
  branchId: true,
  supplierId: true,
  purchaseOrderId: true,
  journalEntryId: true,
  invoiceNumber: true,
  supplierBillNumber: true,
  invoiceDate: true,
  dueDate: true,
  mode: true,
  currencyCode: true,
  status: true,
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
  paidAmount: true,
  balanceAmount: true,
  calculationRule: true,
  taxSummary: true,
  idempotencyKey: true,
  postedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  notes: true,
  terms: true,
  createdById: true,
  updatedById: true,
  version: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const;

const purchaseInvoiceItemScalars = {
  id: true,
  purchaseInvoiceId: true,
  variantId: true,
  itemName: true,
  unit: true,
  grnItemId: true,
  purchaseOrderItemId: true,
  description: true,
  unitRate: true,
  quantity: true,
  taxableValue: true,
  taxRate: true,
  cgstAmount: true,
  sgstAmount: true,
  igstAmount: true,
  vatAmount: true,
  landedCost: true,
  totalAmount: true,
} as const;

const purchaseInvoiceItemsWithVariants = {
  select: {
    ...purchaseInvoiceItemScalars,
    variant: { include: { product: true } },
  },
} as const;

@Injectable()
export class PurchaseBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly core: PurchaseCoreService,
  ) {}

  /* -------------------------------------------------------------------------- */
  /*                             PURCHASE INVOICES                              */
  /* -------------------------------------------------------------------------- */

  async listInvoices(user: any, params: PaginationParams & Record<string, any>) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const where: any = {
      businessId: user.businessId,
      isDeleted: false,
      ...(user.branchId ? { branchId: user.branchId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.supplierId ? { supplierId: params.supplierId } : {}),
      ...(params.mode ? { mode: params.mode } : {}),
      ...(params.search
        ? {
            OR: [
              { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
              { supplierBillNumber: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, data] = await Promise.all([
      this.prisma.purchaseInvoice.count({ where }),
      this.prisma.purchaseInvoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        select: {
          ...purchaseInvoiceScalars,
          supplier: true,
          branch: true,
          purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
          charges: true,
          grnLinks: {
            include: {
              grn: {
                select: {
                  id: true,
                  grnNumber: true,
                  grnDate: true,
                  status: true,
                  totalAmount: true,
                  grandTotal: true,
                },
              },
            },
          },
          items: purchaseInvoiceItemsWithVariants,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit), hasNextPage: page * limit < total, hasPrevPage: page > 1 },
    };
  }

  async getInvoice(user: any, id: string) {
    const row = await this.prisma.purchaseInvoice.findFirst({
      where: { id, businessId: user.businessId, isDeleted: false, ...(user.branchId ? { branchId: user.branchId } : {}) },
      select: {
        ...purchaseInvoiceScalars,
        supplier: true,
        branch: true,
        purchaseOrder: { select: { id: true, orderNumber: true, status: true } },
        charges: true,
        grnLinks: {
          include: {
            grn: {
              select: {
                id: true,
                grnNumber: true,
                grnDate: true,
                status: true,
                totalAmount: true,
                grandTotal: true,
              },
            },
          },
        },
        paymentAllocations: { include: { purchasePayment: true } },
        items: purchaseInvoiceItemsWithVariants,
      },
    });
    if (!row) throw new NotFoundException('Purchase invoice not found');
    return row;
  }

  async createInvoice(user: any, dto: CreatePurchaseInvoiceDto) {
    const branchId = this.core.requireBranch(user);
    if (dto.idempotencyKey) {
      const existing = await this.prisma.purchaseInvoice.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { items: true, charges: true, grnLinks: true, supplier: true },
      });
      if (existing) return existing;
    }

    return this.prisma.$transaction(async (tx) => {
      const duplicate = await tx.purchaseInvoice.findFirst({
        where: {
          branchId,
          supplierId: dto.supplierId,
          supplierBillNumber: dto.supplierBillNumber,
          isDeleted: false,
          status: { not: 'CANCELLED' },
        },
      });
      if (duplicate) throw new ConflictException(`Duplicate supplier invoice number "${dto.supplierBillNumber}"`);

      const [supplier, branch, settings] = await Promise.all([
        tx.supplier.findUnique({ where: { id: dto.supplierId } }),
        tx.branch.findUnique({ where: { id: branchId } }),
        this.core.getSettings(user.businessId, tx),
      ]);
      if (!supplier) throw new NotFoundException('Supplier not found');
      if (!branch) throw new NotFoundException('Branch not found');

      const invoiceDate = new Date(dto.invoiceDate || new Date());
      if (dto.purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({ where: { id: dto.purchaseOrderId } });
        if (!po) throw new NotFoundException('Linked Purchase Order not found');
        if (invoiceDate < po.orderDate) {
          throw new BadRequestException('Invoice date cannot be earlier than Purchase Order date');
        }
      }

      const mode = dto.mode === 'DIRECT' ? 'DIRECT' : 'AGAINST_PO_GRN';

      if (mode === 'AGAINST_PO_GRN') {
        if (!dto.grnIds?.length && !dto.purchaseOrderId) {
          throw new BadRequestException('Against-PO/GRN invoice requires at least one GRN or Purchase Order');
        }
        for (const item of dto.items) {
          if (item.grnItemId) {
            const grnItem = await tx.grnItem.findUnique({ where: { id: item.grnItemId } });
            if (!grnItem) throw new BadRequestException('Linked GRN item not found');
            const remainingToInvoice = Number(grnItem.quantity) - Number(grnItem.invoicedQuantity);
            if (Number(item.quantity) > remainingToInvoice + 0.0001) {
              throw new BadRequestException(
                `Cannot invoice more than received quantity (available: ${remainingToInvoice}, requested: ${item.quantity})`,
              );
            }
          }
        }
      }

      const lines: PurchaseCalculationLine[] = dto.items.map((item, idx) => ({
        id: item.variantId || item.itemName || `line-${idx}`,
        quantity: String(item.quantity),
        rate: String(item.unitRate),
        weight: item.weight ? String(item.weight) : undefined,
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

      const invoiceNumber = dto.invoiceNumber || (await this.core.nextNumber(tx, user.businessId, branchId, 'PI'));
      const dueDate = dto.dueDate
        ? new Date(dto.dueDate)
        : new Date(invoiceDate.getTime() + Number(supplier.creditPeriodDays || 30) * 86400000);

      const invoice = await tx.purchaseInvoice.create({
        data: {
          businessId: user.businessId,
          branchId,
          supplierId: supplier.id,
          purchaseOrderId: dto.purchaseOrderId || null,
          invoiceNumber,
          supplierBillNumber: dto.supplierBillNumber,
          invoiceDate,
          dueDate,
          mode,
          currencyCode: dto.currencyCode || 'INR',
          status: 'DRAFT',
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
          paidAmount: 0,
          balanceAmount: calc.grandTotal,
          calculationRule: calc.rule as any,
          taxSummary: calc.taxSummary as any,
          idempotencyKey: dto.idempotencyKey || null,
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
                grnItemId: item.grnItemId || null,
                purchaseOrderItemId: item.purchaseOrderItemId || null,
                description: item.description || null,
                quantity: String(item.quantity),
                unitRate: String(item.unitRate),
                taxableValue: c.taxableValue,
                taxRate: String(item.taxRate || 0),
                cgstAmount: c.cgstAmount,
                sgstAmount: c.sgstAmount,
                igstAmount: c.igstAmount,
                vatAmount: c.vatAmount,
                landedCost: c.landedCost,
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
          grnLinks: dto.grnIds?.length
            ? { create: dto.grnIds.map((grnId) => ({ grnId })) }
            : undefined,
        },
        include: { items: true, charges: true, grnLinks: true, supplier: true },
      });

      if (dto.post === true) {
        return this.postInvoiceInTx(tx, user, invoice.id);
      }
      return invoice;
    });
  }

  async updateInvoice(user: any, id: string, dto: UpdatePurchaseInvoiceDto) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.purchaseInvoice.findFirst({ where: { id, businessId: user.businessId, isDeleted: false } });
      if (!existing) throw new NotFoundException('Purchase invoice not found');
      if (existing.status !== 'DRAFT') throw new BadRequestException('Only DRAFT purchase invoices can be edited');
      this.core.assertVersion(dto.version, existing.version, 'Purchase invoice');

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

      await tx.purchaseInvoiceItem.deleteMany({ where: { purchaseInvoiceId: id } });
      await tx.purchaseInvoiceCharge.deleteMany({ where: { purchaseInvoiceId: id } });

      return tx.purchaseInvoice.update({
        where: { id },
        data: {
          supplierId: supplier.id,
          supplierBillNumber: dto.supplierBillNumber,
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : existing.invoiceDate,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
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
          balanceAmount: calc.grandTotal,
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
                unit: item.unit || 'PCS',
                grnItemId: item.grnItemId || null,
                purchaseOrderItemId: item.purchaseOrderItemId || null,
                description: item.description || null,
                quantity: String(item.quantity),
                unitRate: String(item.unitRate),
                taxableValue: c.taxableValue,
                taxRate: String(item.taxRate || 0),
                cgstAmount: c.cgstAmount,
                sgstAmount: c.sgstAmount,
                igstAmount: c.igstAmount,
                vatAmount: c.vatAmount,
                landedCost: c.landedCost,
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
        include: { items: true, charges: true, supplier: true },
      });
    });
  }

  async postInvoice(user: any, id: string) {
    return this.prisma.$transaction((tx) => this.postInvoiceInTx(tx, user, id));
  }

  async recordInvoicePayment(user: any, invoiceId: string, dto: CreateInvoicePaymentDto) {
    const branchId = this.core.requireBranch(user);
    const rawAmount = Number(dto.amount);
    const amount = Number(rawAmount.toFixed(2));
    if (!Number.isFinite(rawAmount) || rawAmount <= 0 || Math.abs(rawAmount - amount) > 0.000001) {
      throw new BadRequestException('Payment amount must be positive and have no more than two decimal places');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.idempotencyKey) {
        const existing = await tx.purchasePayment.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
          include: { allocations: true },
        });
        if (existing) return existing;
      }

      const invoice = await tx.purchaseInvoice.findFirst({
        where: {
          id: invoiceId,
          businessId: user.businessId,
          branchId,
          isDeleted: false,
        },
      });
      if (!invoice) throw new NotFoundException('Purchase invoice not found');
      if (!['APPROVED', 'PARTIALLY_PAID'].includes(invoice.status)) {
        throw new BadRequestException('Only posted, unpaid invoices can be paid');
      }

      const attachments = await tx.purchaseAttachment.count({
        where: {
          businessId: user.businessId,
          branchId,
          documentType: 'INVOICE',
          documentId: invoiceId,
          isDeleted: false,
          mimeType: { in: PURCHASE_INVOICE_BILL_MIME_TYPES },
        },
      });
      if (!attachments) {
        throw new BadRequestException('Upload the supplier bill as a PDF or image before recording payment');
      }

      const balance = Number(invoice.balanceAmount);
      if (!Number.isFinite(balance) || balance <= 0.01) {
        throw new BadRequestException('This invoice has no outstanding balance');
      }
      if (amount > balance) {
        throw new BadRequestException(`Payment amount exceeds the invoice balance (${balance.toFixed(2)})`);
      }

      const settings = await this.core.getSettings(user.businessId, tx);
      const accounts = await this.core.resolveAccounts(tx, user.businessId, settings);
      const cashAccount = dto.mode === 'CASH' ? accounts.cash : accounts.bank;
      if (!accounts.ap || !cashAccount) {
        throw new BadRequestException('Accounts Payable and Bank/Cash accounts must be configured');
      }

      const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
      const paymentNumber = await this.core.nextNumber(tx, user.businessId, branchId, 'PAY');
      const supplier = await tx.supplier.findUnique({ where: { id: invoice.supplierId } });
      const journal = await this.core.createBalancedJournal(tx, {
        businessId: user.businessId,
        entryNumber: `JRN-${paymentNumber}`,
        date: paymentDate,
        narration: `Supplier invoice payment ${paymentNumber} to ${supplier?.name || 'Supplier'}`,
        reference: paymentNumber,
        lines: [
          { accountId: accounts.ap.id, debit: amount, credit: 0, notes: `Payment for ${invoice.invoiceNumber}` },
          { accountId: cashAccount.id, debit: 0, credit: amount, notes: 'Payment outflow' },
        ],
      });

      const paidAmount = Number(invoice.paidAmount) + amount;
      const balanceAmount = Math.max(0, Number((balance - amount).toFixed(2)));
      const invoiceUpdate = await tx.purchaseInvoice.updateMany({
        where: {
          id: invoice.id,
          businessId: user.businessId,
          branchId,
          isDeleted: false,
          version: invoice.version,
          balanceAmount: invoice.balanceAmount,
        },
        data: {
          paidAmount: paidAmount.toFixed(2),
          balanceAmount: balanceAmount.toFixed(2),
          status: balanceAmount <= 0.01 ? 'PAID' : 'PARTIALLY_PAID',
          updatedById: user.id,
          version: { increment: 1 },
        },
      });
      if (invoiceUpdate.count !== 1) {
        throw new ConflictException('Invoice balance changed; refresh the invoice before recording payment');
      }

      const payment = await tx.purchasePayment.create({
        data: {
          businessId: user.businessId,
          branchId,
          supplierId: invoice.supplierId,
          paymentNumber,
          paymentDate,
          paymentType: 'BILL_PAYMENT',
          mode: dto.mode || 'BANK_TRANSFER',
          amount: amount.toFixed(2),
          allocatedAmount: amount.toFixed(2),
          unallocatedAmount: '0.00',
          status: 'POSTED',
          bankAccountId: cashAccount.id,
          journalEntryId: journal.id,
          reference: dto.reference || null,
          notes: dto.notes || null,
          idempotencyKey: dto.idempotencyKey || null,
          createdById: user.id,
          allocations: {
            create: [{ purchaseInvoiceId: invoice.id, amount: amount.toFixed(2) }],
          },
        },
        include: { allocations: true, supplier: true },
      });

      return payment;
    });
  }

  private async postInvoiceInTx(tx: any, user: any, id: string) {
    const invoice = await tx.purchaseInvoice.findFirst({
      where: { id, businessId: user.businessId, isDeleted: false },
      include: { items: true, charges: true, grnLinks: { include: { grn: true } }, supplier: true },
    });
    if (!invoice) throw new NotFoundException('Purchase invoice not found');
    if (invoice.postedAt && invoice.journalEntryId) {
      return invoice; // Idempotent guard
    }
    assertPurchaseTransition('INVOICE', invoice.status, 'APPROVED');

    const settings = await this.core.getSettings(user.businessId, tx);
    const accounts = await this.core.resolveAccounts(tx, user.businessId, settings);
    if (!accounts.ap || !accounts.inventory) {
      throw new BadRequestException('Accounts Payable and Inventory/Purchase accounts must be configured');
    }

    const journalLines: JournalLineInput[] = [];
    const baseNet = Number(invoice.taxableAmount) + Number(invoice.additionalCharges) + Number(invoice.roundOff);

    if (invoice.mode === 'AGAINST_PO_GRN') {
      let grnAccrualCleared = 0;

      for (const item of invoice.items) {
        if (item.grnItemId) {
          const grnItem = await tx.grnItem.findUnique({ where: { id: item.grnItemId } });
          if (!grnItem) throw new BadRequestException('Linked GRN item not found');
          const available = Number(grnItem.quantity) - Number(grnItem.invoicedQuantity);
          if (Number(item.quantity) > available + 0.0001) {
            throw new BadRequestException(`Invoice quantity exceeds remaining GRN quantity`);
          }
          await tx.grnItem.update({
            where: { id: grnItem.id },
            data: { invoicedQuantity: (Number(grnItem.invoicedQuantity) + Number(item.quantity)).toFixed(3) },
          });
          grnAccrualCleared += Number(item.quantity) * Number(grnItem.landedCost || grnItem.unitCost || 0);
        }
        if (item.purchaseOrderItemId) {
          const poItem = await tx.purchaseOrderItem.findUnique({ where: { id: item.purchaseOrderItemId } });
          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: { invoicedQuantity: (Number(poItem.invoicedQuantity) + Number(item.quantity)).toFixed(3) },
            });
          }
        }
      }

      if (settings.enableGrnAccrual && grnAccrualCleared > 0 && accounts.grnClearing) {
        journalLines.push({
          accountId: accounts.grnClearing.id,
          debit: grnAccrualCleared,
          credit: 0,
          notes: `Clear GRN Accrual (${invoice.invoiceNumber})`,
        });
        const variance = baseNet - grnAccrualCleared;
        if (Math.abs(variance) > 0.004) {
          const ppvAccount = accounts.priceVariance || accounts.purchase;
          journalLines.push({
            accountId: ppvAccount.id,
            debit: variance > 0 ? variance : 0,
            credit: variance < 0 ? Math.abs(variance) : 0,
            notes: `Purchase Price Variance (${invoice.invoiceNumber})`,
          });
        }
      } else {
        journalLines.push({
          accountId: accounts.inventory.id,
          debit: baseNet,
          credit: 0,
          notes: `Purchase inventory & charges (${invoice.invoiceNumber})`,
        });
      }
    } else {
      // DIRECT mode: stock increases here and posts directly to Inventory/Purchase
      journalLines.push({
        accountId: accounts.inventory.id,
        debit: baseNet,
        credit: 0,
        notes: `Direct purchase inventory & charges (${invoice.invoiceNumber})`,
      });

      for (const item of invoice.items) {
        if (item.variantId) {
          await this.core.applyStockIn(tx, {
            branchId: invoice.branchId,
            variantId: item.variantId,
            quantity: Number(item.quantity),
            landedUnitCost: Number(item.landedCost),
            costingMethod: settings.costingMethod,
            referenceId: invoice.id,
            referenceDocumentType: 'PURCHASE_INVOICE',
            idempotencyKey: `INVOICE:${invoice.id}:${item.id}:POST`,
            performedById: user.id,
            notes: `Direct purchase invoice ${invoice.invoiceNumber}`,
          });
        }
      }
    }

    if (Number(invoice.cgstAmount) > 0 && accounts.cgst) {
      journalLines.push({ accountId: accounts.cgst.id, debit: Number(invoice.cgstAmount), credit: 0, notes: 'Input CGST' });
    }
    if (Number(invoice.sgstAmount) > 0 && accounts.sgst) {
      journalLines.push({ accountId: accounts.sgst.id, debit: Number(invoice.sgstAmount), credit: 0, notes: 'Input SGST' });
    }
    if (Number(invoice.igstAmount) > 0 && accounts.igst) {
      journalLines.push({ accountId: accounts.igst.id, debit: Number(invoice.igstAmount), credit: 0, notes: 'Input IGST' });
    }
    if (Number(invoice.vatAmount) > 0 && accounts.vat) {
      journalLines.push({ accountId: accounts.vat.id, debit: Number(invoice.vatAmount), credit: 0, notes: 'Input VAT' });
    }

    journalLines.push({
      accountId: accounts.ap.id,
      debit: 0,
      credit: Number(invoice.grandTotal),
      notes: `Payable to ${invoice.supplier?.name || 'Supplier'}`,
    });

    const journal = await this.core.createBalancedJournal(tx, {
      businessId: invoice.businessId,
      entryNumber: `JRN-${invoice.invoiceNumber}`,
      date: invoice.invoiceDate,
      narration: `Purchase invoice ${invoice.invoiceNumber} (${invoice.supplierBillNumber}) from ${invoice.supplier?.name || 'Supplier'}`,
      reference: invoice.invoiceNumber,
      lines: journalLines,
    });

    return tx.purchaseInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'APPROVED',
        journalEntryId: journal.id,
        postedAt: new Date(),
        balanceAmount: invoice.grandTotal,
        updatedById: user.id,
        version: { increment: 1 },
      },
      include: { items: true, charges: true, supplier: true, grnLinks: true },
    });
  }

  async cancelInvoice(user: any, id: string, reason: string) {
    if (!reason?.trim()) throw new BadRequestException('Cancellation reason is mandatory');
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.purchaseInvoice.findFirst({
        where: { id, businessId: user.businessId, isDeleted: false },
        include: { items: true, paymentAllocations: true },
      });
      if (!invoice) throw new NotFoundException('Purchase invoice not found');
      if ((invoice.paymentAllocations?.length || 0) > 0) {
        throw new BadRequestException('Cannot cancel an invoice with payment allocations');
      }
      const returnsCount = await tx.purchaseReturn.count({
        where: { purchaseInvoiceId: id, status: { not: 'CANCELLED' }, isDeleted: false },
      });
      if (returnsCount > 0) {
        throw new BadRequestException('Cannot cancel an invoice that has active Purchase Returns');
      }

      assertPurchaseTransition('INVOICE', invoice.status, 'CANCELLED');

      if (invoice.postedAt) {
        const settings = await this.core.getSettings(user.businessId, tx);
        if (invoice.mode === 'DIRECT') {
          for (const item of invoice.items) {
            if (item.variantId) {
              await this.core.applyStockOut(tx, {
                branchId: invoice.branchId,
                variantId: item.variantId,
                quantity: Number(item.quantity),
                unitCost: Number(item.landedCost),
                costingMethod: settings.costingMethod,
                blockOnInsufficient: settings.blockReturnOnInsufficientStock,
                movementType: 'ADJUSTMENT_SUB',
                referenceId: invoice.id,
                referenceDocumentType: 'PURCHASE_INVOICE_CANCEL',
                idempotencyKey: `INVOICE:${invoice.id}:${item.id}:CANCEL`,
                performedById: user.id,
                notes: reason,
              });
            }
          }
        } else if (invoice.mode === 'AGAINST_PO_GRN') {
          for (const item of invoice.items) {
            if (item.grnItemId) {
              const gi = await tx.grnItem.findUnique({ where: { id: item.grnItemId } });
              if (gi) {
                await tx.grnItem.update({
                  where: { id: gi.id },
                  data: { invoicedQuantity: Math.max(0, Number(gi.invoicedQuantity) - Number(item.quantity)).toFixed(3) },
                });
              }
            }
            if (item.purchaseOrderItemId) {
              const poi = await tx.purchaseOrderItem.findUnique({ where: { id: item.purchaseOrderItemId } });
              if (poi) {
                await tx.purchaseOrderItem.update({
                  where: { id: poi.id },
                  data: { invoicedQuantity: Math.max(0, Number(poi.invoicedQuantity) - Number(item.quantity)).toFixed(3) },
                });
              }
            }
          }
        }

        if (invoice.journalEntryId) {
          await this.core.reverseJournal(tx, user.businessId, invoice.journalEntryId, `REV-${invoice.invoiceNumber}`, reason);
        }
      }

      return tx.purchaseInvoice.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancellationReason: reason,
          updatedById: user.id,
          version: { increment: 1 },
        },
      });
    });
  }

  /* -------------------------------------------------------------------------- */
}
