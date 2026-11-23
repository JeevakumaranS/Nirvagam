import { Injectable, Logger } from '@nestjs/common';
import { TenantDatabaseService, TenantTx } from './tenant-database.service';
import { TenantCacheService } from './tenant-cache.service';
import { TenantContext } from './tenancy.types';

export interface TenantJobPayload<T = any> {
  jobId: string;
  tenantId: string;
  jobName: string;
  data: T;
  timestamp: number;
}

@Injectable()
export class TenantJobService {
  private readonly logger = new Logger(TenantJobService.name);

  constructor(
    private readonly tenantDb: TenantDatabaseService,
    private readonly cache: TenantCacheService
  ) {}

  /**
   * Executes a background job payload within the target tenant's security boundary
   */
  async processTenantJob<T = any, R = any>(
    payload: TenantJobPayload<T>,
    handler: (ctx: TenantContext, tx: TenantTx) => Promise<R>
  ): Promise<R> {
    const { tenantId, jobName, jobId } = payload;
    this.logger.log(`Worker picked up job [${jobName}:${jobId}] for tenant [${tenantId}]`);

    // 1. Resolve tenant record from cache or platform
    let tenant = await this.cache.getTenant(tenantId);
    if (!tenant) {
      tenant = await this.tenantDb.withPlatform(async (tx) => {
        return tx.queryOne(
          `SELECT id, slug, display_name, schema_name, status, schema_version 
           FROM platform.tenants 
           WHERE id::text = $1 LIMIT 1;`,
          [tenantId]
        );
      });
      if (tenant) {
        await this.cache.setTenant(tenantId, tenant, 60);
      }
    }

    if (!tenant) {
      throw new Error(`Job execution failed: Tenant [${tenantId}] not found in platform registry.`);
    }

    if (tenant.status !== 'active') {
      this.logger.warn(`Skipping job [${jobName}] because tenant [${tenantId}] is in state [${tenant.status}]`);
      return null as any;
    }

    const tenantCtx: TenantContext = {
      tenantId: tenant.id,
      schemaName: tenant.schemaName,
      slug: tenant.slug,
      displayName: tenant.displayName,
      status: tenant.status,
      roleKeys: ['SYSTEM_BACKGROUND_WORKER'],
      branchIds: [],
      planLimits: tenant.planLimits || {
        maxBranches: 1,
        maxUsers: 5,
        maxInvoicesPerMonth: 500,
        featureFlags: {},
      },
    };

    // 2. Execute handler inside withTenant transaction
    return await this.tenantDb.withTenant(tenantCtx, async (tx) => {
      return await handler(tenantCtx, tx);
    });
  }

  /**
   * Fans out a scheduled task (e.g. daily closing, recurring invoices, stock reorder alerts)
   * across all active tenants with rate-limiting and jitter to prevent database load spikes.
   */
  async fanOutAcrossTenants(
    jobName: string,
    dispatcher: (tenantId: string) => Promise<void>,
    options: { maxJitterMs?: number; batchSize?: number } = {}
  ): Promise<{ dispatchedCount: number }> {
    const { maxJitterMs = 500, batchSize = 25 } = options;

    const activeTenants = await this.tenantDb.withPlatform(async (tx) => {
      return tx.query<{ id: string }>(
        `SELECT id FROM platform.tenants WHERE status = 'active' ORDER BY id ASC;`
      );
    });

    this.logger.log(`Fanning out recurring job [${jobName}] across ${activeTenants.length} active tenants...`);

    let dispatched = 0;
    for (let i = 0; i < activeTenants.length; i += batchSize) {
      const batch = activeTenants.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (t) => {
          // Apply random jitter
          const jitter = Math.floor(Math.random() * maxJitterMs);
          await new Promise((resolve) => setTimeout(resolve, jitter));
          await dispatcher(t.id);
          dispatched++;
        })
      );
    }

    return { dispatchedCount: dispatched };
  }
}
