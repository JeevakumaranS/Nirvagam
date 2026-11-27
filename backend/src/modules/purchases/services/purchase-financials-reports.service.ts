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
  /*                             SUPPLIER LEDGER                                */
  /* -------------------------------------------------------------------------- */

  async getSupplierLedger(user: any, supplierId: string, params: { from?: string; to?: string }) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, businessId: user.businessId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    const fromDate = params.from ? new Date(params.from) : null;
    const toDate = params.to ? new Date(params.to) : null;
    const branchFilter = user.branchId ? { branchId: user.branchId } : {};

    const [invoices, returns, payments] = await Promise.all([
      this.prisma.purchaseInvoice.findMany({
        where: {
          businessId: user.businessId,
          supplierId,
          isDeleted: false,
          status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
          ...branchFilter,
        },
        orderBy: { invoiceDate: 'asc' },
      }),
      this.prisma.purchaseReturn.findMany({
        where: {
          businessId: user.businessId,
          supplierId,
          isDeleted: false,
          status: 'POSTED',
          ...branchFilter,
        },
        orderBy: { returnDate: 'asc' },
      }),
      this.prisma.purchasePayment.findMany({
        where: {
          businessId: user.businessId,
          supplierId,
          isDeleted: false,
          status: 'POSTED',
          ...branchFilter,
        },
        orderBy: { paymentDate: 'asc' },
      }),
    ]);

    const entries: Array<{
      date: Date;
      documentType: string;
      documentNumber: string;
      reference: string;
      debit: number;
      credit: number;
      runningBalance?: number;
    }> = [];

    invoices.forEach((i) =>
      entries.push({
        date: i.invoiceDate,
        documentType: 'PURCHASE_INVOICE',
        documentNumber: i.invoiceNumber,
        reference: i.supplierBillNumber,
        debit: 0,
        credit: Number(i.grandTotal),
      }),
    );

    returns.forEach((r) =>
      entries.push({
        date: r.returnDate,
        documentType: 'PURCHASE_RETURN',
        documentNumber: r.returnNumber,
        reference: r.reason || 'Debit Note',
        debit: Number(r.grandTotal),
        credit: 0,
      }),
    );

    payments.forEach((p) =>
      entries.push({
        date: p.paymentDate,
        documentType: p.paymentType === 'ADVANCE' ? 'SUPPLIER_ADVANCE' : 'PURCHASE_PAYMENT',
        documentNumber: p.paymentNumber,
        reference: p.reference || p.mode,
        debit: Number(p.amount),
        credit: 0,
      }),
    );

    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    let openingBalance = Number(supplier.openingBalance || 0);
    const filtered: typeof entries = [];

    for (const entry of entries) {
      if (fromDate && entry.date < fromDate) {
        openingBalance += entry.credit - entry.debit;
        continue;
      }
      if (toDate && entry.date > toDate) continue;
      filtered.push(entry);
    }

    let running = openingBalance;
    const rows = filtered.map((e) => {
      running += e.credit - e.debit;
      return { ...e, runningBalance: Number(running.toFixed(2)) };
    });

    return {
      supplier,
      openingBalance: Number(openingBalance.toFixed(2)),
      closingBalance: Number(running.toFixed(2)),
      entries: rows,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                   SUPPLIER OUTSTANDING & BILL-WISE AGEING                  */
  /* -------------------------------------------------------------------------- */

  async getSupplierOutstanding(user: any, supplierId?: string) {
    const today = new Date();
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        businessId: user.businessId,
        isDeleted: false,
        status: { in: ['APPROVED', 'PARTIALLY_PAID'] },
        balanceAmount: { gt: 0 },
        ...(user.branchId ? { branchId: user.branchId } : {}),
        ...(supplierId ? { supplierId } : {}),
      },
      include: { supplier: true },
      orderBy: { dueDate: 'asc' },
    });

    const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const bills = invoices.map((inv) => {
      const daysPastDue = Math.max(0, Math.floor((today.getTime() - inv.dueDate.getTime()) / 86400000));
      const bal = Number(inv.balanceAmount);
      let bucket: keyof typeof buckets = '0-30';
      if (daysPastDue > 90) bucket = '90+';
      else if (daysPastDue > 60) bucket = '61-90';
      else if (daysPastDue > 30) bucket = '31-60';
      buckets[bucket] += bal;

      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        supplierBillNumber: inv.supplierBillNumber,
        supplierId: inv.supplierId,
        supplierName: inv.supplier.name,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        grandTotal: Number(inv.grandTotal),
        paidAmount: Number(inv.paidAmount),
        balanceAmount: bal,
        daysPastDue,
        ageingBucket: bucket,
        creditLimitWarning: Number(inv.supplier.creditLimit) > 0 && bal > Number(inv.supplier.creditLimit),
        overdueWarning: daysPastDue > 0,
      };
    });

    return {
      totalOutstanding: Number(bills.reduce((s, b) => s + b.balanceAmount, 0).toFixed(2)),
      ageingBuckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, Number(v.toFixed(2))])),
      bills,
    };
  }

  /* -------------------------------------------------------------------------- */
  /*                      PURCHASE HISTORY & RATE TREND                         */
  /* -------------------------------------------------------------------------- */

  async getPurchaseHistory(user: any, params: { supplierId?: string; variantId?: string; from?: string; to?: string; status?: string }) {
    const rows = await this.prisma.purchaseInvoiceItem.findMany({
      where: {
        ...(params.variantId ? { variantId: params.variantId } : {}),
        purchaseInvoice: {
          businessId: user.businessId,
          isDeleted: false,
          ...(user.branchId ? { branchId: user.branchId } : {}),
          ...(params.supplierId ? { supplierId: params.supplierId } : {}),
          ...(params.status ? { status: params.status as any } : {}),
          ...(params.from || params.to
            ? {
                invoiceDate: {
                  ...(params.from ? { gte: new Date(params.from) } : {}),
                  ...(params.to ? { lte: new Date(params.to) } : {}),
                },
              }
            : {}),
        },
      },
      include: {
        variant: { include: { product: true } },
        purchaseInvoice: { include: { supplier: true } },
      },
      orderBy: { purchaseInvoice: { invoiceDate: 'desc' } },
      take: 200,
    });

    return rows.map((r) => ({
      invoiceId: r.purchaseInvoiceId,
      invoiceNumber: r.purchaseInvoice.invoiceNumber,
      invoiceDate: r.purchaseInvoice.invoiceDate,
      status: r.purchaseInvoice.status,
      supplierId: r.purchaseInvoice.supplierId,
      supplierName: r.purchaseInvoice.supplier.name,
      variantId: r.variantId,
      itemName: r.itemName || (r.variant ? `${r.variant.product.name} (${r.variant.name})` : r.description || 'Manual Item'),
      quantity: Number(r.quantity),
      unitRate: Number(r.unitRate),
      landedCost: Number(r.landedCost),
      totalAmount: Number(r.totalAmount),
    }));
  }

  /* -------------------------------------------------------------------------- */
  /*                             9 PURCHASE REPORTS                             */
  /* -------------------------------------------------------------------------- */

  async getReport(
    user: any,
    reportType:
      | 'register'
      | 'by-supplier'
      | 'by-item'
      | 'pending-po'
      | 'pending-grn'
      | 'returns'
      | 'tax'
      | 'ageing'
      | 'payment-due',
    params: { from?: string; to?: string },
  ) {
    const branchFilter = user.branchId ? { branchId: user.branchId } : {};
    const dateFilter =
      params.from || params.to
        ? {
            ...(params.from ? { gte: new Date(params.from) } : {}),
            ...(params.to ? { lte: new Date(params.to) } : {}),
          }
        : undefined;

    if (reportType === 'ageing' || reportType === 'payment-due') {
      const out = await this.getSupplierOutstanding(user);
      return reportType === 'payment-due'
        ? { ...out, bills: out.bills.filter((b) => b.overdueWarning || b.daysPastDue >= 0) }
        : out;
    }

    if (reportType === 'pending-po') {
      return this.prisma.purchaseOrder.findMany({
        where: {
          businessId: user.businessId,
          isDeleted: false,
          status: { in: ['APPROVED', 'PARTIALLY_RECEIVED'] },
          ...branchFilter,
        },
        include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
        orderBy: { orderDate: 'desc' },
      });
    }

    if (reportType === 'pending-grn') {
      const grns = await this.prisma.grn.findMany({
        where: {
          businessId: user.businessId,
          isDeleted: false,
          status: 'POSTED',
          ...branchFilter,
        },
        include: { supplier: true, items: { include: { variant: { include: { product: true } } } } },
        orderBy: { grnDate: 'desc' },
      });
      return grns.filter((g) => g.items.some((i) => Number(i.quantity) > Number(i.invoicedQuantity)));
    }

    if (reportType === 'returns') {
      return this.prisma.purchaseReturn.findMany({
        where: {
          businessId: user.businessId,
          isDeleted: false,
          ...(dateFilter ? { returnDate: dateFilter } : {}),
          ...branchFilter,
        },
        include: { supplier: true, items: true },
        orderBy: { returnDate: 'desc' },
      });
    }

    if (reportType === 'by-item') {
      const items = await this.prisma.purchaseInvoiceItem.findMany({
        where: {
          purchaseInvoice: {
            businessId: user.businessId,
            isDeleted: false,
            status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
            ...(dateFilter ? { invoiceDate: dateFilter } : {}),
            ...branchFilter,
          },
        },
        include: { variant: { include: { product: true } } },
      });
      const grouped = new Map<string, { variantId: string | null; name: string; quantity: number; taxable: number; total: number }>();
      for (const i of items) {
        const key = i.variantId || i.itemName || i.description || 'manual';
        const displayName = i.itemName || (i.variant ? `${i.variant.product.name} (${i.variant.name})` : i.description || 'Manual Item');
        const cur = grouped.get(key) || {
          variantId: i.variantId,
          name: displayName,
          quantity: 0,
          taxable: 0,
          total: 0,
        };
        cur.quantity += Number(i.quantity);
        cur.taxable += Number(i.taxableValue);
        cur.total += Number(i.totalAmount);
        grouped.set(key, cur);
      }
      return Array.from(grouped.values());
    }

    // register, by-supplier, tax
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: {
        businessId: user.businessId,
        isDeleted: false,
        status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
        ...(dateFilter ? { invoiceDate: dateFilter } : {}),
        ...branchFilter,
      },
      include: { supplier: true },
      orderBy: { invoiceDate: 'desc' },
    });

    if (reportType === 'by-supplier') {
      const map = new Map<string, { supplierId: string; supplierName: string; billCount: number; taxable: number; tax: number; grandTotal: number; balance: number }>();
      for (const inv of invoices) {
        const cur = map.get(inv.supplierId) || {
          supplierId: inv.supplierId,
          supplierName: inv.supplier.name,
          billCount: 0,
          taxable: 0,
          tax: 0,
          grandTotal: 0,
          balance: 0,
        };
        cur.billCount += 1;
        cur.taxable += Number(inv.taxableAmount);
        cur.tax += Number(inv.totalTax);
        cur.grandTotal += Number(inv.grandTotal);
        cur.balance += Number(inv.balanceAmount);
        map.set(inv.supplierId, cur);
      }
      return Array.from(map.values());
    }

    if (reportType === 'tax') {
      return {
        totals: {
          taxable: invoices.reduce((s, i) => s + Number(i.taxableAmount), 0),
          cgst: invoices.reduce((s, i) => s + Number(i.cgstAmount), 0),
          sgst: invoices.reduce((s, i) => s + Number(i.sgstAmount), 0),
          igst: invoices.reduce((s, i) => s + Number(i.igstAmount), 0),
          vat: invoices.reduce((s, i) => s + Number(i.vatAmount), 0),
          totalTax: invoices.reduce((s, i) => s + Number(i.totalTax), 0),
        },
        invoices,
      };
    }

    return invoices;
  }

  /* -------------------------------------------------------------------------- */
  /*                             PRINT VOUCHER DATA                             */
  /* -------------------------------------------------------------------------- */

  async getPrintData(user: any, documentType: 'PO' | 'GRN' | 'INVOICE' | 'RETURN' | 'PAYMENT', id: string) {
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
    } else if (documentType === 'RETURN') {
      doc = await this.prisma.purchaseReturn.findFirst({
        where: { id, businessId: user.businessId },
        select: {
          returnNumber: true,
          returnDate: true,
          status: true,
          currencyCode: true,
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
    } else if (documentType === 'PAYMENT') {
      doc = await this.prisma.purchasePayment.findFirst({
        where: { id, businessId: user.businessId },
        select: {
          paymentNumber: true,
          paymentDate: true,
          status: true,
          currencyCode: true,
          amount: true,
          supplier: true,
          branch: true,
          allocations: {
            select: {
              id: true,
              amount: true,
              purchaseInvoice: {
                select: { invoiceNumber: true, supplierBillNumber: true },
              },
            },
          },
        },
      });
    }
    if (!doc) throw new NotFoundException(`${documentType} not found`);
    return { business, documentType, document: doc };
  }
}
