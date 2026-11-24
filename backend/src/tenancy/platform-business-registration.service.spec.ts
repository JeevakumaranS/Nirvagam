import { BusinessType, IndustryType } from '@nirvagam/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformBusinessRegistrationService } from './platform-business-registration.service';
import { TenantDatabaseService } from './tenant-database.service';

describe('PlatformBusinessRegistrationService', () => {
  it('creates a separate tenant, owner account, and standard business defaults', async () => {
    const platformTx = {
      queryOne: jest.fn(async (query: string) => {
        if (query.includes('INSERT INTO platform.tenants')) {
          return { id: 'tenant-id', slug: 'org-ab12cd34' };
        }
        if (query.includes('INSERT INTO platform.business_profiles')) {
          return { id: 'profile-id' };
        }
        if (query.includes('SELECT slug FROM platform.tenants')) {
          return { slug: 'org-ab12cd34' };
        }
        return null;
      }),
      execute: jest.fn().mockResolvedValue(1),
    };

    const prismaTx = {
      tenant: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'tenant-id' }),
      },
      business: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'profile-id' }),
      },
      branch: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'branch-id', isHeadOffice: true }),
      },
      role: { findFirst: jest.fn().mockResolvedValue({ id: 'owner-role-id' }) },
      user: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'owner-id' }),
      },
      warehouse: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'warehouse-id' }),
      },
      taxRate: { createMany: jest.fn().mockResolvedValue({ count: 5 }) },
      unit: { upsert: jest.fn().mockResolvedValue({}) },
      chartOfAccount: { upsert: jest.fn().mockResolvedValue({}) },
      fiscalPeriod: { upsert: jest.fn().mockResolvedValue({}) },
      documentSequence: { upsert: jest.fn().mockResolvedValue({}) },
      userRole: { upsert: jest.fn().mockResolvedValue({}) },
      userBranchAssignment: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };

    const tenantDb = {
      withPlatform: (callback: (tx: typeof platformTx) => Promise<unknown>) => callback(platformTx),
    };
    const prisma = {
      $transaction: (callback: (tx: typeof prismaTx) => Promise<unknown>) => callback(prismaTx),
    };
    const service = new PlatformBusinessRegistrationService(
      tenantDb as unknown as TenantDatabaseService,
      prisma as unknown as PrismaService,
    );

    const result = await service.create({
      legalName: 'Example Business Ltd',
      tradeName: 'Example Business',
      businessType: BusinessType.PRIVATE_LIMITED,
      industry: IndustryType.RETAIL,
      addressLine1: '1 Market Street',
      city: 'Chennai',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '600001',
      financialYearStart: '2026-04-01',
      financialYearEnd: '2027-03-31',
      invoicePrefix: 'INV-',
      currency: 'INR',
      enabledModules: ['sales'],
      branches: [],
      username: 'OWNER@EXAMPLE.COM',
      temporaryPassword: 'TemporaryPassword@123',
      requirePasswordChange: true,
    });

    expect(result).toEqual({
      id: 'profile-id',
      tenantId: 'tenant-id',
      tenantSlug: 'org-ab12cd34',
      ownerEmail: 'owner@example.com',
    });
    expect(platformTx.queryOne).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO platform.tenants'),
      expect.any(Array),
    );
    expect(prismaTx.taxRate.createMany).toHaveBeenCalledTimes(1);
    expect(prismaTx.unit.upsert).toHaveBeenCalledTimes(3);
    expect(prismaTx.chartOfAccount.upsert).toHaveBeenCalledTimes(16);
    expect(prismaTx.fiscalPeriod.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { businessId_name: { businessId: 'profile-id', name: 'FY 2026-2027' } },
    }));
    expect(prismaTx.documentSequence.upsert).not.toHaveBeenCalled();
    expect(prismaTx.branch.create).not.toHaveBeenCalled();
    expect(prismaTx.warehouse.create).not.toHaveBeenCalled();
    expect(prismaTx.userBranchAssignment.upsert).not.toHaveBeenCalled();
    expect(prismaTx.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ email: 'owner@example.com' }),
    }));
  });
});
