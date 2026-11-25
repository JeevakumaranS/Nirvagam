import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantDatabaseService } from './tenant-database.service';
import { TenantCacheService } from './tenant-cache.service';
import { TenantContextStorage } from './tenant-context.storage';
import { TenantContext, TenantRecord } from './tenancy.types';

@Injectable()
export class TenantResolverGuard implements CanActivate {
  private readonly logger = new Logger(TenantResolverGuard.name);

  constructor(
    private readonly tenantDb: TenantDatabaseService,
    private readonly cache: TenantCacheService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    // Skip tenancy resolution for public/platform endpoints
    const path = req.path.replace(/^\/api\/v\d+(?=\/)/, '');
    if (
      path.startsWith('/platform') ||
      path.startsWith('/auth/login') ||
      path.startsWith('/auth/register') ||
      path.startsWith('/health') ||
      path.startsWith('/api/docs') ||
      path.startsWith('/docs')
    ) {
      return true;
    }

    const user = (req as any).user;
    if (user?.platformAdmin) {
      if (path.startsWith('/auth/')) {
        return true;
      }
      throw new HttpException(
        'Platform administrators cannot access tenant business data.',
        HttpStatus.FORBIDDEN
      );
    }
    if (!user?.id || !user?.tenantId) {
      throw new HttpException('Authenticated tenant identity is required.', HttpStatus.UNAUTHORIZED);
    }

    const requestTenantIds = await this.resolveRequestTenantIdentifiers(req);
    const resolvedTenantId = requestTenantIds[0] || user.tenantId;

    if (!resolvedTenantId) {
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'TENANT_IDENTIFIER_MISSING',
          message:
            'Unable to resolve tenant context. Provide a valid subdomain, JWT tenant claim, or X-Tenant-Id header.',
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // 2. Fetch Tenant Record (from Cache or Platform DB)
    const tenant = await this.getTenantRecord(resolvedTenantId);
    if (!tenant) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          error: 'TENANT_NOT_FOUND',
          message: `Tenant [${resolvedTenantId}] does not exist in platform registry.`,
        },
        HttpStatus.NOT_FOUND
      );
    }

    for (const requestTenantId of requestTenantIds) {
      const requestedTenant = await this.getTenantRecord(requestTenantId);
      if (!requestedTenant || requestedTenant.id !== tenant.id) {
        throw new HttpException(
          'The requested tenant does not match the authenticated tenant.',
          HttpStatus.FORBIDDEN
        );
      }
    }
    if (tenant.id !== user.tenantId) {
      throw new HttpException(
        'The authenticated user does not belong to the requested tenant.',
        HttpStatus.FORBIDDEN
      );
    }

    // 3. Status checks (active, suspended, provisioning, etc.)
    if (tenant.status === 'suspended') {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'TENANT_SUSPENDED',
          message: 'This business workspace has been suspended. Please contact platform administration.',
        },
        HttpStatus.FORBIDDEN
      );
    }

    if (tenant.status === 'provisioning') {
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'TENANT_PROVISIONING',
          message: 'Tenant workspace is currently provisioning. Please retry in a few seconds.',
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    if (tenant.status !== 'active') {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          error: 'TENANT_INACTIVE',
          message: `Tenant is currently in state [${tenant.status}]. Access denied.`,
        },
        HttpStatus.FORBIDDEN
      );
    }

    const tenantUser = await this.tenantDb.withTenant({
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
    }, (tx) => tx.queryOne<{ id: string }>(
      `SELECT id FROM users WHERE id = $1::uuid AND tenant_id = $2::uuid AND is_active = TRUE LIMIT 1;`,
      [user.id, tenant.id]
    ));
    if (!tenantUser) {
      throw new HttpException(
        'The authenticated user is not present in this tenant schema.',
        HttpStatus.FORBIDDEN
      );
    }

    const tenantCtx: TenantContext = {
      tenantId: tenant.id,
      schemaName: tenant.schemaName,
      slug: tenant.slug,
      displayName: tenant.displayName,
      status: tenant.status,
      identityId: user.id,
      userId: user.id,
      email: user?.email,
      roleKeys: user.roles || [],
      branchIds: [],
      planLimits: tenant.planLimits || {
        maxBranches: 1,
        maxUsers: 5,
        maxInvoicesPerMonth: 500,
        featureFlags: {},
      },
    };

    // Attach to Request object and AsyncLocalStorage
    (req as any).tenant = tenantCtx;
    TenantContextStorage.enterWith(tenantCtx);
    return true;
  }

  private async resolveRequestTenantIdentifiers(req: Request): Promise<string[]> {
    const identifiers: string[] = [];
    const host = req.headers['host'] || '';

    if (host) {
      const domainWithoutPort = host.split(':')[0];
      const cachedDomainTenant = await this.cache.get<string>(`domain:${domainWithoutPort}`);
      if (cachedDomainTenant) {
        identifiers.push(cachedDomainTenant);
      } else {
        const domainRecord = await this.tenantDb.withPlatform(async (tx) => {
          return tx.queryOne<{ tenant_id: string }>(
            `SELECT tenant_id FROM platform.tenant_domains WHERE domain = $1 AND verified = true LIMIT 1;`,
            [domainWithoutPort]
          );
        });

        if (domainRecord?.tenant_id) {
          await this.cache.set(`domain:${domainWithoutPort}`, domainRecord.tenant_id, 300);
          identifiers.push(domainRecord.tenant_id);
        }
      }
    }

    const headerTenantId = req.headers['x-tenant-id'] as string;
    if (headerTenantId) {
      identifiers.push(headerTenantId.trim());
    }

    return identifiers;
  }

  private async getTenantRecord(identifier: string): Promise<TenantRecord | null> {
    const cached = await this.cache.getTenant(identifier);
    if (cached) return cached;

    const row = await this.tenantDb.withPlatform(async (tx) => {
      return tx.queryOne<any>(
        `SELECT t.id, t.slug, t.display_name, t.schema_name, t.status, t.plan_id,
                t.region, t.db_cluster, t.schema_version, t.metadata, t.created_at, t.updated_at,
                pl.max_branches, pl.max_users, pl.max_invoices_per_month, pl.feature_flags
         FROM platform.tenants t
         LEFT JOIN platform.plan_limits pl ON pl.plan_id = t.plan_id
         WHERE t.id::text = $1 OR t.slug = $1 OR t.schema_name = $1
         LIMIT 1;`,
        [identifier]
      );
    });

    if (!row) return null;

    const record: TenantRecord = {
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

    await this.cache.setTenant(identifier, record, 60);
    return record;
  }

}
