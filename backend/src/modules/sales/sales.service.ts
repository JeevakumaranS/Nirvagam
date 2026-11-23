import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import {
  PaginationParams,
  StockMovementType,
  InvoiceStatus,
  calculateGstInvoice,
} from '@nirvagam/shared';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, branchId: string | undefined, params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      ...(branchId ? { branchId } : { branch: { businessId } }),
      ...(params.search && {
        OR: [
          { invoiceNumber: { contains: params.search, mode: 'insensitive' } },
          { customer: { name: { contains: params.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, invoices] = await Promise.all([
      this.prisma.salesInvoice.count({ where }),
      this.prisma.salesInvoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          customer: true,
          branch: true,
          items: {
            include: {
              variant: {
                include: { product: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: invoices,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: {
        customer: true,
        branch: { include: { business: true } },
        items: {
          include: {
            variant: {
              include: { product: { include: { unit: true } } },
            },
          },
        },
        journalEntry: {
          include: {
            lines: { include: { account: true } },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Sales invoice not found');
    }

    return invoice;
  }

  async create(businessId: string, branchId: string, dto: CreateInvoiceDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Invoice must contain at least one item');
    }

    const [branch, customer] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: branchId },
        include: { warehouses: { where: { isDefault: true } } },
      }),
      this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      }),
    ]);

    if (!branch || !customer) {
      throw new NotFoundException('Branch or Customer not found');
    }

    const warehouse = branch.warehouses[0];
    if (!warehouse) {
      throw new BadRequestException('No default warehouse assigned to branch for inventory deduction');
    }

    // Determine State Codes for GST
    const businessStateCode = branch.stateCode || '33';
    const customerStateCode = customer.billingStateCode || '33';

    // Calculate GST using shared engine
    const gstCalculation = calculateGstInvoice(
      businessStateCode,
      customerStateCode,
      dto.items.map((i) => ({
        id: i.variantId,
        name: 'Item',
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountAmount: i.discountAmount || 0,
        gstRate: i.gstRate,
      })),
      dto.discountAmount || 0
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch next sequence
      const docType = dto.invoiceType || 'TAX_INVOICE';
      let sequence = await tx.documentSequence.findFirst({
        where: { businessId, branchId, documentType: docType },
      });

      let nextNumber = 1001;
      let prefix = 'INV-26/';
      let padding = 4;

      if (sequence) {
        nextNumber = sequence.nextNumber;
        prefix = sequence.prefix;
        padding = sequence.padding;

        await tx.documentSequence.update({
          where: { id: sequence.id },
          data: { nextNumber: nextNumber + 1 },
        });
      }

      const invoiceNumber = `${prefix}${String(nextNumber).padStart(padding, '0')}`;

      // 2. Accounts Resolution for Double Entry
      const [arAcc, salesAcc, cgstAcc, sgstAcc, igstAcc, roundAcc] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { businessId, code: '1030' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '4010' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '2021' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '2022' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '2023' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '5090' } }),
      ]);

      // 3. Create Journal Entry
      const journal = await tx.journalEntry.create({
        data: {
          businessId,
          entryNumber: `JRN-${invoiceNumber}`,
          date: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
          narration: `Sales Invoice ${invoiceNumber} issued to ${customer.name}`,
          reference: invoiceNumber,
          isPosted: true,
        },
      });

      // Journal Line 1: Accounts Receivable Debit (Grand Total)
      if (arAcc) {
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: arAcc.id,
            debit: gstCalculation.netTotal,
            credit: 0,
            notes: `Receivable from ${customer.name}`,
          },
        });
      }

      // Journal Line 2: Sales Revenue Credit (Taxable Value)
      if (salesAcc) {
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: salesAcc.id,
            debit: 0,
            credit: gstCalculation.totalTaxable,
            notes: 'Operating Sales Revenue',
          },
        });
      }

      // Journal Line 3 & 4: CGST & SGST or IGST Credit
      if (gstCalculation.isInterState && igstAcc && gstCalculation.totalIgst > 0) {
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: igstAcc.id,
            debit: 0,
            credit: gstCalculation.totalIgst,
            notes: 'Output IGST Payable',
          },
        });
      } else {
        if (cgstAcc && gstCalculation.totalCgst > 0) {
          await tx.journalLine.create({
            data: {
              journalEntryId: journal.id,
              accountId: cgstAcc.id,
              debit: 0,
              credit: gstCalculation.totalCgst,
              notes: 'Output CGST Payable',
            },
          });
        }
        if (sgstAcc && gstCalculation.totalSgst > 0) {
          await tx.journalLine.create({
            data: {
              journalEntryId: journal.id,
              accountId: sgstAcc.id,
              debit: 0,
              credit: gstCalculation.totalSgst,
              notes: 'Output SGST Payable',
            },
          });
        }
      }

      // Journal Line 5: Round-off
      if (roundAcc && gstCalculation.roundOffAmount !== 0) {
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: roundAcc.id,
            debit: gstCalculation.roundOffAmount < 0 ? Math.abs(gstCalculation.roundOffAmount) : 0,
            credit: gstCalculation.roundOffAmount > 0 ? gstCalculation.roundOffAmount : 0,
            notes: 'Invoice Round-off Adjustment',
          },
        });
      }

      // 4. Create Sales Invoice Header
      const invoice = await tx.salesInvoice.create({
        data: {
          branchId,
          customerId: customer.id,
          journalEntryId: journal.id,
          invoiceType: (dto.invoiceType as any) || 'TAX_INVOICE',
          invoiceNumber,
          invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: InvoiceStatus.POSTED,
          taxableAmount: gstCalculation.totalTaxable,
          cgstAmount: gstCalculation.totalCgst,
          sgstAmount: gstCalculation.totalSgst,
          igstAmount: gstCalculation.totalIgst,
          totalTax: gstCalculation.totalTax,
          discountAmount: dto.discountAmount || 0,
          roundOff: gstCalculation.roundOffAmount,
          grandTotal: gstCalculation.netTotal,
          paidAmount: 0,
          notes: dto.notes,
          terms: dto.terms,
        },
      });

      // 5. Create Line Items and Update Inventory Stock
      for (const item of gstCalculation.items) {
        await tx.salesInvoiceItem.create({
          data: {
            salesInvoiceId: invoice.id,
            variantId: item.id,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount || 0,
            taxableValue: item.taxableValue,
            gstRate: item.gstRate,
            cgstAmount: item.cgstAmount,
            sgstAmount: item.sgstAmount,
            igstAmount: item.igstAmount,
            totalAmount: item.totalAmount,
          },
        });

        // Deduct Warehouse stock
        const balance = await tx.stockBalance.findUnique({
          where: {
            warehouseId_variantId: {
              warehouseId: warehouse.id,
              variantId: item.id,
            },
          },
        });

        if (balance) {
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: {
              quantity: { decrement: item.quantity },
            },
          });
        }

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            warehouseId: warehouse.id,
            variantId: item.id,
            type: StockMovementType.OUT_SALE,
            quantity: item.quantity,
            unitCost: item.unitPrice,
            totalCost: item.totalAmount,
            referenceId: invoice.id,
            notes: `Dispatched against ${invoiceNumber}`,
          },
        });
      }

      return invoice;
    });
  }

  async cancelInvoice(id: string) {
    const invoice = await this.prisma.salesInvoice.findUnique({
      where: { id },
      include: { items: true, branch: { include: { warehouses: true } } },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Invoice is already cancelled');
    }

    const warehouse = invoice.branch.warehouses.find((w) => w.isDefault) || invoice.branch.warehouses[0];

    return this.prisma.$transaction(async (tx) => {
      // 1. Mark as cancelled
      const updated = await tx.salesInvoice.update({
        where: { id },
        data: { status: InvoiceStatus.CANCELLED },
      });

      // 2. Restore inventory
      if (warehouse) {
        for (const item of invoice.items) {
          await tx.stockBalance.updateMany({
            where: { warehouseId: warehouse.id, variantId: item.variantId },
            data: { quantity: { increment: item.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              warehouseId: warehouse.id,
              variantId: item.variantId,
              type: StockMovementType.RETURN_IN_CREDIT_NOTE,
              quantity: item.quantity,
              unitCost: item.unitPrice,
              totalCost: item.totalAmount,
              referenceId: invoice.id,
              notes: `Cancelled invoice ${invoice.invoiceNumber} stock return`,
            },
          });
        }
      }

      return updated;
    });
  }
}
