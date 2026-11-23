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
      const roles = await tx.query<any>(
        `SELECT pr.id, pr.role_key AS key, pr.name, pr.description,
                COUNT(pu.id)::int AS "assignedCount"
         FROM platform.platform_roles pr
         LEFT JOIN platform.platform_users pu ON pu.role = pr.role_key
         GROUP BY pr.id
         ORDER BY pr.name ASC;`
      );
      const permissions = await tx.query<any>(
        `SELECT id, permission_key AS key, category, label
         FROM platform.platform_permissions
         ORDER BY category ASC, label ASC;`
      );
      const rolePermissions = await tx.query<any>(
        `SELECT pr.role_key AS key, p.id AS "permissionId"
         FROM platform.platform_role_permissions rpp
         JOIN platform.platform_roles pr ON pr.id = rpp.role_id
         JOIN platform.platform_permissions p ON p.id = rpp.permission_id;`
      );
      const users = await tx.query<any>(
        `SELECT pu.id, pu.identity_id AS "identityId", pu.is_super_admin AS "isSuperAdmin",
                pu.role, pu.created_at AS "createdAt",
                i.email, i.first_name AS "firstName", i.last_name AS "lastName", i.status
         FROM platform.platform_users pu
         JOIN platform.identities i ON pu.identity_id = i.id
         ORDER BY pu.created_at ASC;`
      );

      return { roles, permissions, rolePermissions, users };
    });
  }

  @Put('system-roles/:roleKey/permissions')
  @UseGuards(JwtAuthGuard, PlatformAdminGuard)
  @ApiOperation({ summary: 'Replace access permissions for a platform role' })
  async updateSystemRolePermissions(
    @Param('roleKey') roleKey: string,
    @Body() body: { permissionIds: string[] }
  ) {
    const allowedRoles = ['PLATFORM_SUPPORT_ADMIN', 'PLATFORM_FINANCE_ADMIN'];
    if (!allowedRoles.includes(roleKey) || !Array.isArray(body.permissionIds)) {
      throw new HttpException('Invalid platform role or permission list', HttpStatus.BAD_REQUEST);
    }

    return await this.tenantDb.withPlatform(async (tx) => {
      const role = await tx.queryOne<{ id: string }>(
        'SELECT id FROM platform.platform_roles WHERE role_key = $1', [roleKey]
      );
      if (!role) throw new HttpException('Platform role not found', HttpStatus.NOT_FOUND);
      const permissions = await tx.query<any>(
        'SELECT id FROM platform.platform_permissions WHERE id = ANY($1::uuid[])', [body.permissionIds]
      );
      if (permissions.length !== body.permissionIds.length) {
        throw new HttpException('One or more platform permissions do not exist', HttpStatus.BAD_REQUEST);
      }
      await tx.execute('DELETE FROM platform.platform_role_permissions WHERE role_id = $1', [role.id]);
      for (const permissionId of body.permissionIds) {
        await tx.execute(
          'INSERT INTO platform.platform_role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [role.id, permissionId]
        );
      }
      return { success: true };
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
    if (!['PLATFORM_SUPPORT_ADMIN', 'PLATFORM_FINANCE_ADMIN', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'].includes(body.role)) {
      throw new HttpException('Unsupported platform role', HttpStatus.BAD_REQUEST);
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
        if (!['PLATFORM_SUPPORT_ADMIN', 'PLATFORM_FINANCE_ADMIN', 'PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'].includes(body.role)) {
          throw new HttpException('Unsupported platform role', HttpStatus.BAD_REQUEST);
        }
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
