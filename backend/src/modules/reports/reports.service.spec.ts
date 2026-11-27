import { PrismaService } from '../../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  it('returns dashboard KPIs and recent invoices from the selected branch', async () => {
    const prisma = {
      salesInvoice: {
        aggregate: jest.fn()
          .mockResolvedValueOnce({
            _sum: { grandTotal: 110, paidAmount: 60 },
            _count: { id: 2 },
          })
          .mockResolvedValueOnce({ _sum: { grandTotal: 42 } }),
        findMany: jest.fn().mockResolvedValue([{
          id: 'invoice-id',
          invoiceNumber: 'INV-1001',
          invoiceDate: new Date('2026-11-20T00:00:00.000Z'),
          grandTotal: 42,
          status: 'PAID',
          customer: { name: 'Branch Customer' },
        }]),
      },
      purchaseInvoice: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { grandTotal: 20, paidAmount: 10 },
          _count: { id: 1 },
        }),
      },
      customer: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { openingBalance: 5 },
          _count: { id: 1 },
        }),
      },
      supplier: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { openingBalance: 3 },
          _count: { id: 1 },
        }),
      },
      stockBalance: {
        findMany: jest.fn().mockResolvedValue([{ quantity: 3, averageCost: 2 }]),
      },
      chartOfAccount: {
        findMany: jest.fn().mockResolvedValue([{
          journalLines: [{ debit: 100, credit: 25 }],
        }]),
      },
    };
    const service = new ReportsService(prisma as unknown as PrismaService);

    const result = await service.getDashboardKpis('business-id', 'branch-id');

    expect(result).toMatchObject({
      salesMtd: 42,
      totalReceivables: 55,
      customerCount: 1,
      stockValuation: 6,
      liquidCashAndBank: 75,
      recentInvoices: [{
        id: 'invoice-id',
        invoiceNumber: 'INV-1001',
        customerName: 'Branch Customer',
      }],
    });
    expect(prisma.salesInvoice.aggregate).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({ branchId: 'branch-id' }),
    }));
    expect(prisma.salesInvoice.aggregate).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        branchId: 'branch-id',
        invoiceDate: expect.objectContaining({
          gte: expect.any(Date),
          lt: expect.any(Date),
        }),
      }),
    }));
    expect(prisma.salesInvoice.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ branchId: 'branch-id' }),
      take: 5,
    }));
    expect(prisma.customer.aggregate).toHaveBeenCalledWith({
      where: { businessId: 'business-id', isActive: true },
      _sum: { openingBalance: true },
      _count: { id: true },
    });
    expect(prisma.stockBalance.findMany).toHaveBeenCalledWith({
      where: { branch: { id: 'branch-id' } },
      select: { quantity: true, averageCost: true },
    });
  });
});
