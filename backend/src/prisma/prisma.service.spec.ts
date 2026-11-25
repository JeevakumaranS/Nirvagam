import { Test } from '@nestjs/testing';
import { PrismaService } from './prisma.service';
import { TenantContextStorage } from '../tenancy/tenant-context.storage';
import { TenantContext } from '../tenancy/tenancy.types';

describe('PrismaService tenant proxy', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const tenant: TenantContext = {
    tenantId: '11111111-1111-1111-1111-111111111111',
    schemaName: 't_aaaaaaaaaaaa',
    slug: 'tenant-a',
    displayName: 'Tenant A',
    status: 'active',
    roleKeys: [],
    branchIds: [],
    planLimits: { maxBranches: 1, maxUsers: 5, maxInvoicesPerMonth: 500, featureFlags: {} },
  };

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('allows Nest to inspect the provider constructor without opening Prisma access', async () => {
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
    const module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    const prisma = module.get(PrismaService);

    expect(prisma.constructor).toBe(PrismaService);
    expect(() => prisma.user).toThrow(/requires an authenticated tenant context/);
    expect(TenantContextStorage.run(tenant, () => prisma.user)).toBeDefined();

    await module.close();
  });
});
