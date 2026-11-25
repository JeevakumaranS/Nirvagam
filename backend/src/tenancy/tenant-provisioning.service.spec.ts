import { BusinessType, IndustryType } from '@nirvagam/shared';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantDatabaseService } from './tenant-database.service';

const businessRegistration = {
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

describe('TenantProvisioningService', () => {
  function createService(failAtUserInsert = false) {
    const client = {
      query: jest.fn(async (sql: string) => {
        if (failAtUserInsert && sql.includes('INSERT INTO users')) {
          throw new Error('simulated user creation failure');
        }
        if (sql.includes('INSERT INTO businesses')) {
          return { rows: [{ id: 'business-id' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO branches')) {
          return { rows: [{ id: 'branch-id' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO users')) {
          return { rows: [{ id: 'owner-id' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO roles')) {
          return { rows: [{ id: 'owner-role-id' }], rowCount: 1 };
        }
        if (sql.includes('INSERT INTO permissions')) {
          return { rows: [], rowCount: 10 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: jest.fn(),
    };
    const pool = { connect: jest.fn().mockResolvedValue(client) };
    const tenantDb = { getPool: jest.fn().mockReturnValue(pool) };
    const service = new TenantProvisioningService(tenantDb as unknown as TenantDatabaseService);
    return { service, client };
  }

  it('creates the schema, tenant tables, and owner in one transaction', async () => {
    const { service, client } = createService();

    const result = await service.provisionBusiness(businessRegistration);

    expect(result.ownerEmail).toBe('owner@example.com');
    expect(client.query).toHaveBeenCalledWith('BEGIN;');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining('CREATE SCHEMA'));
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE branches SET owner_id'),
      ['owner-id', 'branch-id']
    );
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO users'),
      expect.arrayContaining(['Jane', 'Mary Doe'])
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT;');
  });

  it('rolls back the entire schema and registration if owner creation fails', async () => {
    const { service, client } = createService(true);

    await expect(service.provisionBusiness(businessRegistration)).rejects.toThrow(
      'simulated user creation failure'
    );

    expect(client.query).toHaveBeenCalledWith('ROLLBACK;');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT;');
  });
});
