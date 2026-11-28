import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PurchaseFinancialsReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /* -------------------------------------------------------------------------- */
  /*                     SUPPLIER SELECTION & LAST PRICE                        */
  /* -------------------------------------------------------------------------- */

  async searchSuppliersWithMetrics(user: any, query: { search?: string; variantId?: string }) {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        businessId: user.businessId,
        isActive: true,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { companyName: { contains: query.search, mode: 'insensitive' } },
                { gstin: { contains: query.search, mode: 'insensitive' } },
                { phone: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        purchaseInvoices: {
          where: { isDeleted: false, status: { not: 'CANCELLED' } },
          select: { id: true, balanceAmount: true, grandTotal: true },
        },
      },
      orderBy: [{ rating: 'desc' }, { name: 'asc' }],
    });

    const lastPrices = new Map<string, { rate: string; date: Date }>();
    if (query.variantId) {
      const items = await this.prisma.purchaseInvoiceItem.findMany({
        where: {
          variantId: query.variantId,
          purchaseInvoice: { businessId: user.businessId, isDeleted: false, status: { not: 'CANCELLED' } },
        },
        select: {
          unitRate: true,
          purchaseInvoice: { select: { supplierId: true, invoiceDate: true } },
        },
        orderBy: { purchaseInvoice: { invoiceDate: 'desc' } },
      });
      for (const item of items) {
        if (!lastPrices.has(item.purchaseInvoice.supplierId)) {
          lastPrices.set(item.purchaseInvoice.supplierId, {
            rate: String(item.unitRate),
            date: item.purchaseInvoice.invoiceDate,
          });
        }
      }
    }

    return suppliers.map((s) => {
      const outstanding = s.purchaseInvoices.reduce((sum, inv) => sum + Number(inv.balanceAmount), 0) + Number(s.openingBalance || 0);
      const last = lastPrices.get(s.id) || null;
      return {
        id: s.id,
        name: s.name,
        companyName: s.companyName,
        gstin: s.gstin,
        stateCode: s.stateCode,
        rating: Number(s.rating),
        creditLimit: Number(s.creditLimit),
        creditPeriodDays: s.creditPeriodDays,
        outstanding: Number(outstanding.toFixed(2)),
        overCreditLimit: Number(s.creditLimit) > 0 && outstanding > Number(s.creditLimit),
        lastPurchasePrice: last ? Number(last.rate) : null,
        lastPurchaseDate: last ? last.date : null,
      };
    });
  }

  /* -------------------------------------------------------------------------- */
  /*                             PRINT VOUCHER DATA                             */
  /* -------------------------------------------------------------------------- */

  async getPrintData(user: any, documentType: 'PO' | 'GRN' | 'INVOICE', id: string) {
    const business = await this.prisma.business.findUnique({ where: { id: user.businessId } });
    let doc: any = null;
    if (documentType === 'PO') {
      doc = await this.prisma.purchaseOrder.findFirst({
        where: { id, businessId: user.businessId },
        select: {
          id: true,
          orderNumber: true,
          orderDate: true,
          status: true,
          currencyCode: true,
          taxableAmount: true,
          totalTax: true,
          additionalCharges: true,
          grandTotal: true,
          supplier: true,
          branch: true,
          charges: true,
          items: {
            select: {
              id: true,
              variantId: true,
              itemName: true,
              description: true,
              quantity: true,
              unitRate: true,
              taxRate: true,
              totalAmount: true,
              variant: { select: { name: true, product: { select: { name: true } } } },
            },
          },
        },
      });
    } else if (documentType === 'GRN') {
      doc = await this.prisma.grn.findFirst({
        where: { id, businessId: user.businessId },
        select: {
          id: true,
          grnNumber: true,
          grnDate: true,
          status: true,
          totalAmount: true,
          taxableAmount: true,
          totalTax: true,
          grandTotal: true,
          supplier: true,
          branch: true,
          items: {
            select: {
              id: true,
              variantId: true,
              itemName: true,
              quantity: true,
              unitCost: true,
              taxRate: true,
              variant: { select: { name: true, product: { select: { name: true } } } },
            },
          },
        },
      });
    } else if (documentType === 'INVOICE') {
      doc = await this.prisma.purchaseInvoice.findFirst({
        where: { id, businessId: user.businessId },
        select: {
          invoiceNumber: true,
          supplierBillNumber: true,
          invoiceDate: true,
          status: true,
          mode: true,
          currencyCode: true,
          taxableAmount: true,
          totalTax: true,
          additionalCharges: true,
          grandTotal: true,
          supplier: true,
          branch: true,
          charges: true,
          items: {
            select: {
              id: true,
              variantId: true,
              itemName: true,
              description: true,
              quantity: true,
              unitRate: true,
              taxRate: true,
              totalAmount: true,
              variant: { select: { name: true, product: { select: { name: true } } } },
            },
          },
        },
      });
    }
    if (!doc) throw new NotFoundException(`${documentType} not found`);
    return { business, documentType, document: doc };
  }
}
