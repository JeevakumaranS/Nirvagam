import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { TenantDatabaseService, quoteIdent } from './tenant-database.service';

export interface MigrationFile {
  version: number;
  name: string;
  filePath: string;
  checksum: string;
  sql: string;
}

export interface TenantMigrationResult {
  tenantId: string;
  slug: string;
  schemaName: string;
  appliedVersions: number[];
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  durationMs: number;
  error?: string;
}

export interface MigrationSummaryReport {
  totalTenants: number;
  migratedCount: number;
  skippedCount: number;
  failedCount: number;
  results: TenantMigrationResult[];
}

@Injectable()
export class TenantMigrationService {
  private readonly logger = new Logger(TenantMigrationService.name);

  constructor(private readonly tenantDb: TenantDatabaseService) {}

  /**
   * Scans backend/migrations/tenant/*.sql and computes sha256 checksums
   */
  getTenantMigrationFiles(): MigrationFile[] {
    const migrationsDir = path.resolve(__dirname, '../../migrations/tenant');
    if (!fs.existsSync(migrationsDir)) {
      return [];
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && /^\d+_.+\.sql$/.test(f))
      .sort((a, b) => {
        const vA = parseInt(a.split('_')[0], 10);
        const vB = parseInt(b.split('_')[0], 10);
        return vA - vB;
      });

    return files.map((fileName) => {
      const filePath = path.join(migrationsDir, fileName);
      const sql = fs.readFileSync(filePath, 'utf8');
      const version = parseInt(fileName.split('_')[0], 10);
      const name = fileName.replace(/\.sql$/, '');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');

      return {
        version,
        name,
        filePath,
        checksum,
        sql,
      };
    });
  }

  /**
   * Run migrations across tenants with bounded concurrency and advisory locking
   */
  async runTenantMigrations(options: {
    tenantId?: string;
    concurrency?: number;
    dryRun?: boolean;
  } = {}): Promise<MigrationSummaryReport> {
    const { tenantId, concurrency = 5, dryRun = false } = options;
    const migrations = this.getTenantMigrationFiles();

    this.logger.log(
      `Discovered ${migrations.length} tenant migration versions. Mode: ${dryRun ? 'DRY-RUN' : 'APPLY'}`
    );

    // Fetch candidate tenants (active and suspended)
    const tenants = await this.tenantDb.withPlatform(async (tx) => {
      if (tenantId) {
        return tx.query<any>(
          `SELECT id, slug, schema_name, status, schema_version 
           FROM platform.tenants 
           WHERE (id::text = $1 OR slug = $1) AND status IN ('active', 'suspended');`,
          [tenantId]
        );
      }
      return tx.query<any>(
        `SELECT id, slug, schema_name, status, schema_version 
         FROM platform.tenants 
         WHERE status IN ('active', 'suspended') 
         ORDER BY created_at ASC;`
      );
    });

    const results: TenantMigrationResult[] = [];
    const pool = this.tenantDb.getPool();

    // Bounded parallelism runner
    let index = 0;
    const workers = Array.from({ length: Math.min(concurrency, tenants.length || 1) }, async () => {
      while (index < tenants.length) {
        const currentTenant = tenants[index++];
        const res = await this.migrateSingleTenant(pool, currentTenant, migrations, dryRun);
        results.push(res);
      }
    });

    await Promise.all(workers);

    const migratedCount = results.filter((r) => r.status === 'SUCCESS' && r.appliedVersions.length > 0).length;
    const skippedCount = results.filter((r) => r.status === 'SKIPPED' || (r.status === 'SUCCESS' && r.appliedVersions.length === 0)).length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;

    return {
      totalTenants: tenants.length,
      migratedCount,
      skippedCount,
      failedCount,
      results,
    };
  }

  private async migrateSingleTenant(
    pool: any,
    tenant: any,
    migrations: MigrationFile[],
    dryRun: boolean
  ): Promise<TenantMigrationResult> {
    const startTime = Date.now();
    const client = await pool.connect();

    try {
      await client.query('BEGIN;');

      // 1. PostgreSQL Transaction Advisory Lock per tenant
      // hashtext generates an int32 hash from string
      await client.query(
        `SELECT pg_advisory_xact_lock(hashtext('tenant_migration_' || $1));`,
        [tenant.id]
      );

      // 2. Set search path to target tenant
      await client.query(`SET LOCAL search_path TO ${quoteIdent(tenant.schema_name)}, public;`);

      // 3. Find already applied versions
      const appliedRes = await client.query(
        `SELECT version FROM schema_migrations;`
      );
      const appliedVersionsSet = new Set<number>(appliedRes.rows.map((r: any) => r.version));

      const pendingMigrations = migrations.filter((m) => !appliedVersionsSet.has(m.version));

      if (pendingMigrations.length === 0) {
        await client.query('COMMIT;');
        return {
          tenantId: tenant.id,
          slug: tenant.slug,
          schemaName: tenant.schema_name,
          appliedVersions: [],
          status: 'SKIPPED',
          durationMs: Date.now() - startTime,
        };
      }

      const appliedNow: number[] = [];

      for (const mig of pendingMigrations) {
        if (!dryRun) {
          const migStart = Date.now();
          await client.query(mig.sql);

          const migDuration = Date.now() - migStart;
          await client.query(
            `INSERT INTO schema_migrations (version, name, checksum, duration_ms)
             VALUES ($1, $2, $3, $4);`,
            [mig.version, mig.name, mig.checksum, migDuration]
          );

          // Record in platform.tenant_migrations_registry
          await client.query(
            `INSERT INTO platform.tenant_migrations_registry (
              tenant_id, version, status, started_at, finished_at, checksum, duration_ms
            ) VALUES ($1, $2, 'SUCCESS', NOW() - ($3::text || ' milliseconds')::interval, NOW(), $4, $5);`,
            [tenant.id, mig.version, migDuration.toString(), mig.checksum, migDuration]
          );
        }
        appliedNow.push(mig.version);
      }

      if (!dryRun) {
        const latestVersion = Math.max(...appliedNow, tenant.schema_version);
        await client.query(
          `UPDATE platform.tenants SET schema_version = $1, updated_at = NOW() WHERE id = $2;`,
          [latestVersion, tenant.id]
        );
      }

      await client.query('COMMIT;');

      return {
        tenantId: tenant.id,
        slug: tenant.slug,
        schemaName: tenant.schema_name,
        appliedVersions: appliedNow,
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      await client.query('ROLLBACK;');

      // Record failed migration status in platform registry
      try {
        await this.tenantDb.withPlatform(async (tx) => {
          await tx.execute(
            `INSERT INTO platform.tenant_migrations_registry (
              tenant_id, version, status, error, finished_at
            ) VALUES ($1, $2, 'FAILED', $3, NOW());`,
            [tenant.id, tenant.schema_version + 1, err.message]
          );
        });
      } catch (logErr) {
        this.logger.error('Failed to log migration failure to platform registry', logErr);
      }

      return {
        tenantId: tenant.id,
        slug: tenant.slug,
        schemaName: tenant.schema_name,
        appliedVersions: [],
        status: 'FAILED',
        durationMs: Date.now() - startTime,
        error: err.message,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Health endpoint data: Version distribution, failed migrations, lag
   */
  async getMigrationHealth(): Promise<any> {
    return await this.tenantDb.withPlatform(async (tx) => {
      const versionStats = await tx.query<any>(
        `SELECT schema_version, COUNT(*)::int as tenant_count 
         FROM platform.tenants 
         WHERE status IN ('active', 'suspended')
         GROUP BY schema_version 
         ORDER BY schema_version DESC;`
      );

      const recentFailures = await tx.query<any>(
        `SELECT r.tenant_id, t.slug, t.schema_name, r.version, r.error, r.finished_at
         FROM platform.tenant_migrations_registry r
         JOIN platform.tenants t ON t.id = r.tenant_id
         WHERE r.status = 'FAILED'
         ORDER BY r.finished_at DESC
         LIMIT 20;`
      );

      return {
        versionDistribution: versionStats,
        recentFailures,
      };
    });
  }
}
