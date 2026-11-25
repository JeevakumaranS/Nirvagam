import { Injectable, Logger } from '@nestjs/common';
import { TenantDatabaseService, quoteIdent, validateSchemaName } from './tenant-database.service';
import { getTenantSchemaMigrations } from './tenant-schema-migrations';

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

  getTenantMigrationFiles(): MigrationFile[] {
    return getTenantSchemaMigrations().map((migration) => ({
      ...migration,
      filePath: '',
    }));
  }

  async runTenantMigrations(options: {
    tenantId?: string;
    concurrency?: number;
    dryRun?: boolean;
  } = {}): Promise<MigrationSummaryReport> {
    const { tenantId, concurrency = 5, dryRun = false } = options;
    const migrations = this.getTenantMigrationFiles();
    const tenants = await this.tenantDb.withPlatform((tx) =>
      tx.query<any>(
        tenantId
          ? `SELECT id, slug, schema_name, status, schema_version
             FROM platform.tenants
             WHERE (id::text = $1 OR slug = $1) AND status IN ('active', 'suspended');`
          : `SELECT id, slug, schema_name, status, schema_version
             FROM platform.tenants
             WHERE status IN ('active', 'suspended')
             ORDER BY created_at ASC;`,
        tenantId ? [tenantId] : undefined
      )
    );

    const results: TenantMigrationResult[] = [];
    let index = 0;
    const workerCount = Math.min(Math.max(1, concurrency), tenants.length || 1);
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (index < tenants.length) {
        const tenant = tenants[index++];
        results.push(await this.migrateSingleTenant(tenant, migrations, dryRun));
      }
    }));

    return {
      totalTenants: tenants.length,
      migratedCount: results.filter((result) =>
        result.status === 'SUCCESS' && result.appliedVersions.length > 0
      ).length,
      skippedCount: results.filter((result) =>
        result.status === 'SKIPPED' ||
        (result.status === 'SUCCESS' && result.appliedVersions.length === 0)
      ).length,
      failedCount: results.filter((result) => result.status === 'FAILED').length,
      results,
    };
  }

  private async migrateSingleTenant(
    tenant: any,
    migrations: MigrationFile[],
    dryRun: boolean
  ): Promise<TenantMigrationResult> {
    const startTime = Date.now();
    const client = await this.tenantDb.getPool().connect();

    try {
      validateSchemaName(tenant.schema_name);
      await client.query('BEGIN;');
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [`tenant_migration_${tenant.id}`]);
      if (!dryRun) {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(tenant.schema_name)};`);
      }
      await client.query(`SET LOCAL search_path TO ${quoteIdent(tenant.schema_name)};`);

      if (!dryRun) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS tenant_prisma_migrations (
            name TEXT PRIMARY KEY,
            checksum CHAR(64) NOT NULL,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );
        `);
      }

      const trackerExists = !dryRun || (
        await client.query<{ exists: boolean }>(
          `SELECT to_regclass($1) IS NOT NULL AS exists;`,
          [`${tenant.schema_name}.tenant_prisma_migrations`]
        )
      ).rows[0].exists;
      const appliedRows = trackerExists
        ? (await client.query<{ name: string; checksum: string }>(
            `SELECT name, checksum FROM tenant_prisma_migrations;`
          )).rows
        : [];
      const applied = new Map(appliedRows.map((row) => [row.name, row.checksum.trim()]));

      for (const migration of migrations) {
        const checksum = applied.get(migration.name);
        if (checksum && checksum !== migration.checksum) {
          throw new Error(`Checksum mismatch for tenant migration ${migration.name}`);
        }
      }
      const pending = migrations.filter((migration) => !applied.has(migration.name));

      if (pending.length === 0) {
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

      for (const migration of pending) {
        if (!dryRun) {
          const migrationStart = Date.now();
          await client.query(migration.sql);
          await client.query(
            `INSERT INTO tenant_prisma_migrations (name, checksum) VALUES ($1, $2);`,
            [migration.name, migration.checksum]
          );
          await client.query(
            `INSERT INTO platform.tenant_migrations_registry (
              tenant_id, version, status, started_at, finished_at, checksum, duration_ms
            ) VALUES ($1, $2, 'SUCCESS', NOW(), NOW(), $3, $4);`,
            [tenant.id, migration.version, migration.checksum, Date.now() - migrationStart]
          );
        }
      }

      if (!dryRun) {
        await client.query(
          `UPDATE platform.tenants SET schema_version = $1, updated_at = NOW() WHERE id = $2;`,
          [migrations.length, tenant.id]
        );
      }
      await client.query('COMMIT;');

      return {
        tenantId: tenant.id,
        slug: tenant.slug,
        schemaName: tenant.schema_name,
        appliedVersions: pending.map((migration) => migration.version),
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
      };
    } catch (error: any) {
      await client.query('ROLLBACK;');
      try {
        await this.tenantDb.withPlatform((tx) =>
          tx.execute(
            `INSERT INTO platform.tenant_migrations_registry (
              tenant_id, version, status, error, finished_at
            ) VALUES ($1, $2, 'FAILED', $3, NOW());`,
            [tenant.id, tenant.schema_version + 1, error.message]
          )
        );
      } catch (logError) {
        this.logger.error('Failed to log tenant migration failure', logError);
      }
      return {
        tenantId: tenant.id,
        slug: tenant.slug,
        schemaName: tenant.schema_name,
        appliedVersions: [],
        status: 'FAILED',
        durationMs: Date.now() - startTime,
        error: error.message,
      };
    } finally {
      client.release();
    }
  }

  async getMigrationHealth(): Promise<any> {
    return this.tenantDb.withPlatform(async (tx) => {
      const versionStats = await tx.query<any>(
        `SELECT schema_version, COUNT(*)::int AS tenant_count
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
      return { versionDistribution: versionStats, recentFailures };
    });
  }
}
