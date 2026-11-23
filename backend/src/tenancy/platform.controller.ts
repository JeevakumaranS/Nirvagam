import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import * as bcrypt from 'bcryptjs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantMigrationService } from './tenant-migration.service';
import { TenantDatabaseService } from './tenant-database.service';
import { TenantCacheService } from './tenant-cache.service';
import { ProvisionTenantInput } from './tenancy.types';

@ApiTags('Platform Admin')
@ApiBearerAuth()
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly provisioning: TenantProvisioningService,
    private readonly migrations: TenantMigrationService,
    private readonly tenantDb: TenantDatabaseService,
    private readonly cache: TenantCacheService
  ) {}

  @Post('tenants')
  @ApiOperation({ summary: 'Provision a new isolated tenant schema' })
  async provisionTenant(@Body() input: ProvisionTenantInput) {
    return await this.provisioning.provision(input);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'List all registered tenants across database shards' })
  async listTenants() {
    return await this.tenantDb.withPlatform(async (tx) => {
      return tx.query(
        `SELECT id, slug, display_name, schema_name, status, plan_id, region, schema_version, created_at, suspended_at
         FROM platform.tenants
         ORDER BY created_at DESC;`
      );
    });
  }

  @Get('tenants/:id/status')
  @ApiOperation({ summary: 'Get current provisioning/active state of a tenant' })
  async getTenantStatus(@Param('id') id: string) {
    const tenant = await this.tenantDb.withPlatform(async (tx) => {
      return tx.queryOne(
        `SELECT id, slug, display_name, schema_name, status, schema_version, created_at, updated_at
         FROM platform.tenants
         WHERE id::text = $1 OR slug = $1 LIMIT 1;`,
        [id]
      );
    });

    if (!tenant) {
      throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
    }
    return tenant;
  }

  @Post('tenants/:id/suspend')
  @ApiOperation({ summary: 'Suspend tenant workspace (immediate access denial)' })
  async suspendTenant(@Param('id') id: string, @Body('reason') reason?: string) {
    const updated = await this.tenantDb.withPlatform(async (tx) => {
      const res = await tx.queryOne<{ id: string; slug: string }>(
        `UPDATE platform.tenants 
         SET status = 'suspended', suspended_at = NOW(), updated_at = NOW() 
         WHERE (id::text = $1 OR slug = $1)
         RETURNING id, slug;`,
        [id]
      );
      if (res) {
        await tx.execute(
          `INSERT INTO platform.platform_audit_log (action, target_type, target_id, reason)
           VALUES ('TENANT_SUSPENDED', 'TENANT', $1, $2);`,
          [res.id, reason || 'Administrative suspension']
        );
      }
      return res;
    });

    if (!updated) {
      throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
    }

    await this.cache.invalidateTenant(updated.id, updated.slug);
    return { status: 'suspended', tenantId: updated.id };
  }

  @Post('tenants/:id/resume')
  @ApiOperation({ summary: 'Resume suspended tenant workspace' })
  async resumeTenant(@Param('id') id: string) {
    const updated = await this.tenantDb.withPlatform(async (tx) => {
      const res = await tx.queryOne<{ id: string; slug: string }>(
        `UPDATE platform.tenants 
         SET status = 'active', suspended_at = NULL, updated_at = NOW() 
         WHERE (id::text = $1 OR slug = $1)
         RETURNING id, slug;`,
        [id]
      );
      if (res) {
        await tx.execute(
          `INSERT INTO platform.platform_audit_log (action, target_type, target_id, reason)
           VALUES ('TENANT_RESUMED', 'TENANT', $1, 'Workspace resumed');`,
          [res.id]
        );
      }
      return res;
    });

    if (!updated) {
      throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
    }

    await this.cache.invalidateTenant(updated.id, updated.slug);
    return { status: 'active', tenantId: updated.id };
  }

  @Get('health/migrations')
  @ApiOperation({ summary: 'Get multi-tenant schema migration health and distribution' })
  async getMigrationHealth() {
    return await this.migrations.getMigrationHealth();
  }

  @Post('migrations/run')
  @ApiOperation({ summary: 'Trigger tenant migrations across all or selected tenants' })
  async runMigrations(
    @Body() body: { tenantId?: string; concurrency?: number; dryRun?: boolean }
  ) {
    return await this.migrations.runTenantMigrations(body);
  }

  @Post('impersonate')
  @ApiOperation({ summary: 'Super admin time-boxed tenant impersonation with audit log' })
  async impersonate(
    @Body() body: { tenantId: string; reason: string; durationMinutes?: number }
  ) {
    if (!body.reason || body.reason.trim().length < 10) {
      throw new HttpException(
        'Impersonation requires a detailed justification reason (min 10 characters).',
        HttpStatus.BAD_REQUEST
      );
    }

    // Write cross-tenant audit log
    await this.tenantDb.withPlatform(async (tx) => {
      await tx.execute(
        `INSERT INTO platform.platform_audit_log (action, target_type, target_id, reason, metadata)
         VALUES ('IMPERSONATION_STARTED', 'TENANT', $1, $2, $3);`,
        [
          body.tenantId,
          body.reason,
          JSON.stringify({ durationMinutes: body.durationMinutes || 60 }),
        ]
      );
    });

    return {
      impersonationToken: `imp_${Date.now()}`,
      tenantId: body.tenantId,
      expiresInMinutes: body.durationMinutes || 60,
      banner: 'SUPER_ADMIN IMPERSONATION SESSION ACTIVE',
    };
  }

  @Get('system-roles')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiOperation({ summary: 'List system-level roles and platform administrators' })
  async getSystemRoles() {
    return await this.tenantDb.withPlatform(async (tx) => {
      const users = await tx.query<any>(
        `SELECT pu.id, pu.identity_id AS "identityId", pu.is_super_admin AS "isSuperAdmin",
                pu.role, pu.created_at AS "createdAt",
                i.email, i.first_name AS "firstName", i.last_name AS "lastName", i.status
         FROM platform.platform_users pu
         JOIN platform.identities i ON pu.identity_id = i.id
         ORDER BY pu.created_at ASC;`
      );

      const roles = [
        {
          key: 'PLATFORM_SUPER_ADMIN',
          name: 'Platform Super Admin',
          responsibilities: 'Manage entire SaaS platform',
          description: 'Full administrative control over tenant organizations, schema provisioning, business profiles, and global system configurations.',
        },
        {
          key: 'PLATFORM_SUPPORT_ADMIN',
          name: 'Platform Support Admin',
          responsibilities: 'Customer support and troubleshooting',
          description: 'Investigates customer incidents, inspects tenant logs and workspace health, and diagnoses system errors without financial write access.',
        },
        {
          key: 'PLATFORM_FINANCE_ADMIN',
          name: 'Platform Finance Admin',
          responsibilities: 'Subscription and payment management',
          description: 'Oversees SaaS subscriptions, invoice reconciliation, plan limits, billing schedules, and payment gateway transactions.',
        },
      ];

      return { roles, users };
    });
  }

  @Post('system-roles/users')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiOperation({ summary: 'Create a new platform administrator' })
  async createPlatformUser(
    @Body() body: { email: string; password?: string; firstName?: string; lastName?: string; role: string }
  ) {
    if (!body.email || !body.role) {
      throw new HttpException('Email and role are required', HttpStatus.BAD_REQUEST);
    }
    const email = body.email.toLowerCase().trim();
    const isSuperAdmin = body.role === 'PLATFORM_SUPER_ADMIN' || body.role === 'SUPER_ADMIN';

    return await this.tenantDb.withPlatform(async (tx) => {
      const existing = await tx.queryOne('SELECT id FROM platform.identities WHERE lower(email) = $1', [email]);
      if (existing) {
        throw new HttpException('An identity with this email already exists', HttpStatus.CONFLICT);
      }

      const passwordHash = await bcrypt.hash(body.password || 'Password@123', 10);
      const identity = await tx.queryOne<{ id: string }>(
        `INSERT INTO platform.identities (email, password_hash, first_name, last_name, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE')
         RETURNING id;`,
        [email, passwordHash, body.firstName || '', body.lastName || '']
      );

      const platformUser = await tx.queryOne<{ id: string }>(
        `INSERT INTO platform.platform_users (identity_id, is_super_admin, role)
         VALUES ($1, $2, $3)
         RETURNING id;`,
        [identity!.id, isSuperAdmin, body.role]
      );

      return { id: platformUser!.id, identityId: identity!.id, email, role: body.role };
    });
  }

  @Put('system-roles/users/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiOperation({ summary: 'Update a platform administrator role or status' })
  async updatePlatformUser(
    @Param('id') id: string,
    @Body() body: { role?: string; status?: string }
  ) {
    return await this.tenantDb.withPlatform(async (tx) => {
      const pu = await tx.queryOne<{ id: string; identity_id: string }>(
        'SELECT id, identity_id FROM platform.platform_users WHERE id::text = $1',
        [id]
      );
      if (!pu) {
        throw new HttpException('Platform user not found', HttpStatus.NOT_FOUND);
      }

      if (body.role) {
        const isSuperAdmin = body.role === 'PLATFORM_SUPER_ADMIN' || body.role === 'SUPER_ADMIN';
        await tx.execute(
          'UPDATE platform.platform_users SET role = $1, is_super_admin = $2 WHERE id = $3',
          [body.role, isSuperAdmin, id]
        );
      }

      if (body.status) {
        await tx.execute(
          'UPDATE platform.identities SET status = $1, updated_at = NOW() WHERE id = $2',
          [body.status, pu.identity_id]
        );
      }

      return { success: true };
    });
  }

  @Delete('system-roles/users/:id')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiOperation({ summary: 'Remove a platform administrator' })
  async deletePlatformUser(@Param('id') id: string) {
    return await this.tenantDb.withPlatform(async (tx) => {
      const pu = await tx.queryOne<{ id: string; identity_id: string }>(
        'SELECT id, identity_id FROM platform.platform_users WHERE id::text = $1',
        [id]
      );
      if (!pu) {
        throw new HttpException('Platform user not found', HttpStatus.NOT_FOUND);
      }

      const count = await tx.queryOne<{ total: string }>(
        'SELECT count(*)::text as total FROM platform.platform_users'
      );
      if (parseInt(count?.total || '0', 10) <= 1) {
        throw new HttpException('Cannot delete the sole remaining platform administrator', HttpStatus.BAD_REQUEST);
      }

      await tx.execute('DELETE FROM platform.platform_users WHERE id = $1', [id]);
      await tx.execute('DELETE FROM platform.identities WHERE id = $1', [pu.identity_id]);

      return { success: true };
    });
  }
}
