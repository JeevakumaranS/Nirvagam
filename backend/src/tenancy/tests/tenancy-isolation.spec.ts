import {
  TenantDatabaseService,
  validateSchemaName,
  quoteIdent,
} from '../tenant-database.service';
import { TenantCacheService } from '../tenant-cache.service';
import { TenantContextStorage } from '../tenant-context.storage';
import { TenantStorageService } from '../tenant-storage.service';
import { TenantContext } from '../tenancy.types';

describe('Tenancy Isolation & Security Boundaries', () => {
  let tenantDb: TenantDatabaseService;
  let cache: TenantCacheService;
  let storage: TenantStorageService;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://postgres:user@localhost:5432/nirvagam_db';
    tenantDb = new TenantDatabaseService();
    tenantDb.onModuleInit();
    cache = new TenantCacheService();
    storage = new TenantStorageService();
  });

  afterAll(async () => {
    await tenantDb.onModuleDestroy();
  });

  describe('Schema Name & Injection Defenses', () => {
    it('should accept valid schema names matching ^t_[a-f0-9]{8,32}$', () => {
      expect(() => validateSchemaName('t_917a4e9d59c2')).not.toThrow();
      expect(() => validateSchemaName('t_12345678')).not.toThrow();
      expect(() => validateSchemaName('t_abcdef0123456789abcdef0123456789')).not.toThrow();
    });

    it('should reject malicious SQL injection in schema names', () => {
      const maliciousNames = [
        "t_abc'; DROP TABLE users; --",
        'public',
        'platform',
        't_invalid!@#$',
        '../../etc/passwd',
        't_UPPERCASE',
        't_short',
        '',
      ];

      for (const name of maliciousNames) {
        expect(() => validateSchemaName(name)).toThrow(/SECURITY VIOLATION/);
      }
    });

    it('should properly quote identifiers with quoteIdent', () => {
      expect(quoteIdent('t_917a4e9d59c2')).toBe('"t_917a4e9d59c2"');
      expect(quoteIdent('some"injection')).toBe('"some""injection"');
    });
  });

  describe('Cross-Tenant Data Isolation', () => {
    const tenantA: TenantContext = {
      tenantId: '11111111-1111-1111-1111-111111111111',
      schemaName: 't_aaaaaaaaaaaa',
      slug: 'tenant-a',
      displayName: 'Tenant A Ltd',
      status: 'active',
      roleKeys: ['BUSINESS_OWNER'],
      branchIds: [],
      planLimits: { maxBranches: 1, maxUsers: 5, maxInvoicesPerMonth: 500, featureFlags: {} },
    };

    const tenantB: TenantContext = {
      tenantId: '22222222-2222-2222-2222-222222222222',
      schemaName: 't_bbbbbbbbbbbb',
      slug: 'tenant-b',
      displayName: 'Tenant B Ltd',
      status: 'active',
      roleKeys: ['BUSINESS_OWNER'],
      branchIds: [],
      planLimits: { maxBranches: 1, maxUsers: 5, maxInvoicesPerMonth: 500, featureFlags: {} },
    };

    beforeAll(async () => {
      // Create schemas for testing
      const pool = tenantDb.getPool();
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "t_aaaaaaaaaaaa";`);
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "t_bbbbbbbbbbbb";`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS "t_aaaaaaaaaaaa".customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS "t_bbbbbbbbbbbb".customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL
        );
      `);

      // Clean existing
      await pool.query(`TRUNCATE "t_aaaaaaaaaaaa".customers, "t_bbbbbbbbbbbb".customers;`);
    });

    afterAll(async () => {
      const pool = tenantDb.getPool();
      await pool.query(`DROP SCHEMA IF EXISTS "t_aaaaaaaaaaaa" CASCADE;`);
      await pool.query(`DROP SCHEMA IF EXISTS "t_bbbbbbbbbbbb" CASCADE;`);
    });

    it('should insert records into Tenant A and confirm Tenant B cannot see them', async () => {
      // Insert in Tenant A
      await tenantDb.withTenant(tenantA, async (tx) => {
        await tx.execute(`INSERT INTO customers (name) VALUES ('Secret Customer of Tenant A');`);
      });

      // Insert in Tenant B
      await tenantDb.withTenant(tenantB, async (tx) => {
        await tx.execute(`INSERT INTO customers (name) VALUES ('Confidential Client of Tenant B');`);
      });

      // Read from Tenant A: must only see Tenant A customer
      const customersA = await tenantDb.withTenant(tenantA, async (tx) => {
        return tx.query(`SELECT name FROM customers;`);
      });
      expect(customersA).toHaveLength(1);
      expect(customersA[0].name).toBe('Secret Customer of Tenant A');

      // Read from Tenant B: must only see Tenant B customer
      const customersB = await tenantDb.withTenant(tenantB, async (tx) => {
        return tx.query(`SELECT name FROM customers;`);
      });
      expect(customersB).toHaveLength(1);
      expect(customersB[0].name).toBe('Confidential Client of Tenant B');
    });

    it('should never leak search_path across connection pool reuses', async () => {
      // 1. Run in Tenant A
      await tenantDb.withTenant(tenantA, async (tx) => {
        const pathRes = await tx.queryOne<any>('SHOW search_path;');
        expect(pathRes.search_path).toContain('t_aaaaaaaaaaaa');
      });

      // 2. Acquire a raw client from the pool outside withTenant
      const pool = tenantDb.getPool();
      const rawClient = await pool.connect();
      try {
        const defaultPath = await rawClient.query('SHOW search_path;');
        // SET LOCAL automatically expired upon COMMIT/ROLLBACK: no tenant A leakage!
        expect(defaultPath.rows[0].search_path).not.toContain('t_aaaaaaaaaaaa');
      } finally {
        rawClient.release();
      }
    });
  });

  describe('Storage & Cache Scoping', () => {
    it('should reject cross-tenant download URL generation', async () => {
      const tenantA: TenantContext = {
        tenantId: 'tenant-123',
        schemaName: 't_12345678',
        slug: 't-123',
        displayName: 'T123',
        status: 'active',
        roleKeys: [],
        branchIds: [],
        planLimits: { maxBranches: 1, maxUsers: 5, maxInvoicesPerMonth: 500, featureFlags: {} },
      };

      await TenantContextStorage.run(tenantA, async () => {
        // Can access own key
        const ownKey = storage.getScopedStorageKey('invoice.pdf', 'invoices');
        expect(ownKey).toContain('tenants/tenant-123/invoices/');

        const downloadUrl = await storage.generatePresignedDownloadUrl(ownKey);
        expect(downloadUrl).toContain(ownKey);

        // Cannot access Tenant B key
        const foreignKey = 'tenants/tenant-999/invoices/secret.pdf';
        await expect(storage.generatePresignedDownloadUrl(foreignKey)).rejects.toThrow(
          /SECURITY VIOLATION/
        );
      });
    });

    it('should isolate cache entries and support prefix flushing per tenant', async () => {
      await cache.set('t:tenant-1:key1', 'val1');
      await cache.set('t:tenant-1:key2', 'val2');
      await cache.set('t:tenant-2:key1', 'val2_1');

      expect(await cache.get('t:tenant-1:key1')).toBe('val1');
      expect(await cache.get('t:tenant-2:key1')).toBe('val2_1');

      // Flush tenant-1
      await cache.flushTenant('tenant-1');

      expect(await cache.get('t:tenant-1:key1')).toBeNull();
      expect(await cache.get('t:tenant-1:key2')).toBeNull();
      // Tenant-2 must remain completely intact
      expect(await cache.get('t:tenant-2:key1')).toBe('val2_1');
    });
  });
});
