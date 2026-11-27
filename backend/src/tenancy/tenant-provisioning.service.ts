import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { BusinessType, IndustryType, AuthUser } from '@nirvagam/shared';
import { SaveBusinessProfileDto } from './dto/save-business-profile.dto';
import { TenantDatabaseService, quoteIdent, validateSchemaName } from './tenant-database.service';
import { getTenantSchemaMigrations } from './tenant-schema-migrations';
import { ProvisionTenantInput, TenantProvisionResult } from './tenancy.types';

const PERMISSION_RESOURCES = [
  'business', 'branch', 'user', 'role', 'customer', 'supplier', 'product', 'inventory',
  'sales_invoice', 'quotation', 'sales_order', 'credit_note', 'purchase_invoice',
  'purchase_order', 'debit_note', 'payment', 'expense', 'accounting', 'journal_entry',
  'financial_period', 'stock_adjustment', 'pos', 'gst_report', 'report',
  'settings', 'subscription',
];
const PERMISSION_ACTIONS = [
  'view', 'create', 'edit', 'delete', 'approve', 'cancel', 'export', 'print', 'access_reports',
];

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(private readonly tenantDb: TenantDatabaseService) {}

  async provision(input: ProvisionTenantInput): Promise<TenantProvisionResult> {
    const currentYear = new Date().getFullYear();
    const ownerName = `${input.ownerFirstName} ${input.ownerLastName}`.trim();
    return this.provisionBusiness({
      legalName: input.displayName,
      tradeName: input.displayName,
      businessType: BusinessType.PROPRIETORSHIP,
      industry: IndustryType.RETAIL,
      addressLine1: input.addressLine1,
      city: input.city,
      state: input.state,
      stateCode: input.stateCode,
      pincode: input.pincode,
      financialYearStart: `${currentYear}-04-01`,
      financialYearEnd: `${currentYear + 1}-03-31`,
      invoicePrefix: 'INV-',
      currency: 'INR',
      branches: [{
        code: 'HQ',
        name: 'Head Office',
        isHeadOffice: true,
        addressLine1: input.addressLine1,
        city: input.city,
        state: input.state,
        stateCode: input.stateCode,
        pincode: input.pincode,
      }],
      ownerName,
      username: input.ownerEmail,
      temporaryPassword: input.ownerPassword,
      requirePasswordChange: true,
      gstin: input.gstin,
      pan: input.pan,
    }, undefined, {
      slug: input.slug,
      planCode: input.planCode,
      region: input.region,
      metadata: input.metadata,
    });
  }

  async provisionBusiness(
    dto: SaveBusinessProfileDto,
    actor?: AuthUser,
    options: { slug?: string; planCode?: string; region?: string; metadata?: Record<string, unknown> } = {}
  ): Promise<TenantProvisionResult & { businessId: string; ownerEmail: string }> {
    if (!dto.ownerName?.trim() || !dto.username?.trim() || !dto.temporaryPassword) {
      throw new BadRequestException('Business owner name, username, and temporary password are required');
    }

    const requiredFields = [
      dto.legalName, dto.tradeName, dto.addressLine1, dto.city, dto.state,
      dto.stateCode, dto.pincode, dto.financialYearStart, dto.financialYearEnd,
    ];
    if (requiredFields.some((value) => typeof value !== 'string' || !value.trim())) {
      throw new BadRequestException('Business identity and address details are required');
    }
    if (new Date(dto.financialYearEnd) <= new Date(dto.financialYearStart)) {
      throw new BadRequestException('Financial year end must be after its start date');
    }

    const normalizedEmail = dto.username.trim().toLowerCase();
    const ownerNameParts = dto.ownerName.trim().split(/\s+/);
    const firstName = ownerNameParts.shift()!;
    const lastName = ownerNameParts.join(' ');
    const passwordHash = await bcrypt.hash(dto.temporaryPassword, 12);
    const baseSlug = (options.slug || dto.tradeName)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 52);
    if (baseSlug.length < 3) {
      throw new BadRequestException('Business name cannot be used to create a tenant workspace slug');
    }
    const slug = options.slug ? baseSlug : `${baseSlug}-${randomBytes(3).toString('hex')}`;
    const schemaName = `t_${randomBytes(6).toString('hex')}`;
    validateSchemaName(schemaName);

    const tenantId = randomUUID();
    const branches = this.normalizeBranches(dto);
    const migrations = getTenantSchemaMigrations();
    const pool = this.tenantDb.getPool();
    const client = await pool.connect();
    let transactionStarted = false;
    let businessId = '';
    let defaultBranchId = '';
    let ownerUserId = '';
    let permissionCount = 0;

    try {
      await client.query('BEGIN;');
      transactionStarted = true;
      await client.query(`CREATE SCHEMA ${quoteIdent(schemaName)};`);
      await client.query(`SET LOCAL search_path TO ${quoteIdent(schemaName)};`);

      for (const migration of migrations) {
        await client.query(migration.sql);
      }

      await client.query(`
        CREATE TABLE tenant_prisma_migrations (
          name TEXT PRIMARY KEY,
          checksum CHAR(64) NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      for (const migration of migrations) {
        await client.query(
          `INSERT INTO tenant_prisma_migrations (name, checksum) VALUES ($1, $2);`,
          [migration.name, migration.checksum]
        );
      }

      const selectedPlan = await this.findPlan(client, dto.planId, options.planCode);
      await client.query(
        `INSERT INTO platform.tenants (
          id, slug, display_name, schema_name, status, plan_id, region, schema_version, metadata
        ) VALUES ($1::uuid, $2, $3, $4, 'active', $5::uuid, $6, $7, $8::jsonb);`,
        [
          tenantId,
          slug,
          dto.tradeName.trim(),
          schemaName,
          selectedPlan?.id || null,
          options.region || 'ap-south-1',
          migrations.length,
          JSON.stringify({
            source: 'platform_business_registration',
            ...options.metadata,
            requires_reprovisioning: false,
          }),
        ]
      );

      await client.query(
        `INSERT INTO tenants (id, slug, name, status, created_at, updated_at)
         VALUES ($1::uuid, $2, $3, 'ACTIVE', NOW(), NOW());`,
        [tenantId, slug, dto.tradeName.trim()]
      );

      const business = await client.query<{ id: string }>(
        `INSERT INTO businesses (
          tenant_id, legal_name, trade_name, business_type, industry, pan, logo_url,
          signature_url, currency, address_line1, address_line2, city, district, state,
          state_code, jurisdiction, pincode, enabled_modules, tax_settings, is_active,
          created_at, updated_at
        ) VALUES (
          $1::uuid, $2, $3, $4::"BusinessType", $5::"IndustryType", $6, $7, $8, $9,
          $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, TRUE, NOW(), NOW()
        ) RETURNING id;`,
        [
          tenantId,
          dto.legalName.trim(),
          dto.tradeName.trim(),
          dto.businessType,
          dto.industry,
          dto.pan?.trim().toUpperCase() || null,
          dto.logoUrl || null,
          dto.digitalSignatureUrl || null,
          dto.currency?.trim().toUpperCase() || 'INR',
          dto.addressLine1.trim(),
          dto.addressLine2?.trim() || null,
          dto.city.trim(),
          dto.district?.trim() || null,
          dto.state.trim(),
          dto.stateCode.trim(),
          dto.jurisdiction?.trim() || null,
          dto.pincode.trim(),
          JSON.stringify(dto.enabledModules || []),
          JSON.stringify(dto.taxSettings || {}),
        ]
      );
      businessId = business.rows[0].id;

      await client.query(
        `INSERT INTO chart_of_accounts (
          business_id, code, name, "group", sub_group, description, is_system, is_active, created_at, updated_at
        ) VALUES
          ($1::uuid, '1030', 'Accounts Receivable', 'ASSET'::"AccountGroup", 'AR',
           'System receivable account for customer invoices', TRUE, TRUE, NOW(), NOW()),
          ($1::uuid, '4010', 'Sales Revenue', 'INCOME'::"AccountGroup", 'Revenue',
           'System revenue account for sales documents', TRUE, TRUE, NOW(), NOW())
        ON CONFLICT (business_id, code) DO NOTHING;`,
        [businessId]
      );

      if (dto.gstin?.trim()) {
        await client.query(
          `INSERT INTO gst_registrations (
            business_id, gstin, legal_name, state, state_code, is_default, created_at, updated_at
          ) VALUES ($1::uuid, $2, $3, $4, $5, TRUE, NOW(), NOW());`,
          [
            businessId,
            dto.gstin.trim().toUpperCase(),
            dto.legalName.trim(),
            dto.state.trim(),
            dto.stateCode.trim(),
          ]
        );
      }

      for (const branch of branches) {
        const insertedBranch = await client.query<{ id: string }>(
          `INSERT INTO branches (
            business_id, name, code, is_head_office, gstin, address_line1, address_line2,
            city, district, state, state_code, pincode, created_at, updated_at
          ) VALUES (
            $1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW()
          ) RETURNING id;`,
          [
            businessId,
            branch.name.trim(),
            branch.code.trim().toUpperCase(),
            branch.isHeadOffice,
            branch.gstin?.trim().toUpperCase() || null,
            branch.addressLine1.trim(),
            branch.addressLine2?.trim() || null,
            branch.city.trim(),
            branch.district?.trim() || null,
            branch.state.trim(),
            branch.stateCode.trim(),
            branch.pincode.trim(),
          ]
        );
        if (!defaultBranchId || branch.isHeadOffice) {
          defaultBranchId = insertedBranch.rows[0].id;
        }

        await client.query(
          `INSERT INTO document_sequences (
            business_id, branch_id, document_type, prefix, next_number, padding, created_at, updated_at
          ) VALUES ($1::uuid, $2::uuid, 'TAX_INVOICE', $3, 1001, 4, NOW(), NOW());`,
          [businessId, insertedBranch.rows[0].id, dto.invoicePrefix.trim() || 'INV-']
        );
      }

      await client.query(
        `INSERT INTO fiscal_periods (
          business_id, name, start_date, end_date, is_active, created_at, updated_at
        ) VALUES ($1::uuid, $2, $3::date, $4::date, TRUE, NOW(), NOW());`,
        [
          businessId,
          `FY ${dto.financialYearStart.slice(0, 4)}-${dto.financialYearEnd.slice(0, 4)}`,
          dto.financialYearStart,
          dto.financialYearEnd,
        ]
      );

      const owner = await client.query<{ id: string }>(
        `INSERT INTO users (
          tenant_id, email, password_hash, must_change_password, first_name, last_name,
          is_active, member_type, status, created_at, updated_at
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, TRUE, 'BUSINESS_OWNER', 'ACTIVE', NOW(), NOW())
        RETURNING id;`,
        [
          tenantId,
          normalizedEmail,
          passwordHash,
          dto.requirePasswordChange ?? true,
          firstName,
          lastName,
        ]
      );
      ownerUserId = owner.rows[0].id;

      await client.query(
        `UPDATE branches SET owner_id = $1::uuid WHERE id = $2::uuid;`,
        [ownerUserId, defaultBranchId]
      );
      await client.query(
        `INSERT INTO user_branch_assignments (user_id, branch_id, is_default)
         VALUES ($1::uuid, $2::uuid, TRUE);`,
        [ownerUserId, defaultBranchId]
      );

      const role = await client.query<{ id: string }>(
        `INSERT INTO roles (business_id, name, description, is_system, created_at, updated_at)
         VALUES (NULL, 'BUSINESS_OWNER', 'Tenant business owner', TRUE, NOW(), NOW())
         RETURNING id;`
      );
      const roleId = role.rows[0].id;

      const permissions = await client.query<{ id: string }>(
        `INSERT INTO permissions (resource, action, description)
         SELECT resource, action, 'Permission to ' || action || ' ' || resource
         FROM unnest($1::text[]) AS resources(resource)
         CROSS JOIN unnest($2::text[]) AS actions(action)
         ON CONFLICT (resource, action) DO UPDATE
           SET description = EXCLUDED.description
         RETURNING id;`,
        [PERMISSION_RESOURCES, PERMISSION_ACTIONS]
      );
      permissionCount = permissions.rowCount || 0;
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         SELECT $1::uuid, id FROM permissions
         ON CONFLICT (role_id, permission_id) DO NOTHING;`,
        [roleId]
      );
      await client.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1::uuid, $2::uuid);`,
        [ownerUserId, roleId]
      );

      if (selectedPlan) {
        await client.query(
          `INSERT INTO platform.subscriptions (tenant_id, plan_id, status)
           VALUES ($1::uuid, $2::uuid, 'ACTIVE');`,
          [tenantId, selectedPlan.id]
        );
      }

      await client.query(
        `INSERT INTO platform.platform_audit_log (
          actor_id, action, target_type, target_id, metadata
        ) VALUES ($1::uuid, 'TENANT_PROVISIONED', 'TENANT', $2, $3::jsonb);`,
        [
          actor?.id || null,
          tenantId,
          JSON.stringify({ slug, schemaName, businessId }),
        ]
      );

      await client.query('COMMIT;');
      transactionStarted = false;
    } catch (error: any) {
      if (transactionStarted) {
        await client.query('ROLLBACK;');
      }
      if (error?.code === '23505') {
        throw new ConflictException('A tenant with this workspace slug or owner username already exists');
      }
      this.logger.error(`Tenant provisioning failed for [${slug}]: ${error.message}`, error.stack);
      throw error;
    } finally {
      client.release();
    }

    return {
      tenantId,
      slug,
      schemaName,
      status: 'active',
      ownerIdentityId: ownerUserId,
      defaultBranchId,
      rolesSeeded: 1,
      permissionsSeeded: permissionCount,
      coaAccountsSeeded: 0,
      businessId,
      ownerEmail: normalizedEmail,
    };
  }

  private normalizeBranches(dto: SaveBusinessProfileDto) {
    const branches = dto.branches || [];
    if (branches.filter((branch) => branch.isHeadOffice).length > 1) {
      throw new BadRequestException('A business can have only one head-office branch');
    }
    if (branches.length) {
      const headOfficeIndex = branches.findIndex((branch) => branch.isHeadOffice);
      return branches.map((branch, index) => ({
        ...branch,
        isHeadOffice: index === headOfficeIndex,
      }));
    }
    return [{
      code: 'HQ',
      name: 'Head Office',
      isHeadOffice: true,
      addressLine1: dto.addressLine1,
      addressLine2: dto.addressLine2,
      city: dto.city,
      state: dto.state,
      stateCode: dto.stateCode,
      pincode: dto.pincode,
      gstin: dto.gstin,
    }];
  }

  private async findPlan(client: import('pg').PoolClient, planId?: string | null, planCode?: string) {
    if (planId) {
      const result = await client.query<{ id: string }>(
        `SELECT id FROM platform.plans WHERE id = $1::uuid AND is_active = TRUE LIMIT 1;`,
        [planId]
      );
      if (!result.rows[0]) {
        throw new BadRequestException('Selected subscription plan does not exist or is inactive');
      }
      return result.rows[0];
    }
    if (!planCode) {
      return null;
    }
    const result = await client.query<{ id: string }>(
      `SELECT id FROM platform.plans WHERE code = $1 AND is_active = TRUE LIMIT 1;`,
      [planCode]
    );
    if (!result.rows[0]) {
      throw new BadRequestException('Selected subscription plan does not exist or is inactive');
    }
    return result.rows[0];
  }
}
