import { TenantDatabaseService } from '../tenant-database.service';
import { TenantContext } from '../tenancy.types';

describe('Tenancy High Concurrency Isolation', () => {
  let tenantDb: TenantDatabaseService;
  const NUM_TENANTS = 10;
  const REQUESTS_PER_TENANT = 20; // 200 total concurrent requests
  const tenants: TenantContext[] = [];

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://postgres:user@localhost:5432/nirvagam_db';
    tenantDb = new TenantDatabaseService();
    tenantDb.onModuleInit();

    const pool = tenantDb.getPool();

    // Prepare 10 distinct tenant schemas matching ^t_[a-f0-9]{8,32}$
    for (let i = 0; i < NUM_TENANTS; i++) {
      const hex = i.toString(16).padStart(8, '0');
      const schemaName = `t_cc000000${hex}`;
      const tenantCtx: TenantContext = {
        tenantId: `tenant-conc-${i}`,
        schemaName,
        slug: `conc-tenant-${i}`,
        displayName: `Concurrent Tenant ${i}`,
        status: 'active',
        roleKeys: ['BUSINESS_OWNER'],
        branchIds: [],
        planLimits: { maxBranches: 1, maxUsers: 5, maxInvoicesPerMonth: 500, featureFlags: {} },
      };
      tenants.push(tenantCtx);

      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "${schemaName}".tenant_marker (
          id SERIAL PRIMARY KEY,
          tenant_name TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
      await pool.query(`TRUNCATE "${schemaName}".tenant_marker;`);
    }
  });

  afterAll(async () => {
    const pool = tenantDb.getPool();
    for (const t of tenants) {
      await pool.query(`DROP SCHEMA IF EXISTS "${t.schemaName}" CASCADE;`);
    }
    await tenantDb.onModuleDestroy();
  });

  it('should process 200 concurrent requests across tenants with zero row cross-contamination', async () => {
    // Generate 200 asynchronous tasks interleaved across tenants
    const tasks: Array<Promise<{ tenantId: string; readBackName: string }>> = [];

    for (let r = 0; r < REQUESTS_PER_TENANT; r++) {
      for (let t = 0; t < NUM_TENANTS; t++) {
        const currentTenant = tenants[t];
        const expectedName = `Record_T${t}_R${r}`;

        tasks.push(
          tenantDb.withTenant(currentTenant, async (tx) => {
            // Write record into current tenant's table
            await tx.execute(
              `INSERT INTO tenant_marker (tenant_name) VALUES ($1);`,
              [expectedName]
            );

            // Immediately query back the inserted record inside the same transaction
            const row = await tx.queryOne<any>(
              `SELECT tenant_name FROM tenant_marker WHERE tenant_name = $1 LIMIT 1;`,
              [expectedName]
            );

            // Also check that all records in this schema belong ONLY to current tenant prefix
            const allRows = await tx.query<any>(`SELECT tenant_name FROM tenant_marker;`);
            for (const item of allRows) {
              if (!item.tenant_name.startsWith(`Record_T${t}_`)) {
                throw new Error(
                  `CATASTROPHIC CONTAMINATION: Schema ${currentTenant.schemaName} contains row "${item.tenant_name}" from another tenant!`
                );
              }
            }

            return {
              tenantId: currentTenant.tenantId,
              readBackName: row.tenant_name,
            };
          })
        );
      }
    }

    // Execute all 200 requests concurrently
    const results = await Promise.all(tasks);
    expect(results).toHaveLength(NUM_TENANTS * REQUESTS_PER_TENANT);

    // Verify row counts per tenant
    for (let t = 0; t < NUM_TENANTS; t++) {
      const count = await tenantDb.withTenant(tenants[t], async (tx) => {
        const res = await tx.queryOne<any>(`SELECT count(*)::int as count FROM tenant_marker;`);
        return res.count;
      });
      expect(count).toBe(REQUESTS_PER_TENANT);
    }
  });
});
