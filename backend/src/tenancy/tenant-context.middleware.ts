import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextStorage } from './tenant-context.storage';
import { TenantDatabaseService, validateSchemaName } from './tenant-database.service';
import { TenantContext, TenantRecord } from './tenancy.types';

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  use(req: Request, _res: Response, next: NextFunction) {
    const path = req.path.replace(/^\/api\/v\d+(?=\/)/, '');
    if (
      path.startsWith('/platform') ||
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/register') ||
      path.startsWith('/auth/refresh') ||
      path.startsWith('/health') ||
      path.startsWith('/api/docs') ||
      path.startsWith('/docs')
    ) {
      next();
      return;
    }

    const tenantId = this.getTenantIdFromBearerToken(req);
    if (!tenantId) {
      next();
      return;
    }

    this.resolveTenant(tenantId)
      .then((tenant) => {
        if (!tenant || tenant.status !== 'active') {
          next();
          return;
        }
        validateSchemaName(tenant.schemaName);
        const context: TenantContext = {
          tenantId: tenant.id,
          schemaName: tenant.schemaName,
          slug: tenant.slug,
          displayName: tenant.displayName,
          status: tenant.status,
          roleKeys: [],
          branchIds: [],
          planLimits: tenant.planLimits || {
            maxBranches: 1,
            maxUsers: 5,
            maxInvoicesPerMonth: 500,
            featureFlags: {},
          },
        };
        TenantContextStorage.run(context, () => next());
      })
      .catch(next);
  }

  private getTenantIdFromBearerToken(req: Request): string | null {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }
    try {
      const payload = JSON.parse(
        Buffer.from(authorization.slice(7).split('.')[1] || '', 'base64url').toString('utf8')
      );
      return typeof payload.tenantId === 'string' && payload.tenantId
        ? payload.tenantId
        : null;
    } catch {
      return null;
    }
  }

  private async resolveTenant(identifier: string): Promise<TenantRecord | null> {
    const row = await this.tenantDb.withPlatform((tx) =>
      tx.queryOne<any>(
        `SELECT t.id, t.slug, t.display_name, t.schema_name, t.status, t.plan_id,
                t.region, t.db_cluster, t.schema_version, t.metadata, t.created_at, t.updated_at,
                pl.max_branches, pl.max_users, pl.max_invoices_per_month, pl.feature_flags
         FROM platform.tenants t
         LEFT JOIN platform.plan_limits pl ON pl.plan_id = t.plan_id
         WHERE t.id::text = $1
         LIMIT 1;`,
        [identifier]
      )
    );
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      slug: row.slug,
      displayName: row.display_name,
      schemaName: row.schema_name,
      status: row.status,
      planId: row.plan_id,
      region: row.region,
      dbCluster: row.db_cluster,
      schemaVersion: row.schema_version,
      metadata: row.metadata || {},
      planLimits: {
        maxBranches: row.max_branches || 1,
        maxUsers: row.max_users || 5,
        maxInvoicesPerMonth: row.max_invoices_per_month || 500,
        featureFlags: row.feature_flags || {},
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
