import {
  Controller,
  Get,
  Post,
  Patch,
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
import { randomBytes } from 'crypto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../common/guards/platform-admin.guard';
import { PlatformPermissionsGuard } from '../common/guards/platform-permissions.guard';
import { RequirePlatformPermissions } from '../common/decorators/platform-permissions.decorator';
import { PlatformSuperAdminGuard } from '../common/guards/platform-super-admin.guard';
import { AuthUser } from '@nirvagam/shared';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantMigrationService } from './tenant-migration.service';
import { TenantDatabaseService } from './tenant-database.service';
import { TenantCacheService } from './tenant-cache.service';
import { ProvisionTenantInput } from './tenancy.types';

@ApiTags('Platform Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PlatformAdminGuard, PlatformPermissionsGuard)
@Controller('platform')
export class PlatformController {
  constructor(
    private readonly provisioning: TenantProvisioningService,
    private readonly migrations: TenantMigrationService,
    private readonly tenantDb: TenantDatabaseService,
    private readonly cache: TenantCacheService
  ) {}

  @Post('tenants')
  @RequirePlatformPermissions('platform_tenants:manage')
  @ApiOperation({ summary: 'Provision a new isolated tenant schema' })
  async provisionTenant(@Body() input: ProvisionTenantInput) {
    return await this.provisioning.provision(input);
  }

  @Get('tenants')
  @RequirePlatformPermissions('platform_tenants:view')
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
  @RequirePlatformPermissions('platform_tenants:view')
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

  @Get('tenants/:id/overview')
  @RequirePlatformPermissions('platform_tenants:view')
  @ApiOperation({ summary: 'Get the platform-side business, subscription, support and billing overview' })
  async getTenantOverview(@Param('id') id: string) {
    return this.tenantDb.withPlatform(async (tx) => {
      const tenant = await tx.queryOne(`SELECT t.id, t.slug, t.display_name AS "displayName", t.status,
        t.plan_id AS "planId", p.name AS "planName", t.created_at AS "createdAt"
        FROM platform.tenants t LEFT JOIN platform.plans p ON p.id = t.plan_id
        WHERE t.id::text = $1 OR t.slug = $1 LIMIT 1`, [id]);
      if (!tenant) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
      const [business, subscription, payments, supportRequests, auditLogs] = await Promise.all([
        tx.queryOne(`SELECT id, legal_name AS "legalName", trade_name AS "tradeName", business_type AS "businessType",
          industry, gstin, pan, city, district, state, pincode, currency FROM platform.business_profiles WHERE tenant_id = $1`, [tenant.id]),
        tx.query(`SELECT s.id, s.status, s.current_period_start AS "periodStart", s.current_period_end AS "periodEnd",
          s.auto_renew AS "autoRenew", p.name AS "planName", p.price_monthly AS "monthlyPrice"
          FROM platform.subscriptions s JOIN platform.plans p ON p.id = s.plan_id WHERE s.tenant_id = $1 ORDER BY s.created_at DESC`, [tenant.id]),
        tx.query(`SELECT id, invoice_number AS "invoiceNumber", amount, currency, status, due_at AS "dueAt", paid_at AS "paidAt"
          FROM platform.subscription_payments WHERE tenant_id = $1 ORDER BY due_at DESC`, [tenant.id]),
        tx.query(`SELECT id, subject, priority, status, resolution, created_at AS "createdAt", resolved_at AS "resolvedAt"
          FROM platform.support_requests WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenant.id]),
        tx.query(`SELECT id, action, target_type AS "targetType", target_id AS "targetId", metadata, created_at AS "createdAt"
          FROM platform.platform_audit_log WHERE target_id = $1 ORDER BY created_at DESC LIMIT 50`, [tenant.id]),
      ]);
      return { tenant, business, subscriptions: subscription, payments, supportRequests, auditLogs };
    });
  }

  @Post('tenants/:id/suspend')
  @RequirePlatformPermissions('platform_tenants:manage')
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
  @RequirePlatformPermissions('platform_tenants:manage')
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

  @Post('tenants/:id/trial')
  @RequirePlatformPermissions('trials:manage')
  async extendTrial(@Param('id') id: string, @Body() body: { trialEndsAt?: string }, @CurrentUser() user: AuthUser) {
    return this.tenantDb.withPlatform(async (tx) => {
      const row = await tx.queryOne(`UPDATE platform.tenants SET status = 'trialing', updated_at = NOW(),
        metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{trial_ends_at}', to_jsonb($2::text), true)
        WHERE id::text = $1 OR slug = $1 RETURNING id, slug, status, metadata`, [id, body.trialEndsAt || new Date(Date.now() + 14 * 86400000).toISOString()]);
      if (!row) throw new HttpException('Tenant not found', HttpStatus.NOT_FOUND);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'TRIAL_UPDATED', 'TENANT', $2, $3)`, [user.id, row.id, JSON.stringify(body)]);
      return row;
    });
  }

  @Get('health/migrations')
  @RequirePlatformPermissions('usage_analytics:view')
  @ApiOperation({ summary: 'Get multi-tenant schema migration health and distribution' })
  async getMigrationHealth() {
    return await this.migrations.getMigrationHealth();
  }

  @Get('dashboard/support')
  @RequirePlatformPermissions('platform_dashboard:view')
  async getSupportDashboard() {
    return this.tenantDb.withPlatform(async (tx) => {
      const [counts, requests, tenants, usage] = await Promise.all([
        tx.queryOne(`SELECT
          COUNT(*)::int AS "registeredBusinesses",
          COUNT(*) FILTER (WHERE status = 'active')::int AS "activeBusinesses",
          COUNT(*) FILTER (WHERE status = 'suspended')::int AS "suspendedBusinesses"
          FROM platform.tenants`),
        tx.queryOne(`SELECT
          COUNT(*) FILTER (WHERE status = 'OPEN')::int AS "openRequests",
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "pendingRequests",
          COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS "resolvedRequests"
          FROM platform.support_requests`),
        tx.query(`SELECT id, slug, display_name AS "displayName", status, created_at AS "createdAt"
          FROM platform.tenants ORDER BY created_at DESC LIMIT 8`),
        tx.queryOne(`SELECT COUNT(*)::int AS "activeSessions" FROM platform.identities WHERE status = 'ACTIVE'`),
      ]);
      return { ...counts, ...requests, ...usage, tenants };
    });
  }

  @Get('dashboard/overview')
  @RequirePlatformPermissions('platform_dashboard:view')
  async getPlatformDashboardOverview() {
    return this.tenantDb.withPlatform(async (tx) => {
      const metrics = await tx.queryOne(`SELECT
        (SELECT COUNT(*)::int FROM platform.tenants) AS "registeredBusinesses",
        (SELECT COUNT(*)::int FROM platform.tenants WHERE status = 'active') AS "activeBusinesses",
        (SELECT COUNT(*)::int FROM platform.tenants WHERE status = 'suspended') AS "suspendedBusinesses",
        (SELECT COUNT(*)::int FROM platform.subscriptions WHERE status IN ('ACTIVE','TRIALING')) AS "activeSubscriptions",
        (SELECT COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::numeric FROM platform.subscription_payments) AS "totalRevenue",
        (SELECT COUNT(*)::int FROM platform.support_requests WHERE status IN ('OPEN','PENDING')) AS "openSupportRequests",
        (SELECT COUNT(*)::int FROM platform.subscription_payments WHERE status = 'PENDING') AS "pendingPayments"
      `);
      const tenants = await tx.query(`SELECT t.id, t.display_name AS "displayName", t.status,
        p.name AS "planName", s.status AS "subscriptionStatus", s.current_period_end AS "renewalDate"
        FROM platform.tenants t
        LEFT JOIN platform.plans p ON p.id = t.plan_id
        LEFT JOIN LATERAL (SELECT status, current_period_end FROM platform.subscriptions
          WHERE tenant_id = t.id ORDER BY created_at DESC LIMIT 1) s ON TRUE
        ORDER BY t.created_at DESC LIMIT 12`);
      return { ...metrics, tenants };
    });
  }

  @Get('dashboard/finance')
  @RequirePlatformPermissions('platform_dashboard:view')
  async getFinanceDashboard() {
    return this.tenantDb.withPlatform(async (tx) => {
      const metrics = await tx.queryOne(`SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::numeric AS "totalRevenue",
        COALESCE(SUM(amount) FILTER (WHERE status = 'PAID' AND created_at >= date_trunc('month', NOW())), 0)::numeric AS "monthlyRevenue",
        (SELECT COUNT(*)::int FROM platform.subscriptions WHERE status IN ('ACTIVE','TRIALING')) AS "activeSubscriptions",
        (SELECT COUNT(*)::int FROM platform.subscriptions WHERE current_period_end BETWEEN NOW() AND NOW() + INTERVAL '30 days') AS "expiringSubscriptions",
        (SELECT COUNT(*)::int FROM platform.subscription_payments WHERE status = 'PENDING') AS "pendingPayments",
        (SELECT COUNT(*)::int FROM platform.tenants WHERE status = 'trialing' OR (status = 'active' AND created_at >= NOW() - INTERVAL '14 days')) AS "activeFreeTrials"
        FROM platform.subscription_payments`);
      const subscriptions = await tx.query(`SELECT s.id, t.display_name AS "displayName", p.name AS "planName",
        s.status, s.current_period_end AS "renewalDate"
        FROM platform.subscriptions s JOIN platform.tenants t ON t.id = s.tenant_id
        JOIN platform.plans p ON p.id = s.plan_id
        ORDER BY s.current_period_end ASC LIMIT 8`);
      return { ...metrics, subscriptions };
    });
  }

  @Get('support-requests')
  @RequirePlatformPermissions('support_requests:view')
  async listSupportRequests(@Query('status') status?: string) {
    return this.tenantDb.withPlatform((tx) => tx.query(
      `SELECT sr.id, sr.subject, sr.description, sr.priority, sr.status, sr.resolution,
        sr.escalated_at AS "escalatedAt", sr.created_at AS "createdAt", sr.updated_at AS "updatedAt",
        t.display_name AS "displayName", i.email AS "assigneeEmail"
       FROM platform.support_requests sr LEFT JOIN platform.tenants t ON t.id = sr.tenant_id
       LEFT JOIN platform.identities i ON i.id = sr.assigned_to
       WHERE ($1::text IS NULL OR sr.status = $1) ORDER BY sr.created_at DESC`, [status || null]
    ));
  }

  @Patch('support-requests/:id')
  @RequirePlatformPermissions('support_requests:manage')
  async updateSupportRequest(@Param('id') id: string, @Body() body: {
    status?: string; priority?: string; assignedTo?: string | null; resolution?: string; escalate?: boolean;
  }, @CurrentUser() user: AuthUser) {
    const allowedStatuses = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'];
    const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (body.status && !allowedStatuses.includes(body.status)) {
      throw new HttpException('Invalid support request status', HttpStatus.BAD_REQUEST);
    }
    if (body.priority && !allowedPriorities.includes(body.priority)) {
      throw new HttpException('Invalid support request priority', HttpStatus.BAD_REQUEST);
    }
    return this.tenantDb.withPlatform(async (tx) => {
      if (body.assignedTo) {
        const assignee = await tx.queryOne(
          `SELECT pu.id FROM platform.platform_users pu
           JOIN platform.identities i ON i.id = pu.identity_id
           WHERE pu.identity_id = $1 AND i.status = 'ACTIVE'`,
          [body.assignedTo],
        );
        if (!assignee) throw new HttpException('Assignee is not an active platform administrator', HttpStatus.BAD_REQUEST);
      }
      const row = await tx.queryOne(`UPDATE platform.support_requests SET
        status = COALESCE($2, status), priority = COALESCE($3, priority), assigned_to = $4::uuid,
        resolution = COALESCE($5, resolution), escalated_at = CASE WHEN $6::boolean THEN NOW() ELSE escalated_at END,
        resolved_at = CASE WHEN $2 = 'RESOLVED' THEN NOW() ELSE resolved_at END, updated_at = NOW()
        WHERE id = $1::uuid RETURNING id, status, priority, assigned_to AS "assignedTo", resolution,
        escalated_at AS "escalatedAt", resolved_at AS "resolvedAt"`,
        [id, body.status || null, body.priority || null, body.assignedTo || null, body.resolution || null, !!body.escalate]);
      if (!row) throw new HttpException('Support request not found', HttpStatus.NOT_FOUND);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'SUPPORT_REQUEST_UPDATED', 'SUPPORT_REQUEST', $2, $3)`, [user.id, id, JSON.stringify(body)]);
      return row;
    });
  }

  @Get('subscriptions')
  @RequirePlatformPermissions('subscriptions:view')
  async listSubscriptions() {
    return this.tenantDb.withPlatform((tx) => tx.query(`SELECT s.id, t.id AS "tenantId", t.display_name AS "displayName",
      p.name AS "planName", p.price_monthly AS "monthlyPrice", s.status,
      s.current_period_start AS "periodStart", s.current_period_end AS "periodEnd"
      FROM platform.subscriptions s JOIN platform.tenants t ON t.id = s.tenant_id
      JOIN platform.plans p ON p.id = s.plan_id ORDER BY s.current_period_end ASC`));
  }

  @Patch('subscriptions/:id')
  @RequirePlatformPermissions('subscriptions:manage')
  async updateSubscription(@Param('id') id: string, @Body() body: { status?: string; planId?: string; endDate?: string; autoRenew?: boolean }, @CurrentUser() user: AuthUser) {
    return this.tenantDb.withPlatform(async (tx) => {
      const row = await tx.queryOne(`UPDATE platform.subscriptions SET
        status = COALESCE($2, status), plan_id = COALESCE($3::uuid, plan_id),
        current_period_end = COALESCE($4::timestamptz, current_period_end), auto_renew = COALESCE($5, auto_renew)
        WHERE id = $1::uuid RETURNING id, tenant_id AS "tenantId", status, plan_id AS "planId",
        current_period_end AS "periodEnd", auto_renew AS "autoRenew"`,
        [id, body.status || null, body.planId || null, body.endDate || null, body.autoRenew ?? null]);
      if (!row) throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'SUBSCRIPTION_UPDATED', 'SUBSCRIPTION', $2, $3)`, [user.id, id, JSON.stringify(body)]);
      return row;
    });
  }

  @Get('plans')
  @RequirePlatformPermissions('plans:view')
  async listPlans() {
    return this.tenantDb.withPlatform((tx) => tx.query(`SELECT p.id, p.code, p.name, p.price_monthly AS "priceMonthly",
      p.currency, p.is_active AS "isActive", pl.max_users AS "maxUsers", pl.max_branches AS "maxBranches",
      pl.max_invoices_per_month AS "maxInvoicesPerMonth" FROM platform.plans p
      LEFT JOIN platform.plan_limits pl ON pl.plan_id = p.id ORDER BY p.price_monthly ASC`));
  }

  @Patch('plans/:id')
  @RequirePlatformPermissions('plans:manage')
  async updatePlan(@Param('id') id: string, @Body() body: { priceMonthly?: number; isActive?: boolean }, @CurrentUser() user: AuthUser) {
    return this.tenantDb.withPlatform(async (tx) => {
      const row = await tx.queryOne(`UPDATE platform.plans SET price_monthly = COALESCE($2, price_monthly), is_active = COALESCE($3, is_active)
        WHERE id = $1::uuid RETURNING id, code, name, price_monthly AS "priceMonthly", is_active AS "isActive"`, [id, body.priceMonthly ?? null, body.isActive ?? null]);
      if (!row) throw new HttpException('Plan not found', HttpStatus.NOT_FOUND);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'PLAN_UPDATED', 'PLAN', $2, $3)`, [user.id, id, JSON.stringify(body)]);
      return row;
    });
  }

  @Get('revenue-report')
  @RequirePlatformPermissions('revenue_reports:view')
  async revenueReport() {
    return this.tenantDb.withPlatform((tx) => tx.query(`SELECT date_trunc('month', created_at)::date AS month,
      COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::numeric AS revenue,
      COUNT(*) FILTER (WHERE status = 'PAID')::int AS "paidInvoices"
      FROM platform.subscription_payments GROUP BY 1 ORDER BY 1 DESC LIMIT 12`));
  }

  @Get('invoices')
  @RequirePlatformPermissions('invoices:view')
  async listInvoices() {
    return this.listPayments();
  }

  @Get('payments')
  @RequirePlatformPermissions('payments:view')
  async listPayments() {
    return this.tenantDb.withPlatform((tx) => tx.query(`SELECT sp.id, sp.invoice_number AS "invoiceNumber",
      t.display_name AS "displayName", sp.amount, sp.currency, sp.status, sp.due_at AS "dueAt", sp.paid_at AS "paidAt"
      FROM platform.subscription_payments sp JOIN platform.tenants t ON t.id = sp.tenant_id
      ORDER BY sp.due_at DESC`));
  }

  @Patch('payments/:id')
  @RequirePlatformPermissions('payments:manage')
  async updatePayment(@Param('id') id: string, @Body() body: { status: string; paidAt?: string }, @CurrentUser() user: AuthUser) {
    const allowedStatuses = ['PENDING', 'PAID', 'FAILED', 'REFUNDED', 'CANCELLED'];
    if (!allowedStatuses.includes(body.status)) {
      throw new HttpException('Invalid payment status', HttpStatus.BAD_REQUEST);
    }
    return this.tenantDb.withPlatform(async (tx) => {
      const payment = await tx.queryOne<{ id: string; tenant_id: string; subscription_id: string | null }>(
        'SELECT id, tenant_id, subscription_id FROM platform.subscription_payments WHERE id = $1::uuid', [id],
      );
      if (!payment) throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);

      const row = await tx.queryOne(`UPDATE platform.subscription_payments
        SET status = $2, paid_at = CASE WHEN $2 = 'PAID' THEN COALESCE($3::timestamptz, NOW()) ELSE NULL END
        WHERE id = $1::uuid
        RETURNING id, tenant_id AS "tenantId", subscription_id AS "subscriptionId", status,
          paid_at AS "paidAt"`, [id, body.status, body.paidAt || null]);

      if (body.status === 'PAID' && payment.subscription_id) {
        await tx.execute(`UPDATE platform.subscriptions
          SET status = 'ACTIVE', current_period_start = NOW(),
              current_period_end = GREATEST(current_period_end, NOW()) + INTERVAL '30 days'
          WHERE id = $1::uuid`, [payment.subscription_id]);
        await tx.execute(`UPDATE platform.tenants SET status = 'active', suspended_at = NULL, updated_at = NOW()
          WHERE id = $1::uuid`, [payment.tenant_id]);
      }
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'PAYMENT_UPDATED', 'SUBSCRIPTION_PAYMENT', $2, $3)`, [user.id, id, JSON.stringify(body)]);
      return row;
    });
  }

  @Post('subscriptions/:id/renew')
  @RequirePlatformPermissions('renewals:manage')
  async renewSubscription(@Param('id') id: string, @Body() body: { paymentId?: string; periodDays?: number }, @CurrentUser() user: AuthUser) {
    const periodDays = Number(body.periodDays || 30);
    if (!Number.isInteger(periodDays) || periodDays < 1 || periodDays > 366) {
      throw new HttpException('Renewal period must be between 1 and 366 days', HttpStatus.BAD_REQUEST);
    }
    return this.tenantDb.withPlatform(async (tx) => {
      const subscription = await tx.queryOne<{ tenant_id: string }>(
        'SELECT tenant_id FROM platform.subscriptions WHERE id = $1::uuid', [id],
      );
      if (!subscription) throw new HttpException('Subscription not found', HttpStatus.NOT_FOUND);
      const payment = body.paymentId
        ? await tx.queryOne<{ id: string }>('SELECT id FROM platform.subscription_payments WHERE id = $1::uuid AND subscription_id = $2::uuid', [body.paymentId, id])
        : null;
      if (body.paymentId && !payment) throw new HttpException('Payment does not belong to this subscription', HttpStatus.BAD_REQUEST);
      const row = await tx.queryOne(`UPDATE platform.subscriptions SET status = 'ACTIVE', current_period_start = NOW(),
        current_period_end = NOW() + ($2::int * INTERVAL '1 day') WHERE id = $1::uuid
        RETURNING id, tenant_id AS "tenantId", status, current_period_end AS "periodEnd"`, [id, periodDays]);
      await tx.execute(`UPDATE platform.tenants SET status = 'active', suspended_at = NULL, updated_at = NOW() WHERE id = $1`, [subscription.tenant_id]);
      if (payment) await tx.execute(`UPDATE platform.subscription_payments SET status = 'PAID', paid_at = COALESCE(paid_at, NOW()) WHERE id = $1`, [payment.id]);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION', $2, $3)`, [user.id, id, JSON.stringify({ periodDays, paymentId: body.paymentId || null })]);
      return row;
    });
  }

  @Get('audit-logs')
  @RequirePlatformPermissions('activity_logs:view')
  async listAuditLogs() {
    return this.tenantDb.withPlatform((tx) => tx.query(`SELECT id, actor_id AS "actorId", action,
      target_type AS "targetType", target_id AS "targetId", reason, metadata, created_at AS "createdAt"
      FROM platform.platform_audit_log ORDER BY created_at DESC LIMIT 100`));
  }

  @Post('migrations/run')
  @RequirePlatformPermissions('global_settings:manage')
  @ApiOperation({ summary: 'Trigger tenant migrations across all or selected tenants' })
  async runMigrations(
    @Body() body: { tenantId?: string; concurrency?: number; dryRun?: boolean }
  ) {
    return await this.migrations.runTenantMigrations(body);
  }

  @Post('impersonate')
  @RequirePlatformPermissions('global_settings:manage')
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
  @UseGuards(PlatformSuperAdminGuard)
  @ApiOperation({ summary: 'List system-level roles and platform administrators' })
  async getSystemRoles(@CurrentUser() user: AuthUser) {
    return await this.tenantDb.withPlatform(async (tx) => {
      const roles = await tx.query<any>(
        `SELECT pr.id, pr.role_key AS key, pr.name, pr.description,
                COUNT(pu.id)::int AS "assignedCount",
                (pr.role_key LIKE 'PLATFORM_CUSTOM_%') AS "isCustom"
         FROM platform.platform_roles pr
         LEFT JOIN platform.platform_users pu ON pu.role = pr.role_key
         WHERE pr.role_key NOT IN ('SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN')
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
         JOIN platform.platform_permissions p ON p.id = rpp.permission_id
         WHERE pr.role_key NOT IN ('SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN');`
      );
      const users = await tx.query<any>(
        `SELECT pu.id, pu.identity_id AS "identityId", pu.is_super_admin AS "isSuperAdmin",
                pu.role, pu.created_at AS "createdAt",
                i.email, i.first_name AS "firstName", i.last_name AS "lastName", i.status
         FROM platform.platform_users pu
         JOIN platform.identities i ON pu.identity_id = i.id
         WHERE NOT (pu.is_super_admin OR pu.role IN ('PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'))
            OR pu.identity_id = $1
         ORDER BY pu.created_at ASC;`,
        [user.id]
      );

      return { roles, permissions, rolePermissions, users };
    });
  }

  @Post('system-roles')
  @UseGuards(PlatformSuperAdminGuard)
  @ApiOperation({ summary: 'Create a custom platform role' })
  async createSystemRole(@Body() body: { name?: string; description?: string }) {
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body?.description === 'string' ? body.description.trim() || null : null;
    if (
      !name ||
      name.length > 100 ||
      (body?.description != null && typeof body.description !== 'string') ||
      (description && description.length > 500)
    ) {
      throw new HttpException(
        'A role name of up to 100 characters and a description of up to 500 characters are required',
        HttpStatus.BAD_REQUEST
      );
    }

    return await this.tenantDb.withPlatform(async (tx) => {
      await tx.execute(
        'SELECT pg_advisory_xact_lock(hashtext($1))',
        [`platform_role_name:${name.toLowerCase()}`]
      );
      const existing = await tx.queryOne(
        'SELECT id FROM platform.platform_roles WHERE LOWER(name) = LOWER($1) LIMIT 1',
        [name]
      );
      if (existing) {
        throw new HttpException('A platform role with this name already exists', HttpStatus.CONFLICT);
      }

      const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'ROLE';
      const roleKey = `PLATFORM_CUSTOM_${slug.slice(0, 24)}_${randomBytes(4).toString('hex').toUpperCase()}`;
      const role = await tx.queryOne(
        `INSERT INTO platform.platform_roles (role_key, name, description)
         VALUES ($1, $2, $3)
         RETURNING id, role_key AS key, name, description, 0::int AS "assignedCount", TRUE AS "isCustom"`,
        [roleKey, name, description]
      );
      return role;
    });
  }

  @Delete('system-roles/:roleKey')
  @UseGuards(PlatformSuperAdminGuard)
  @ApiOperation({ summary: 'Delete an unused custom platform role' })
  async deleteSystemRole(@Param('roleKey') roleKey: string, @CurrentUser() user: AuthUser) {
    if (!roleKey.startsWith('PLATFORM_CUSTOM_')) {
      throw new HttpException('Only custom platform roles can be deleted', HttpStatus.FORBIDDEN);
    }
    return this.tenantDb.withPlatform(async (tx) => {
      const role = await tx.queryOne<{ id: string; name: string }>(
        'SELECT id, name FROM platform.platform_roles WHERE role_key = $1', [roleKey],
      );
      if (!role) throw new HttpException('Platform role not found', HttpStatus.NOT_FOUND);
      const assigned = await tx.queryOne<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM platform.platform_users WHERE role = $1', [roleKey],
      );
      if (Number(assigned?.count || 0) > 0) {
        throw new HttpException('Remove this role from all platform administrators before deleting it', HttpStatus.CONFLICT);
      }
      await tx.execute('DELETE FROM platform.platform_role_permissions WHERE role_id = $1', [role.id]);
      await tx.execute('DELETE FROM platform.platform_roles WHERE id = $1', [role.id]);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'PLATFORM_ROLE_DELETED', 'PLATFORM_ROLE', $2, $3)`,
        [user.id, roleKey, JSON.stringify({ name: role.name })]);
      return { success: true, roleKey };
    });
  }

  @Put('system-roles/:roleKey/permissions')
  @UseGuards(PlatformSuperAdminGuard)
  @ApiOperation({ summary: 'Replace access permissions for a platform role' })
  async updateSystemRolePermissions(
    @Param('roleKey') roleKey: string,
    @Body() body: { permissionIds: string[] }
  ) {
    if (
      !Array.isArray(body?.permissionIds) ||
      body.permissionIds.some(
        (id) =>
          typeof id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
      ) ||
      new Set(body.permissionIds).size !== body.permissionIds.length
    ) {
      throw new HttpException('Invalid platform role or permission list', HttpStatus.BAD_REQUEST);
    }

    return await this.tenantDb.withPlatform(async (tx) => {
      if (['SUPER_ADMIN', 'PLATFORM_SUPER_ADMIN'].includes(roleKey)) {
        throw new HttpException('Super Admin permissions are protected', HttpStatus.FORBIDDEN);
      }
      const role = await tx.queryOne<{ id: string }>(
        'SELECT id FROM platform.platform_roles WHERE role_key = $1',
        [roleKey]
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
  @UseGuards(PlatformSuperAdminGuard)
  @ApiOperation({ summary: 'Create a new platform administrator' })
  async createPlatformUser(
    @Body() body: { email: string; password?: string; firstName?: string; lastName?: string; role: string },
    @CurrentUser() actor: AuthUser
  ) {
    if (!body.email || !body.role) {
      throw new HttpException('Email and role are required', HttpStatus.BAD_REQUEST);
    }
    const email = body.email.toLowerCase().trim();
    const isSuperAdmin = body.role === 'PLATFORM_SUPER_ADMIN' || body.role === 'SUPER_ADMIN';
    if (isSuperAdmin) {
      throw new HttpException(
        'Super Admin accounts cannot be created from the platform administrator form',
        HttpStatus.FORBIDDEN,
      );
    }

    return await this.tenantDb.withPlatform(async (tx) => {
      if (
        !isSuperAdmin &&
        !(await tx.queryOne('SELECT id FROM platform.platform_roles WHERE role_key = $1', [body.role]))
      ) {
        throw new HttpException('Unsupported platform role', HttpStatus.BAD_REQUEST);
      }

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
  @UseGuards(PlatformSuperAdminGuard)
  @ApiOperation({ summary: 'Update a platform administrator role or status' })
  async updatePlatformUser(
    @Param('id') id: string,
    @Body() body: { role?: string; status?: string },
    @CurrentUser() actor: AuthUser
  ) {
    return await this.tenantDb.withPlatform(async (tx) => {
      const pu = await tx.queryOne<{
        id: string;
        identity_id: string;
        is_super_admin: boolean;
        role: string;
      }>(
        'SELECT id, identity_id, is_super_admin, role FROM platform.platform_users WHERE id::text = $1',
        [id]
      );
      if (!pu) {
        throw new HttpException('Platform user not found', HttpStatus.NOT_FOUND);
      }

      const isSuperAdmin =
        pu.is_super_admin || ['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'].includes(pu.role);
      const actorIsSuperAdmin = actor.roles.includes('PLATFORM_SUPER_ADMIN') || actor.roles.includes('SUPER_ADMIN');
      if (isSuperAdmin && body.role && !['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'].includes(body.role)) {
        throw new HttpException('Super Admin access cannot be downgraded', HttpStatus.FORBIDDEN);
      }
      if (body.role && ['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'].includes(body.role) && !actorIsSuperAdmin) {
        throw new HttpException('Only a Super Admin can grant Super Admin access', HttpStatus.FORBIDDEN);
      }
      if (body.status && body.status !== 'ACTIVE' && isSuperAdmin) {
        throw new HttpException(
          'Super administrator accounts cannot be suspended',
          HttpStatus.BAD_REQUEST
        );
      }

      if (body.role) {
        const isSuperAdmin = body.role === 'PLATFORM_SUPER_ADMIN' || body.role === 'SUPER_ADMIN';
        if (
          !isSuperAdmin &&
          !(await tx.queryOne('SELECT id FROM platform.platform_roles WHERE role_key = $1', [body.role]))
        ) {
          throw new HttpException('Unsupported platform role', HttpStatus.BAD_REQUEST);
        }
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
  @UseGuards(PlatformSuperAdminGuard)
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
      const protectedUser = await tx.queryOne<{ is_super_admin: boolean; role: string }>(
        'SELECT is_super_admin, role FROM platform.platform_users WHERE id = $1', [id]
      );
      if (protectedUser?.is_super_admin || ['PLATFORM_SUPER_ADMIN', 'SUPER_ADMIN'].includes(protectedUser?.role || '')) {
        throw new HttpException('Super Admin accounts are protected', HttpStatus.FORBIDDEN);
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
