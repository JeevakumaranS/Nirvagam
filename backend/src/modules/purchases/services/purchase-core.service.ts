import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

export interface JournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  notes?: string;
}

@Injectable()
export class PurchaseCoreService {
  constructor(private readonly prisma: PrismaService) {}

  requireBranch(user: any): string {
    if (!user?.branchId) {
      throw new BadRequestException('A branch context is required for purchase transactions');
    }
    return user.branchId;
  }

  async getAdditionalCharges(businessId: string, activeOnly = false) {
    const count = await this.prisma.purchaseAdditionalCharge.count({ where: { businessId } });
    if (count === 0) {
      await this.prisma.purchaseAdditionalCharge.createMany({
        data: [
          { businessId, name: 'Transportation Charges', isActive: true, isSystem: true },
          { businessId, name: 'Delivery Charges', isActive: true, isSystem: true },
          { businessId, name: 'Loading', isActive: true, isSystem: true },
          { businessId, name: 'Unloading', isActive: true, isSystem: true },
        ],
      });
    }
    return this.prisma.purchaseAdditionalCharge.findMany({
      where: { businessId, ...(activeOnly ? { isActive: true } : {}) },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  async createAdditionalCharge(businessId: string, dto: { name: string }) {
    if (!dto.name?.trim()) throw new BadRequestException('Charge name is required');
    return this.prisma.purchaseAdditionalCharge.create({
      data: {
        businessId,
        name: dto.name.trim(),
        isActive: true,
        isSystem: false,
      },
    });
  }

  async toggleAdditionalCharge(businessId: string, id: string, isActive: boolean) {
    const existing = await this.prisma.purchaseAdditionalCharge.findFirst({ where: { id, businessId } });
    if (!existing) throw new BadRequestException('Additional charge not found');
    return this.prisma.purchaseAdditionalCharge.update({ where: { id }, data: { isActive } });
  }

  async deleteAdditionalCharge(businessId: string, id: string) {
    const existing = await this.prisma.purchaseAdditionalCharge.findFirst({ where: { id, businessId } });
    if (!existing) throw new BadRequestException('Additional charge not found');
    await this.prisma.purchaseAdditionalCharge.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Generates the next branch-wise document number with automatic year reset.
   */
  async nextNumber(
    tx: any,
    businessId: string,
    branchId: string,
    documentType: 'PR' | 'PO' | 'GRN' | 'PI' | 'PRN' | 'PAY',
  ): Promise<string> {
    const currentYear = new Date().getUTCFullYear();
    const series = await tx.documentNumberSeries.findFirst({
      where: { businessId, branchId, documentType, isActive: true },
    });

    if (!series) {
      const created = await tx.documentNumberSeries.create({
        data: {
          businessId,
          branchId,
          documentType,
          prefix: `${documentType}-`,
          currentNumber: 2,
          padding: 4,
          resetPeriod: 'YEAR',
          resetYear: currentYear,
          isActive: true,
        },
      });
      return `${created.prefix}${String(1).padStart(created.padding, '0')}`;
    }

    let nextSeq = series.currentNumber;
    if (series.resetPeriod === 'YEAR' && series.resetYear && series.resetYear !== currentYear) {
      nextSeq = 1;
    }

    await tx.documentNumberSeries.update({
      where: { id: series.id },
      data: { currentNumber: nextSeq + 1, resetYear: currentYear },
    });

    return `${series.prefix}${String(nextSeq).padStart(series.padding, '0')}${series.suffix || ''}`;
  }

  /**
   * Returns (or lazily initializes) PurchaseSettings for the business.
   */
  async getSettings(businessId: string, tx: any = this.prisma) {
    let settings = await tx.purchaseSettings.findUnique({ where: { businessId } });
    if (!settings) {
      settings = await tx.purchaseSettings.create({
        data: {
          businessId,
          taxRegime: 'GST',
          costingMethod: 'WAC',
          enableGrnAccrual: true,
          blockReturnOnInsufficientStock: true,
          defaultOverReceiptTolerance: 5,
        },
      });
    }
    return settings;
  }

  /**
   * Resolves default/configured COA accounts for a business.
   */
  async resolveAccounts(tx: any, businessId: string, settings: any) {
    const accounts = await tx.chartOfAccount.findMany({
      where: { businessId, isActive: true },
    });
    const byId = new Map<string, any>(accounts.map((a: any) => [a.id, a]));
    const byCode = new Map<string, any>(accounts.map((a: any) => [a.code, a]));

    const pick = (configuredId: string | null | undefined, fallbackCode: string) =>
      (configuredId && byId.get(configuredId)) || byCode.get(fallbackCode) || null;

    return {
      ap: pick(settings.accountsPayableAccountId, '2010'),
      purchase: pick(settings.purchaseAccountId, '5020'),
      inventory: pick(settings.inventoryAccountId, '1020') || pick(settings.purchaseAccountId, '5020'),
      grnClearing: pick(settings.grnClearingAccountId, '2015'),
      priceVariance: pick(settings.priceVarianceAccountId, '5025') || pick(settings.purchaseAccountId, '5020'),
      discountReceived: pick(settings.discountReceivedAccountId, '5030'),
      freight: pick(settings.freightAccountId, '5040') || pick(settings.inventoryAccountId, '1020'),
      otherCharges: pick(settings.otherChargesAccountId, '5045') || pick(settings.inventoryAccountId, '1020'),
      cgst: pick(settings.inputCgstAccountId, '1051'),
      sgst: pick(settings.inputSgstAccountId, '1052'),
      igst: pick(settings.inputIgstAccountId, '1053'),
      vat: pick(settings.inputVatAccountId, '1054') || pick(settings.inputIgstAccountId, '1053'),
      advance: pick(settings.supplierAdvanceAccountId, '2020'),
      bank: pick(settings.defaultBankAccountId, '1000'),
      cash: pick(settings.defaultCashAccountId, '1010'),
    };
  }

  /**
   * Blocks posting into a closed fiscal period.
   */
  async assertOpenFiscalPeriod(tx: any, businessId: string, date: Date) {
    const closed = await tx.fiscalPeriod.findFirst({
      where: {
        businessId,
        startDate: { lte: date },
        endDate: { gte: date },
        isClosed: true,
      },
    });
    if (closed) {
      throw new BadRequestException(`Accounting period "${closed.name}" is closed; posting is blocked`);
    }
  }

  /**
   * Creates a strictly balanced double-entry journal entry. Rolls back if debit != credit.
   */
  async createBalancedJournal(
    tx: any,
    params: {
      businessId: string;
      entryNumber: string;
      date: Date;
      narration: string;
      reference: string;
      lines: JournalLineInput[];
    },
  ) {
    await this.assertOpenFiscalPeriod(tx, params.businessId, params.date);

    const nonZeroLines = params.lines.filter((l) => Math.abs(l.debit) > 0.004 || Math.abs(l.credit) > 0.004);
    const totalDebit = nonZeroLines.reduce((sum, l) => sum + Number(l.debit), 0);
    const totalCredit = nonZeroLines.reduce((sum, l) => sum + Number(l.credit), 0);

    if (nonZeroLines.length === 0 || Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `Journal entry ${params.entryNumber} is out of balance (Dr ${totalDebit.toFixed(2)} vs Cr ${totalCredit.toFixed(2)})`,
      );
    }

    const journal = await tx.journalEntry.create({
      data: {
        businessId: params.businessId,
        entryNumber: params.entryNumber,
        date: params.date,
        narration: params.narration,
        reference: params.reference,
        isPosted: true,
      },
    });

    for (const line of nonZeroLines) {
      await tx.journalLine.create({
        data: {
          journalEntryId: journal.id,
          accountId: line.accountId,
          debit: Number(line.debit).toFixed(2),
          credit: Number(line.credit).toFixed(2),
          notes: line.notes,
        },
      });
    }

    return journal;
  }

  /**
   * Creates a reversal journal entry for cancellation.
   */
  async reverseJournal(tx: any, businessId: string, originalJournalId: string, reversalNumber: string, reason: string) {
    const original = await tx.journalEntry.findFirst({
      where: { id: originalJournalId, businessId },
      include: { lines: true },
    });
    if (!original) return null;

    return this.createBalancedJournal(tx, {
      businessId,
      entryNumber: reversalNumber,
      date: new Date(),
      narration: `Reversal of ${original.entryNumber}: ${reason}`,
      reference: reversalNumber,
      lines: original.lines.map((l: any) => ({
        accountId: l.accountId,
        debit: Number(l.credit),
        credit: Number(l.debit),
        notes: `Reversal: ${l.notes || ''}`,
      })),
    });
  }

  /**
   * Increases branch stock using WAC or FIFO costing and records a StockMovement.
   */
  async applyStockIn(
    tx: any,
    params: {
      branchId: string;
      variantId: string;
      quantity: number;
      landedUnitCost: number;
      costingMethod: 'WAC' | 'FIFO';
      referenceId: string;
      referenceDocumentType: string;
      idempotencyKey: string;
      performedById?: string;
      batchNumber?: string | null;
      serialNumber?: string | null;
      expiryDate?: Date | null;
      notes?: string;
    },
  ) {
    const existing = await tx.stockBalance.findUnique({
      where: { branchId_variantId: { branchId: params.branchId, variantId: params.variantId } },
    });

    const oldQty = Number(existing?.quantity || 0);
    const oldAvg = Number(existing?.averageCost || 0);
    const newQty = oldQty + params.quantity;

    let nextAvgCost = params.landedUnitCost;
    if (params.costingMethod === 'WAC' && newQty > 0) {
      nextAvgCost = (oldQty * oldAvg + params.quantity * params.landedUnitCost) / newQty;
    } else if (params.costingMethod === 'FIFO') {
      // Weighted average of remaining layers including this new layer
      nextAvgCost = newQty > 0 ? (oldQty * oldAvg + params.quantity * params.landedUnitCost) / newQty : params.landedUnitCost;
    }

    await tx.stockBalance.upsert({
      where: { branchId_variantId: { branchId: params.branchId, variantId: params.variantId } },
      create: {
        branchId: params.branchId,
        variantId: params.variantId,
        quantity: params.quantity.toFixed(2),
        averageCost: nextAvgCost.toFixed(2),
      },
      update: {
        quantity: newQty.toFixed(2),
        averageCost: nextAvgCost.toFixed(2),
      },
    });

    await tx.stockMovement.create({
      data: {
        branchId: params.branchId,
        variantId: params.variantId,
        type: 'IN_PURCHASE',
        quantity: params.quantity.toFixed(2),
        remainingQuantity: params.quantity.toFixed(3),
        unitCost: params.landedUnitCost.toFixed(2),
        totalCost: (params.quantity * params.landedUnitCost).toFixed(2),
        referenceId: params.referenceId,
        referenceDocumentType: params.referenceDocumentType,
        idempotencyKey: params.idempotencyKey,
        performedById: params.performedById || null,
        batchNumber: params.batchNumber || null,
        serialNumber: params.serialNumber || null,
        expiryDate: params.expiryDate || null,
        notes: params.notes,
      },
    });
  }

  /**
   * Decreases branch stock (for Purchase Return or GRN/Invoice cancellation).
   * Enforces stock sufficiency when `blockOnInsufficient` is true.
   */
  async applyStockOut(
    tx: any,
    params: {
      branchId: string;
      variantId: string;
      quantity: number;
      unitCost: number;
      costingMethod: 'WAC' | 'FIFO';
      blockOnInsufficient: boolean;
      movementType: 'RETURN_OUT_DEBIT_NOTE' | 'ADJUSTMENT_SUB';
      referenceId: string;
      referenceDocumentType: string;
      idempotencyKey: string;
      performedById?: string;
      notes?: string;
    },
  ): Promise<number> {
    const balance = await tx.stockBalance.findUnique({
      where: { branchId_variantId: { branchId: params.branchId, variantId: params.variantId } },
    });

    const currentQty = Number(balance?.quantity || 0);
    if (params.blockOnInsufficient && currentQty < params.quantity) {
      throw new BadRequestException(
        `Insufficient stock in branch for item ${params.variantId} (available: ${currentQty}, required: ${params.quantity})`,
      );
    }

    let totalOutCost = params.quantity * params.unitCost;

    if (params.costingMethod === 'FIFO') {
      const layers = await tx.stockMovement.findMany({
        where: {
          branchId: params.branchId,
          variantId: params.variantId,
          type: 'IN_PURCHASE',
          remainingQuantity: { gt: 0 },
        },
        orderBy: { createdAt: 'asc' },
      });
      let remainingToConsume = params.quantity;
      let fifoCost = 0;
      for (const layer of layers) {
        if (remainingToConsume <= 0) break;
        const avail = Number(layer.remainingQuantity);
        const take = Math.min(avail, remainingToConsume);
        fifoCost += take * Number(layer.unitCost);
        remainingToConsume -= take;
        await tx.stockMovement.update({
          where: { id: layer.id },
          data: { remainingQuantity: (avail - take).toFixed(3) },
        });
      }
      if (remainingToConsume > 0) {
        fifoCost += remainingToConsume * params.unitCost;
      }
      totalOutCost = fifoCost;
    }

    if (balance) {
      await tx.stockBalance.update({
        where: { id: balance.id },
        data: { quantity: (currentQty - params.quantity).toFixed(2) },
      });
    } else {
      await tx.stockBalance.create({
        data: {
          branchId: params.branchId,
          variantId: params.variantId,
          quantity: (-params.quantity).toFixed(2),
          averageCost: params.unitCost.toFixed(2),
        },
      });
    }

    const effectiveUnitCost = params.quantity > 0 ? totalOutCost / params.quantity : params.unitCost;

    await tx.stockMovement.create({
      data: {
        branchId: params.branchId,
        variantId: params.variantId,
        type: params.movementType,
        quantity: params.quantity.toFixed(2),
        remainingQuantity: '0',
        unitCost: effectiveUnitCost.toFixed(2),
        totalCost: totalOutCost.toFixed(2),
        referenceId: params.referenceId,
        referenceDocumentType: params.referenceDocumentType,
        idempotencyKey: params.idempotencyKey,
        performedById: params.performedById || null,
        notes: params.notes,
      },
    });

    return totalOutCost;
  }

  /**
   * Optimistic locking check.
   */
  assertVersion(expectedVersion: number | undefined, actualVersion: number, label: string) {
    if (expectedVersion !== undefined && expectedVersion !== actualVersion) {
      throw new ConflictException(`${label} was modified by another user. Refresh and retry.`);
    }
  }
}
