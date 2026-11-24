import { PrismaService } from '../../prisma/prisma.service';
import { BusinessesService } from './businesses.service';

describe('BusinessesService profile settings', () => {
  it('persists tax settings, logo, and digital signature', async () => {
    const prisma: any = {
      business: {
        findFirst: jest.fn().mockResolvedValue({ id: 'business-id' }),
        update: jest.fn().mockResolvedValue({ id: 'business-id' }),
      },
    };
    const service = new BusinessesService(prisma as PrismaService);
    const changes = {
      taxSettings: { gstRegistered: true, eInvoicingEnabled: false },
      logoUrl: 'data:image/png;base64,aGVsbG8=',
      signatureUrl: 'data:image/png;base64,aGVsbG8=',
    };

    await service.update('tenant-id', 'business-id', changes);

    expect(prisma.business.update).toHaveBeenCalledWith({
      where: { id: 'business-id' },
      data: changes,
    });
  });

  it('updates a branch and clears the previous head-office designation', async () => {
    const transaction = {
      branch: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({ id: 'branch-id' }),
      },
    };
    const prisma: any = {
      business: { findFirst: jest.fn().mockResolvedValue({ id: 'business-id' }) },
      branch: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'branch-id',
          businessId: 'business-id',
          code: 'OLD',
        }),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn((callback: (tx: any) => unknown) => callback(transaction)),
    };
    const service = new BusinessesService(prisma as PrismaService);

    await service.updateBranch('tenant-id', 'business-id', 'branch-id', {
      code: 'new',
      isHeadOffice: true,
    });

    expect(transaction.branch.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'business-id', isHeadOffice: true, id: { not: 'branch-id' } },
      data: { isHeadOffice: false },
    });
    expect(transaction.branch.update).toHaveBeenCalledWith({
      where: { id: 'branch-id' },
      data: { code: 'NEW', isHeadOffice: true },
    });
  });
});
