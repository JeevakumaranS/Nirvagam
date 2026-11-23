import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PaginationParams, StockMovementType, InvoiceStatus } from '@nirvagam/shared';

@Injectable()
export class PurchasesService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, branchId: string | undefined, params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 50));
    const skip = (page - 1) * limit;

    const where: any = {
      ...(branchId ? { branchId } : { branch: { businessId } }),
      ...(params.search && {
        OR: [
          { billNumber: { contains: params.search, mode: 'insensitive' } },
          { supplier: { name: { contains: params.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, purchases] = await Promise.all([
      this.prisma.purchaseInvoice.count({ where }),
      this.prisma.purchaseInvoice.findMany({
        where,
        skip,
        take: limit,
        include: {
          supplier: true,
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
      data: purchases,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPrevPage: page > 1 },
    };
  }

  async create(businessId: string, branchId: string, dto: CreatePurchaseDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Purchase bill must contain at least one line item');
    }

    const [branch, supplier] = await Promise.all([
      this.prisma.branch.findUnique({
        where: { id: branchId },
        include: { warehouses: { where: { isDefault: true } } },
      }),
      this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      }),
    ]);

    if (!branch || !supplier) {
      throw new NotFoundException('Branch or Supplier not found');
    }

    const warehouse = branch.warehouses[0];
    if (!warehouse) {
      throw new BadRequestException('Default warehouse required for stock intake');
    }

    const isInterState = branch.stateCode !== supplier.stateCode;

    // Calculate totals
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const lineCalculations = dto.items.map((item) => {
      const taxable = item.quantity * item.unitPrice;
      const totalTax = (taxable * item.gstRate) / 100;

      let itemCgst = 0;
      let itemSgst = 0;
      let itemIgst = 0;

      if (isInterState) {
        itemIgst = totalTax;
      } else {
        itemCgst = Math.round((totalTax / 2) * 100) / 100;
        itemSgst = totalTax - itemCgst;
      }

      taxableAmount += taxable;
      cgstAmount += itemCgst;
      sgstAmount += itemSgst;
      igstAmount += itemIgst;

      return {
        ...item,
        taxableValue: taxable,
        cgstAmount: itemCgst,
        sgstAmount: itemSgst,
        igstAmount: itemIgst,
        totalAmount: taxable + totalTax,
      };
    });

    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const grandTotal = Math.round((taxableAmount + totalTax) * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      // 1. Accounts for double-entry
      const [apAcc, purAcc, inCgstAcc, inSgstAcc, inIgstAcc] = await Promise.all([
        tx.chartOfAccount.findFirst({ where: { businessId, code: '2010' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '5020' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '1051' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '1052' } }),
        tx.chartOfAccount.findFirst({ where: { businessId, code: '1053' } }),
      ]);

      // 2. Journal Entry
      const journal = await tx.journalEntry.create({
        data: {
          businessId,
          entryNumber: `JRN-PUR-${dto.billNumber}`,
          date: dto.billDate ? new Date(dto.billDate) : new Date(),
          narration: `Purchase from ${supplier.name} against Bill #${dto.billNumber}`,
          reference: dto.billNumber,
          isPosted: true,
        },
      });

      // Debit Purchases
      if (purAcc) {
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: purAcc.id,
            debit: taxableAmount,
            credit: 0,
            notes: 'Merchandise Purchases',
          },
        });
      }

      // Debit Input Taxes
      if (isInterState && inIgstAcc && igstAmount > 0) {
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: inIgstAcc.id,
            debit: igstAmount,
            credit: 0,
            notes: 'Input IGST Claimable',
          },
        });
      } else {
        if (inCgstAcc && cgstAmount > 0) {
          await tx.journalLine.create({
            data: {
              journalEntryId: journal.id,
              accountId: inCgstAcc.id,
              debit: cgstAmount,
              credit: 0,
              notes: 'Input CGST Claimable',
            },
          });
        }
        if (inSgstAcc && sgstAmount > 0) {
          await tx.journalLine.create({
            data: {
              journalEntryId: journal.id,
              accountId: inSgstAcc.id,
              debit: sgstAmount,
              credit: 0,
              notes: 'Input SGST Claimable',
            },
          });
        }
      }

      // Credit Accounts Payable (Supplier)
      if (apAcc) {
        await tx.journalLine.create({
          data: {
            journalEntryId: journal.id,
            accountId: apAcc.id,
            debit: 0,
            credit: grandTotal,
            notes: `Payable to ${supplier.name}`,
          },
        });
      }

      // 3. Purchase Invoice
      const bill = await tx.purchaseInvoice.create({
        data: {
          branchId,
          supplierId: supplier.id,
          journalEntryId: journal.id,
          billNumber: dto.billNumber,
          billDate: dto.billDate ? new Date(dto.billDate) : new Date(),
          dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: InvoiceStatus.POSTED,
          taxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          totalTax,
          grandTotal,
          paidAmount: 0,
        },
      });

      // 4. Line items & Increment Inventory
      for (const line of lineCalculations) {
        await tx.purchaseInvoiceItem.create({
          data: {
            purchaseInvoiceId: bill.id,
            variantId: line.variantId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxableValue: line.taxableValue,
            gstRate: line.gstRate,
            cgstAmount: line.cgstAmount,
            sgstAmount: line.sgstAmount,
            igstAmount: line.igstAmount,
            totalAmount: line.totalAmount,
          },
        });

        // Increment stock balance
        const balance = await tx.stockBalance.findUnique({
          where: {
            warehouseId_variantId: {
              warehouseId: warehouse.id,
              variantId: line.variantId,
            },
          },
        });

        if (balance) {
          await tx.stockBalance.update({
            where: { id: balance.id },
            data: { quantity: { increment: line.quantity } },
          });
        } else {
          await tx.stockBalance.create({
            data: {
              warehouseId: warehouse.id,
              variantId: line.variantId,
              quantity: line.quantity,
              averageCost: line.unitPrice,
            },
          });
        }

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            warehouseId: warehouse.id,
            variantId: line.variantId,
            type: StockMovementType.IN_PURCHASE,
            quantity: line.quantity,
            unitCost: line.unitPrice,
            totalCost: line.totalAmount,
            referenceId: bill.id,
            notes: `Received against vendor bill ${dto.billNumber}`,
          },
        });
      }

      return bill;
    });
  }
}
