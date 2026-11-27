import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvoiceStatus, InvoiceType } from '@nirvagam/shared';

const SALES_REPORT_DOCUMENT_TYPES = [
  InvoiceType.TAX_INVOICE,
  InvoiceType.BILL_OF_SUPPLY,
  InvoiceType.NON_GST,
  InvoiceType.POS_RECEIPT,
  InvoiceType.CREDIT_NOTE,
  InvoiceType.DEBIT_NOTE,
  InvoiceType.SALES_RETURN,
];

const GST_REPORT_DOCUMENT_TYPES = [
  InvoiceType.TAX_INVOICE,
  InvoiceType.BILL_OF_SUPPLY,
  InvoiceType.POS_RECEIPT,
  InvoiceType.CREDIT_NOTE,
  InvoiceType.DEBIT_NOTE,
  InvoiceType.SALES_RETURN,
];

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardKpis(businessId: string, branchId?: string) {
    const branchWhere = branchId ? { branchId } : { branch: { businessId } };
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const salesWhere = {
      ...branchWhere,
      status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] },
      invoiceType: { in: SALES_REPORT_DOCUMENT_TYPES },
    };

    const [sales, monthlySales, purchases, customers, suppliers, stockBalances, bankAccounts, recentInvoices] = await Promise.all([
      this.prisma.salesInvoice.aggregate({
        where: salesWhere,
        _sum: { grandTotal: true, paidAmount: true, taxableAmount: true },
        _count: { id: true },
      }),
      this.prisma.salesInvoice.aggregate({
        where: {
          ...salesWhere,
          invoiceDate: { gte: monthStart, lt: nextMonthStart },
        },
        _sum: { grandTotal: true },
      }),
      this.prisma.purchaseInvoice.aggregate({
        where: { ...branchWhere, status: { not: 'CANCELLED' } },
        _sum: { grandTotal: true, paidAmount: true },
        _count: { id: true },
      }),
      this.prisma.customer.aggregate({
        where: { businessId, isActive: true },
        _sum: { openingBalance: true },
        _count: { id: true },
      }),
      this.prisma.supplier.aggregate({
        where: { businessId },
        _sum: { openingBalance: true },
        _count: { id: true },
      }),
      this.prisma.stockBalance.findMany({
        where: {
          warehouse: branchId
            ? { branchId }
            : { branch: { businessId } },
        },
        select: { quantity: true, averageCost: true },
      }),
      this.prisma.chartOfAccount.findMany({
        where: {
          businessId,
          code: { in: ['1010', '1020'] }, // Cash & Bank
        },
        include: {
          journalLines: { select: { debit: true, credit: true } },
        },
      }),
      this.prisma.salesInvoice.findMany({
        where: salesWhere,
        orderBy: { invoiceDate: 'desc' },
        take: 5,
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          grandTotal: true,
          status: true,
          customer: { select: { name: true } },
        },
      }),
    ]);

    const totalSales = Number(sales._sum.grandTotal || 0);
    const totalPurchases = Number(purchases._sum.grandTotal || 0);

    // Receivables = Total Sales - Sales Paid + Customer Opening Balance
    const totalReceivables =
      totalSales - Number(sales._sum.paidAmount || 0) + Number(customers._sum.openingBalance || 0);

    // Payables = Total Purchases - Purchases Paid + Supplier Opening Balance
    const totalPayables =
      totalPurchases - Number(purchases._sum.paidAmount || 0) + Number(suppliers._sum.openingBalance || 0);

    // Stock Valuation = sum(quantity * averageCost)
    let stockValuation = 0;
    stockBalances.forEach((sb) => {
      stockValuation += Number(sb.quantity || 0) * Number(sb.averageCost || 0);
    });

    // Cash and Bank Balance
    let liquidCashAndBank = 0;
    bankAccounts.forEach((acc) => {
      let d = 0, c = 0;
      acc.journalLines.forEach((jl) => {
        d += Number(jl.debit || 0);
        c += Number(jl.credit || 0);
      });
      liquidCashAndBank += d - c;
    });

    return {
      totalSales,
      salesMtd: Number(monthlySales._sum.grandTotal || 0),
      totalPurchases,
      totalReceivables,
      totalPayables,
      stockValuation,
      liquidCashAndBank,
      invoicesCount: sales._count.id,
      purchaseCount: purchases._count.id,
      customerCount: customers._count.id,
      supplierCount: suppliers._count.id,
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        grandTotal: Number(invoice.grandTotal || 0),
        status: invoice.status,
        customerName: invoice.customer.name,
      })),
    };
  }

  async getGstReport(businessId: string, branchId?: string) {
    const branchWhere = branchId ? { branchId } : { branch: { businessId } };

    const [salesInvoices, purchaseInvoices] = await Promise.all([
      this.prisma.salesInvoice.findMany({
        where: {
          ...branchWhere,
          status: { notIn: [InvoiceStatus.CANCELLED, InvoiceStatus.DRAFT] },
          invoiceType: { in: GST_REPORT_DOCUMENT_TYPES },
        },
        include: { customer: true },
      }),
      this.prisma.purchaseInvoice.findMany({
        where: { ...branchWhere, status: { not: 'CANCELLED' } },
        include: { supplier: true },
      }),
    ]);

    let outwardTaxable = 0;
    let outwardCgst = 0;
    let outwardSgst = 0;
    let outwardIgst = 0;

    salesInvoices.forEach((inv) => {
      outwardTaxable += Number(inv.taxableAmount || 0);
      outwardCgst += Number(inv.cgstAmount || 0);
      outwardSgst += Number(inv.sgstAmount || 0);
      outwardIgst += Number(inv.igstAmount || 0);
    });

    let inwardTaxable = 0;
    let inwardCgst = 0;
    let inwardSgst = 0;
    let inwardIgst = 0;

    purchaseInvoices.forEach((inv) => {
      inwardTaxable += Number(inv.taxableAmount || 0);
      inwardCgst += Number(inv.cgstAmount || 0);
      inwardSgst += Number(inv.sgstAmount || 0);
      inwardIgst += Number(inv.igstAmount || 0);
    });

    return {
      gstr1Summary: {
        totalInvoices: salesInvoices.length,
        taxableAmount: outwardTaxable,
        cgst: outwardCgst,
        sgst: outwardSgst,
        igst: outwardIgst,
        totalTaxLiability: outwardCgst + outwardSgst + outwardIgst,
      },
      gstr3bSummary: {
        totalPurchaseBills: purchaseInvoices.length,
        taxableAmount: inwardTaxable,
        eligibleItcCgst: inwardCgst,
        eligibleItcSgst: inwardSgst,
        eligibleItcIgst: inwardIgst,
        totalEligibleItc: inwardCgst + inwardSgst + inwardIgst,
      },
      netGstPayable: {
        cgst: Math.max(0, outwardCgst - inwardCgst),
        sgst: Math.max(0, outwardSgst - inwardSgst),
        igst: Math.max(0, outwardIgst - inwardIgst),
      },
    };
  }
}
