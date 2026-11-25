import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuthUser } from '@nirvagam/shared';
import { TenantDatabaseService, quoteIdent, validateSchemaName } from './tenant-database.service';
import { TenantCacheService } from './tenant-cache.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { SaveBusinessProfileDto, SUPPORTED_BUSINESS_MODULES } from './dto/save-business-profile.dto';
import { TenantContext } from './tenancy.types';

const DEFAULT_MODULES: Record<string, string[]> = {
  RETAIL: ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
  SUPERMARKET: ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
  GROCERY: ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
  RESTAURANT: ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
  WHOLESALE: ['sales', 'purchases', 'inventory', 'accounting', 'gst', 'reports', 'crm'],
  DISTRIBUTOR: ['sales', 'purchases', 'inventory', 'accounting', 'gst', 'reports', 'crm'],
  MANUFACTURING: ['sales', 'purchases', 'inventory', 'accounting', 'gst', 'reports'],
  TEXTILE: ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
  ELECTRICAL: ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
  HARDWARE: ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
  MEDICAL: ['sales', 'purchases', 'inventory', 'accounting', 'pos', 'gst', 'reports'],
  SERVICE: ['sales', 'accounting', 'gst', 'reports', 'crm'],
  TRADING: ['sales', 'purchases', 'inventory', 'accounting', 'gst', 'reports'],
  OTHER: ['sales', 'purchases', 'accounting', 'reports'],
};

@Injectable()
export class PlatformBusinessRegistrationService {
  constructor(
    private readonly tenantDb: TenantDatabaseService,
    private readonly cache: TenantCacheService,
    private readonly provisioning: TenantProvisioningService
  ) {}

  async getWorkspace() {
    const tenants = await this.tenantDb.withPlatform((tx) =>
      tx.query(
        `SELECT id, slug, display_name AS "displayName", status, plan_id AS "planId"
         FROM platform.tenants
         ORDER BY created_at DESC;`
      )
    );
    const plans = await this.tenantDb.withPlatform((tx) =>
      tx.query(
        `SELECT id, code, name, price_monthly AS "priceMonthly", currency
         FROM platform.plans
         WHERE is_active = TRUE
         ORDER BY price_monthly, name;`
      )
    );

    return {
      tenants,
      plans,
      supportedModules: SUPPORTED_BUSINESS_MODULES,
      moduleDefaults: DEFAULT_MODULES,
    };
  }

  async create(dto: SaveBusinessProfileDto, actor?: AuthUser) {
    this.validateImage(dto.logoUrl, 'Logo');
    this.validateImage(dto.digitalSignatureUrl, 'Digital signature');
    this.validateFinancialYear(dto);
    this.validateHeadOfficeCount(dto.branches);
    if (!dto.ownerName?.trim() || !dto.username?.trim() || !dto.temporaryPassword) {
      throw new BadRequestException(
        'Business owner name, username, and temporary password are required for new tenant registration'
      );
    }

    const result = await this.provisioning.provisionBusiness(dto, actor);
    return {
      id: result.businessId,
      businessId: result.businessId,
      tenantId: result.tenantId,
      tenantSlug: result.slug,
      ownerEmail: result.ownerEmail,
    };
  }

  async update(_profileId: string, _dto: SaveBusinessProfileDto, _actor?: AuthUser) {
    throw new BadRequestException(
      'Platform administrators cannot view or edit tenant business data after registration'
    );
  }

  async delete(_profileId: string, _actor?: AuthUser) {
    throw new BadRequestException('Delete a tenant by its workspace ID instead of a business profile ID');
  }

  async getTenantBusinessProfile(tenantId: string) {
    const context = await this.getTenantContext(tenantId);
    return this.tenantDb.withTenant(context, async (tx) => {
      const business = await tx.queryOne<{
        id: string;
        legalName: string;
        tradeName: string;
        businessType: string;
        industry: string;
        pan: string | null;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        district: string | null;
        state: string;
        stateCode: string;
        jurisdiction: string | null;
        pincode: string;
        currency: string;
        enabledModules: string[] | null;
        taxSettings: Record<string, unknown> | null;
        logoUrl: string | null;
        digitalSignatureUrl: string | null;
      }>(
        `SELECT id, legal_name AS "legalName", trade_name AS "tradeName",
                business_type AS "businessType", industry, pan,
                address_line1 AS "addressLine1", address_line2 AS "addressLine2",
                city, district, state, state_code AS "stateCode", jurisdiction, pincode,
                currency, enabled_modules AS "enabledModules", tax_settings AS "taxSettings",
                logo_url AS "logoUrl", signature_url AS "digitalSignatureUrl"
         FROM businesses
         WHERE tenant_id = $1 AND is_active = TRUE
         ORDER BY created_at ASC
         LIMIT 1;`,
        [tenantId]
      );
      if (!business) {
        throw new NotFoundException('Business registration was not found in this tenant');
      }

      const branches = await tx.query<{
        id: string;
        code: string;
        name: string;
        isHeadOffice: boolean;
        gstin: string | null;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        district: string | null;
        state: string;
        stateCode: string;
        pincode: string;
      }>(
        `SELECT id, code, name, is_head_office AS "isHeadOffice", gstin,
                address_line1 AS "addressLine1", address_line2 AS "addressLine2",
                city, district, state, state_code AS "stateCode", pincode
         FROM branches
         WHERE business_id = $1 AND is_active = TRUE
         ORDER BY is_head_office DESC, name ASC;`,
        [business.id]
      );
      const gstRegistration = await tx.queryOne<{ gstin: string }>(
        `SELECT gstin FROM gst_registrations
         WHERE business_id = $1
         ORDER BY is_default DESC, created_at ASC
         LIMIT 1;`,
        [business.id]
      );
      const fiscalPeriod = await tx.queryOne<{ startDate: string; endDate: string }>(
        `SELECT start_date::date::text AS "startDate", end_date::date::text AS "endDate"
         FROM fiscal_periods
         WHERE business_id = $1 AND is_active = TRUE
         ORDER BY start_date DESC
         LIMIT 1;`,
        [business.id]
      );
      const owner = await tx.queryOne<{
        firstName: string;
        lastName: string;
        email: string;
        mustChangePassword: boolean;
      }>(
        `SELECT u.first_name AS "firstName", u.last_name AS "lastName",
                u.email, u.must_change_password AS "mustChangePassword"
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.tenant_id = $1 AND u.is_active = TRUE AND r.name = 'BUSINESS_OWNER'
         ORDER BY u.created_at ASC
         LIMIT 1;`,
        [tenantId]
      );
      if (!owner) {
        throw new NotFoundException('Business owner account was not found in this tenant');
      }
      const primaryBranch = branches.find((branch) => branch.isHeadOffice) || branches[0];
      const documentSequence = primaryBranch
        ? await tx.queryOne<{ prefix: string }>(
            `SELECT prefix FROM document_sequences
             WHERE business_id = $1 AND branch_id = $2 AND document_type = 'TAX_INVOICE'
             LIMIT 1;`,
            [business.id, primaryBranch.id]
          )
        : null;
      const financialYear = this.currentFinancialYear();

      return {
        tenantId,
        ...business,
        gstin: gstRegistration?.gstin || '',
        financialYearStart: fiscalPeriod?.startDate || financialYear.start,
        financialYearEnd: fiscalPeriod?.endDate || financialYear.end,
        invoicePrefix: documentSequence?.prefix || 'INV-',
        enabledModules: business.enabledModules || [],
        taxSettings: business.taxSettings || {},
        branches: branches.map((branch) => ({ ...branch, district: branch.district || '' })),
        ownerName: `${owner.firstName} ${owner.lastName}`.trim(),
        username: owner.email,
        temporaryPassword: '',
        requirePasswordChange: owner.mustChangePassword,
      };
    });
  }

  async updateTenantBusinessProfile(tenantId: string, dto: SaveBusinessProfileDto, actor?: AuthUser) {
    this.validateImage(dto.logoUrl, 'Logo');
    this.validateImage(dto.digitalSignatureUrl, 'Digital signature');
    this.validateFinancialYear(dto);
    this.validateHeadOfficeCount(dto.branches);
    if (!dto.ownerName?.trim() || !dto.username?.trim()) {
      throw new BadRequestException('Business owner name and username are required');
    }

    const context = await this.getTenantContext(tenantId);
    const normalizedEmail = dto.username.trim().toLowerCase();
    const ownerNameParts = dto.ownerName.trim().split(/\s+/);
    const firstName = ownerNameParts.shift()!;
    const lastName = ownerNameParts.join(' ');
    const branches = dto.branches || [];
    if (!branches.length) {
      throw new BadRequestException('A business must retain at least one branch');
    }
    if (new Set(branches.map((branch) => branch.code.trim().toUpperCase())).size !== branches.length) {
      throw new BadRequestException('Branch codes must be unique within the business');
    }

    await this.tenantDb.withTenant(context, async (tx) => {
      const business = await tx.queryOne<{ id: string }>(
        `SELECT id FROM businesses
         WHERE tenant_id = $1 AND is_active = TRUE
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE;`,
        [tenantId]
      );
      if (!business) {
        throw new NotFoundException('Business registration was not found in this tenant');
      }

      const owner = await tx.queryOne<{ id: string; email: string }>(
        `SELECT u.id, u.email
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE u.tenant_id = $1 AND u.is_active = TRUE AND r.name = 'BUSINESS_OWNER'
         ORDER BY u.created_at ASC
         LIMIT 1
         FOR UPDATE OF u;`,
        [tenantId]
      );
      if (!owner) {
        throw new NotFoundException('Business owner account was not found in this tenant');
      }
      const duplicateOwner = await tx.queryOne<{ id: string }>(
        `SELECT id FROM users
         WHERE tenant_id = $1 AND lower(email) = $2 AND id <> $3
         LIMIT 1;`,
        [tenantId, normalizedEmail, owner.id]
      );
      if (duplicateOwner) {
        throw new ConflictException('That email address is already used by another user in this workspace');
      }

      const fiscalPeriod = await tx.queryOne<{ id: string; isLocked: boolean }>(
        `SELECT id, is_locked AS "isLocked"
         FROM fiscal_periods
         WHERE business_id = $1 AND is_active = TRUE
         ORDER BY start_date DESC
         LIMIT 1
         FOR UPDATE;`,
        [business.id]
      );
      if (fiscalPeriod?.isLocked) {
        const existingDates = await tx.queryOne<{ matches: boolean }>(
          `SELECT start_date::date = $2::date AND end_date::date = $3::date AS matches
           FROM fiscal_periods WHERE id = $1;`,
          [fiscalPeriod.id, dto.financialYearStart, dto.financialYearEnd]
        );
        if (!existingDates?.matches) {
          throw new BadRequestException('The active financial year is locked and cannot be changed');
        }
      }
      const periodName = `FY ${dto.financialYearStart.slice(0, 4)}-${dto.financialYearEnd.slice(0, 4)}`;
      const duplicatePeriod = await tx.queryOne<{ id: string }>(
        `SELECT id FROM fiscal_periods
         WHERE business_id = $1 AND name = $2 AND ($3::uuid IS NULL OR id <> $3::uuid)
         LIMIT 1;`,
        [business.id, periodName, fiscalPeriod?.id || null]
      );
      if (duplicatePeriod) {
        throw new BadRequestException('A financial period with those dates already exists');
      }

      await tx.execute(
        `UPDATE businesses SET
           legal_name = $2, trade_name = $3, business_type = $4::"BusinessType",
           industry = $5::"IndustryType", pan = $6, address_line1 = $7, address_line2 = $8,
           city = $9, district = $10, state = $11, state_code = $12, jurisdiction = $13,
           pincode = $14, currency = $15, enabled_modules = $16::jsonb,
           tax_settings = $17::jsonb, logo_url = $18, signature_url = $19, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $20;`,
        [
          business.id,
          dto.legalName.trim(),
          dto.tradeName.trim(),
          dto.businessType,
          dto.industry,
          dto.pan?.trim().toUpperCase() || null,
          dto.addressLine1.trim(),
          dto.addressLine2?.trim() || null,
          dto.city.trim(),
          dto.district?.trim() || null,
          dto.state.trim(),
          dto.stateCode.trim(),
          dto.jurisdiction?.trim() || null,
          dto.pincode.trim(),
          dto.currency?.trim().toUpperCase() || 'INR',
          JSON.stringify(dto.enabledModules || []),
          JSON.stringify(dto.taxSettings || {}),
          dto.logoUrl || null,
          dto.digitalSignatureUrl || null,
          tenantId,
        ]
      );

      const gstRegistration = await tx.queryOne<{ id: string }>(
        `SELECT id FROM gst_registrations
         WHERE business_id = $1
         ORDER BY is_default DESC, created_at ASC
         LIMIT 1
         FOR UPDATE;`,
        [business.id]
      );
      if (dto.gstin?.trim()) {
        if (gstRegistration) {
          await tx.execute(
            `UPDATE gst_registrations SET gstin = $2, legal_name = $3, state = $4,
               state_code = $5, is_default = TRUE, updated_at = NOW()
             WHERE id = $1;`,
            [
              gstRegistration.id,
              dto.gstin.trim().toUpperCase(),
              dto.legalName.trim(),
              dto.state.trim(),
              dto.stateCode.trim(),
            ]
          );
        } else {
          await tx.execute(
            `INSERT INTO gst_registrations (
               business_id, gstin, legal_name, state, state_code, is_default, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW());`,
            [
              business.id,
              dto.gstin.trim().toUpperCase(),
              dto.legalName.trim(),
              dto.state.trim(),
              dto.stateCode.trim(),
            ]
          );
        }
      } else if (gstRegistration) {
        await tx.execute('DELETE FROM gst_registrations WHERE id = $1;', [gstRegistration.id]);
      }

      const existingBranches = await tx.query<{ id: string; code: string; isActive: boolean }>(
        `SELECT id, code, is_active AS "isActive" FROM branches WHERE business_id = $1;`,
        [business.id]
      );
      await tx.execute(
        'UPDATE branches SET is_head_office = FALSE WHERE business_id = $1 AND is_head_office = TRUE;',
        [business.id]
      );
      const retainedBranchIds = new Set<string>();
      const activeBranchIds: string[] = [];
      for (const branch of branches) {
        const matchingBranch = branch.id
          ? existingBranches.find((existing) => existing.id === branch.id)
          : existingBranches.find((existing) => existing.code.toUpperCase() === branch.code.trim().toUpperCase());
        if (branch.id && !matchingBranch) {
          throw new BadRequestException('A selected branch does not belong to this business');
        }

        let branchId: string;
        if (matchingBranch) {
          branchId = matchingBranch.id;
          await tx.execute(
            `UPDATE branches SET
               name = $2, code = $3, is_head_office = $4, gstin = $5,
               address_line1 = $6, address_line2 = $7, city = $8, district = $9,
               state = $10, state_code = $11, pincode = $12, is_active = TRUE, updated_at = NOW()
             WHERE id = $1 AND business_id = $13;`,
            [
              branchId,
              branch.name.trim(),
              branch.code.trim().toUpperCase(),
              branch.isHeadOffice ?? false,
              branch.gstin?.trim().toUpperCase() || null,
              branch.addressLine1.trim(),
              branch.addressLine2?.trim() || null,
              branch.city.trim(),
              branch.district?.trim() || null,
              branch.state.trim(),
              branch.stateCode.trim(),
              branch.pincode.trim(),
              business.id,
            ]
          );
        } else {
          const insertedBranch = await tx.queryOne<{ id: string }>(
            `INSERT INTO branches (
               business_id, name, code, is_head_office, gstin, address_line1,
               address_line2, city, district, state, state_code, pincode, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
             RETURNING id;`,
            [
              business.id,
              branch.name.trim(),
              branch.code.trim().toUpperCase(),
              branch.isHeadOffice ?? false,
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
          branchId = insertedBranch!.id;
        }
        retainedBranchIds.add(branchId);
        activeBranchIds.push(branchId);

        const sequenceUpdated = await tx.execute(
          `UPDATE document_sequences SET prefix = $3, updated_at = NOW()
           WHERE business_id = $1 AND branch_id = $2 AND document_type = 'TAX_INVOICE';`,
          [business.id, branchId, dto.invoicePrefix.trim() || 'INV-']
        );
        if (!sequenceUpdated) {
          await tx.execute(
            `INSERT INTO document_sequences (
               business_id, branch_id, document_type, prefix, next_number, padding, created_at, updated_at
             ) VALUES ($1, $2, 'TAX_INVOICE', $3, 1001, 4, NOW(), NOW());`,
            [business.id, branchId, dto.invoicePrefix.trim() || 'INV-']
          );
        }
      }

      const removedBranchIds = existingBranches
        .filter((branch) => branch.isActive && !retainedBranchIds.has(branch.id))
        .map((branch) => branch.id);
      if (removedBranchIds.length) {
        await tx.execute(
          `UPDATE branches SET is_active = FALSE, updated_at = NOW()
           WHERE id = ANY($1::uuid[]) AND business_id = $2;`,
          [removedBranchIds, business.id]
        );
      }

      const primaryBranchId =
        branches.find((branch) => branch.isHeadOffice)
          ? activeBranchIds[branches.findIndex((branch) => branch.isHeadOffice)]
          : activeBranchIds[0];
      await tx.execute('UPDATE branches SET owner_id = NULL WHERE owner_id = $1;', [owner.id]);
      await tx.execute('UPDATE branches SET owner_id = $1 WHERE id = $2;', [owner.id, primaryBranchId]);
      await tx.execute(
        'UPDATE user_branch_assignments SET is_default = FALSE WHERE user_id = $1;',
        [owner.id]
      );
      await tx.execute(
        `INSERT INTO user_branch_assignments (user_id, branch_id, is_default)
         VALUES ($1, $2, TRUE)
         ON CONFLICT (user_id, branch_id) DO UPDATE SET is_default = TRUE;`,
        [owner.id, primaryBranchId]
      );

      if (fiscalPeriod) {
        await tx.execute(
          `UPDATE fiscal_periods SET name = $2, start_date = $3::date, end_date = $4::date,
             updated_at = NOW()
           WHERE id = $1;`,
          [fiscalPeriod.id, periodName, dto.financialYearStart, dto.financialYearEnd]
        );
      } else {
        await tx.execute(
          `INSERT INTO fiscal_periods (
             business_id, name, start_date, end_date, is_active, created_at, updated_at
           ) VALUES ($1, $2, $3::date, $4::date, TRUE, NOW(), NOW());`,
          [business.id, periodName, dto.financialYearStart, dto.financialYearEnd]
        );
      }

      await tx.execute(
        `UPDATE users SET email = $2, first_name = $3, last_name = $4,
           must_change_password = COALESCE($5, must_change_password), updated_at = NOW()
         WHERE id = $1 AND tenant_id = $6;`,
        [
          owner.id,
          normalizedEmail,
          firstName,
          lastName,
          dto.requirePasswordChange ?? null,
          tenantId,
        ]
      );
      await tx.execute(
        `UPDATE platform.tenants SET display_name = $2, updated_at = NOW() WHERE id = $1;`,
        [tenantId, dto.tradeName.trim()]
      );
      await tx.execute(
        `INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, 'TENANT_BUSINESS_REGISTRATION_UPDATED', 'TENANT', $2, $3);`,
        [
          actor?.id || null,
          tenantId,
          JSON.stringify({ businessId: business.id, branchCount: activeBranchIds.length }),
        ]
      );
    });

    await this.cache.invalidateTenant(tenantId, context.slug);
    return { success: true };
  }

  async deleteTenant(tenantId: string, actor?: AuthUser, profileId?: string) {
    const tenant = await this.tenantDb.withPlatform(async (tx) => {
      const existing = await tx.queryOne<{
        id: string;
        schemaName: string;
        slug: string;
      }>(
        `SELECT id, schema_name AS "schemaName", slug
         FROM platform.tenants
         WHERE id::text = $1
         FOR UPDATE;`,
        [tenantId]
      );
      if (!existing) {
        throw new NotFoundException('Tenant not found');
      }
      validateSchemaName(existing.schemaName);
      await tx.execute(
        `UPDATE platform.tenants SET status = 'deleting', updated_at = NOW() WHERE id = $1;`,
        [existing.id]
      );
      await tx.execute(
        `INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, 'TENANT_DELETION_STARTED', 'TENANT', $2, $3);`,
        [actor?.id || null, existing.id, JSON.stringify({ profileId: profileId || null })]
      );
      return existing;
    });

    await this.cache.invalidateTenant(tenant.id, tenant.slug);
    await this.tenantDb.withPlatform(async (tx) => {
      await tx.execute(`DROP SCHEMA IF EXISTS ${quoteIdent(tenant.schemaName)} CASCADE;`);
      await tx.execute('DELETE FROM platform.tenants WHERE id = $1;', [tenant.id]);
      await tx.execute(
        `INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
         VALUES ($1, 'TENANT_DELETED', 'TENANT', $2, $3);`,
        [actor?.id || null, tenant.id, JSON.stringify({ profileId: profileId || null })]
      );
    });
    await this.cache.invalidateTenant(tenant.id, tenant.slug);
    return { success: true };
  }

  private async getTenantContext(tenantId: string): Promise<TenantContext> {
    const tenant = await this.tenantDb.withPlatform((tx) =>
      tx.queryOne<{
        id: string;
        slug: string;
        displayName: string;
        schemaName: string;
        status: string;
      }>(
        `SELECT id, slug, display_name AS "displayName",
                schema_name AS "schemaName", status
         FROM platform.tenants
         WHERE id::text = $1 AND status IN ('active', 'suspended')
         LIMIT 1;`,
        [tenantId]
      )
    );
    if (!tenant) {
      throw new NotFoundException('Active or suspended tenant not found');
    }
    validateSchemaName(tenant.schemaName);

    return {
      tenantId: tenant.id,
      schemaName: tenant.schemaName,
      slug: tenant.slug,
      displayName: tenant.displayName,
      status: tenant.status === 'suspended' ? 'suspended' : 'active',
      roleKeys: [],
      branchIds: [],
      planLimits: {
        maxBranches: 1,
        maxUsers: 5,
        maxInvoicesPerMonth: 500,
        featureFlags: {},
      },
    };
  }

  private currentFinancialYear() {
    const now = new Date();
    const startYear = now.getUTCMonth() >= 3 ? now.getUTCFullYear() : now.getUTCFullYear() - 1;
    return {
      start: `${startYear}-04-01`,
      end: `${startYear + 1}-03-31`,
    };
  }

  private validateImage(value: string | null | undefined, label: string) {
    if (!value) {
      return;
    }
    const isDataImage = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
    const isHttpsUrl = /^https:\/\/[^\s]+$/i.test(value);
    if (!isDataImage && !isHttpsUrl) {
      throw new BadRequestException(`${label} must be a PNG, JPEG, or WebP upload, or an HTTPS URL`);
    }
  }

  private validateFinancialYear(dto: SaveBusinessProfileDto) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dto.financialYearStart) || !datePattern.test(dto.financialYearEnd)) {
      throw new BadRequestException('Financial year dates must use the YYYY-MM-DD format');
    }
    if (new Date(dto.financialYearEnd) <= new Date(dto.financialYearStart)) {
      throw new BadRequestException('Financial year end must be after its start date');
    }
  }

  private validateHeadOfficeCount(branches: SaveBusinessProfileDto['branches'] = []) {
    if ((branches || []).filter((branch) => branch.isHeadOffice).length > 1) {
      throw new BadRequestException('A business can have only one head-office branch');
    }
  }
}
