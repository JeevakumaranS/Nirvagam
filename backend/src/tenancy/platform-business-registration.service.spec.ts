import { BadRequestException } from '@nestjs/common';
import { BusinessType, IndustryType } from '@nirvagam/shared';
import { PlatformBusinessRegistrationService } from './platform-business-registration.service';
import { TenantDatabaseService } from './tenant-database.service';
import { TenantCacheService } from './tenant-cache.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { SaveBusinessProfileDto } from './dto/save-business-profile.dto';

const registration: SaveBusinessProfileDto = {
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
  branches: [],
  ownerName: 'Jane Mary Doe',
  username: 'OWNER@EXAMPLE.COM',
  temporaryPassword: 'TemporaryPassword@123',
};

describe('PlatformBusinessRegistrationService', () => {
  const createService = (
    tenantDb: Partial<TenantDatabaseService> = {},
    provisioning: Partial<TenantProvisioningService> = {},
    cache: Partial<TenantCacheService> = {}
  ) => new PlatformBusinessRegistrationService(
    tenantDb as TenantDatabaseService,
    cache as TenantCacheService,
    provisioning as TenantProvisioningService
  );

  it('creates the tenant through the transactional tenant provisioner', async () => {
    const result = {
      businessId: 'business-id',
      tenantId: 'tenant-id',
      slug: 'example-business-123abc',
      ownerEmail: 'owner@example.com',
    };
    const provisionBusiness = jest.fn().mockResolvedValue(result);
    const service = createService({}, { provisionBusiness });

    await expect(service.create(registration)).resolves.toEqual({
      id: 'business-id',
      businessId: 'business-id',
      tenantId: 'tenant-id',
      tenantSlug: result.slug,
      ownerEmail: result.ownerEmail,
    });
    expect(provisionBusiness).toHaveBeenCalledWith(registration, undefined);
  });

  it('does not read tenant business data into the platform workspace response', async () => {
    const tx = {
      query: jest.fn(async (sql: string) => {
        if (sql.includes('platform.plans')) return [{ id: 'plan-id', code: 'starter' }];
        return [{ id: 'tenant-id', slug: 'tenant-a', displayName: 'Tenant A', status: 'active' }];
      }),
    };
    const withPlatform = jest.fn((callback: (tx: any) => Promise<any>) => callback(tx));
    const service = createService({ withPlatform } as unknown as Partial<TenantDatabaseService>);

    const workspace = await service.getWorkspace();

    expect(workspace).not.toHaveProperty('profiles');
    expect(workspace.tenants).toHaveLength(1);
    expect(tx.query).toHaveBeenCalledTimes(2);
    expect(tx.query.mock.calls.some(([sql]) => sql.includes('business_profiles'))).toBe(false);
  });

  it('updates the selected tenant profile and owner identity without changing the password', async () => {
    const context = {
      id: 'tenant-id',
      tenantId: 'tenant-id',
      schemaName: 't_1234abcd',
      slug: 'tenant-a',
      displayName: 'Tenant A',
      status: 'active' as const,
      roleKeys: [],
      branchIds: [],
      planLimits: {
        maxBranches: 1,
        maxUsers: 5,
        maxInvoicesPerMonth: 500,
        featureFlags: {},
      },
    };
    const tx = {
      queryOne: jest.fn(async (sql: string) => {
        if (sql.includes('FROM businesses')) return { id: 'business-id' };
        if (sql.includes('FROM users u')) return { id: 'owner-id', email: 'owner@example.com' };
        if (sql.includes('lower(email)')) return null;
        if (sql.includes('FROM fiscal_periods') && sql.includes('is_locked')) {
          return { id: 'period-id', isLocked: false };
        }
        if (sql.includes('FROM fiscal_periods')) return null;
        if (sql.includes('FROM gst_registrations')) return { id: 'gst-id' };
        return null;
      }),
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FROM branches')) {
          return [{ id: 'branch-id', code: 'HQ', isActive: true }];
        }
        return [];
      }),
      execute: jest.fn().mockResolvedValue(1),
    };
    const withPlatform = jest.fn((callback: (tx: any) => Promise<any>) =>
      callback({ queryOne: jest.fn().mockResolvedValue(context) })
    );
    const withTenant = jest.fn((tenantContext: any, callback: (tx: any) => Promise<any>) =>
      callback(tx)
    );
    const invalidateTenant = jest.fn().mockResolvedValue(undefined);
    const service = createService(
      { withPlatform, withTenant } as unknown as Partial<TenantDatabaseService>,
      {},
      { invalidateTenant }
    );

    await expect(service.updateTenantBusinessProfile('tenant-id', {
      ...registration,
      ownerName: 'New Business Owner',
      username: 'NEW-OWNER@EXAMPLE.COM',
      temporaryPassword: 'MustNotBeApplied@123',
      branches: [{
        id: 'branch-id',
        code: 'HQ',
        name: 'Head Office',
        isHeadOffice: true,
        addressLine1: '1 Market Street',
        city: 'Chennai',
        district: 'Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        pincode: '600001',
      }],
    }, { id: 'platform-admin' } as any)).resolves.toEqual({ success: true });

    expect(withTenant).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-id', schemaName: 't_1234abcd' }),
      expect.any(Function)
    );
    const ownerUpdate = tx.execute.mock.calls.find(([sql]) => sql.includes('UPDATE users SET email'));
    expect(ownerUpdate).toEqual([
      expect.stringContaining('UPDATE users SET email'),
      ['owner-id', 'new-owner@example.com', 'New', 'Business Owner', null, 'tenant-id'],
    ]);
    expect(ownerUpdate?.[0]).not.toContain('password_hash');
    expect(invalidateTenant).toHaveBeenCalledWith('tenant-id', 'tenant-a');
  });

  it('rejects branch IDs that do not belong to the selected tenant business', async () => {
    const context = {
      id: 'tenant-id',
      tenantId: 'tenant-id',
      schemaName: 't_1234abcd',
      slug: 'tenant-a',
      displayName: 'Tenant A',
      status: 'active' as const,
      roleKeys: [],
      branchIds: [],
      planLimits: {
        maxBranches: 1,
        maxUsers: 5,
        maxInvoicesPerMonth: 500,
        featureFlags: {},
      },
    };
    const tx = {
      queryOne: jest.fn(async (sql: string) => {
        if (sql.includes('FROM businesses')) return { id: 'business-id' };
        if (sql.includes('FROM users u')) return { id: 'owner-id', email: 'owner@example.com' };
        if (sql.includes('lower(email)')) return null;
        if (sql.includes('FROM fiscal_periods') && sql.includes('is_locked')) {
          return { id: 'period-id', isLocked: false };
        }
        if (sql.includes('FROM fiscal_periods')) return null;
        if (sql.includes('FROM gst_registrations')) return null;
        return null;
      }),
      query: jest.fn(async (sql: string) =>
        sql.includes('FROM branches')
          ? [{ id: 'tenant-branch-id', code: 'HQ', isActive: true }]
          : []
      ),
      execute: jest.fn().mockResolvedValue(1),
    };
    const withPlatform = jest.fn((callback: (tx: any) => Promise<any>) =>
      callback({ queryOne: jest.fn().mockResolvedValue(context) })
    );
    const withTenant = jest.fn((tenantContext: any, callback: (tx: any) => Promise<any>) =>
      callback(tx)
    );
    const service = createService(
      { withPlatform, withTenant } as unknown as Partial<TenantDatabaseService>
    );

    await expect(service.updateTenantBusinessProfile('tenant-id', {
      ...registration,
      branches: [{
        id: 'foreign-branch-id',
        code: 'HQ',
        name: 'Head Office',
        isHeadOffice: true,
        addressLine1: '1 Market Street',
        city: 'Chennai',
        district: 'Chennai',
        state: 'Tamil Nadu',
        stateCode: '33',
        pincode: '600001',
      }],
    })).rejects.toThrow('A selected branch does not belong to this business');
    expect(tx.execute.mock.calls.some(([sql]) =>
      sql.includes('WHERE id = $1 AND business_id = $13')
    )).toBe(false);
  });

  it('deletes only the selected tenant schema and platform registry record', async () => {
    const tenant = { id: 'tenant-id', schemaName: 't_1234abcd', slug: 'tenant-a' };
    const tx = {
      queryOne: jest.fn().mockResolvedValue(tenant),
      execute: jest.fn().mockResolvedValue(1),
    };
    const withPlatform = jest.fn((callback: (tx: any) => Promise<any>) => callback(tx));
    const invalidateTenant = jest.fn().mockResolvedValue(undefined);
    const service = createService(
      { withPlatform } as unknown as Partial<TenantDatabaseService>,
      {},
      { invalidateTenant }
    );

    await expect(service.deleteTenant('tenant-id')).resolves.toEqual({ success: true });

    expect(tx.execute).toHaveBeenCalledWith(
      'DROP SCHEMA IF EXISTS "t_1234abcd" CASCADE;'
    );
    expect(tx.execute).toHaveBeenCalledWith(
      'DELETE FROM platform.tenants WHERE id = $1;',
      ['tenant-id']
    );
    expect(invalidateTenant).toHaveBeenCalledWith('tenant-id', 'tenant-a');
  });

  it('rejects multiple head-office branches before provisioning', async () => {
    const provisionBusiness = jest.fn();
    const service = createService({}, { provisionBusiness });
    const branch = {
      code: 'HQ',
      name: 'Head Office',
      isHeadOffice: true,
      addressLine1: '1 Market Street',
      city: 'Chennai',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '600001',
    };

    await expect(service.create({
      ...registration,
      branches: [branch, { ...branch, code: 'HQ2' }],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(provisionBusiness).not.toHaveBeenCalled();
  });

});
