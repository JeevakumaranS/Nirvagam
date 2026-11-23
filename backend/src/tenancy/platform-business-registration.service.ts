import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TenantDatabaseService, TenantTx } from './tenant-database.service';
import { SaveBusinessProfileDto, SUPPORTED_BUSINESS_MODULES } from './dto/save-business-profile.dto';

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
  constructor(private readonly tenantDb: TenantDatabaseService) {}

  async getWorkspace() {
    return this.tenantDb.withPlatform(async (tx) => {
      const tenants = await tx.query(
        `SELECT t.id, t.slug, t.display_name AS "displayName", t.status,
                t.plan_id AS "planId", p.name AS "planName"
         FROM platform.tenants t
         LEFT JOIN platform.plans p ON p.id = t.plan_id
         ORDER BY t.created_at DESC;`
      );
      const profiles = await tx.query<any>(
        `SELECT bp.id, bp.tenant_id AS "tenantId", t.display_name AS "tenantName",
                t.slug AS "tenantSlug", bp.legal_name AS "legalName",
                bp.trade_name AS "tradeName", bp.business_type AS "businessType",
                bp.industry, bp.gstin, bp.pan, bp.address_line1 AS "addressLine1",
                bp.address_line2 AS "addressLine2", bp.city, bp.state,
                bp.state_code AS "stateCode", bp.jurisdiction, bp.pincode,
                bp.financial_year_start AS "financialYearStart",
                bp.financial_year_end AS "financialYearEnd",
                bp.invoice_prefix AS "invoicePrefix", bp.currency,
                bp.tax_settings AS "taxSettings", bp.logo_url AS "logoUrl",
                bp.digital_signature_url AS "digitalSignatureUrl",
                bp.enabled_modules AS "enabledModules", bp.created_at AS "createdAt"
         FROM platform.business_profiles bp
         JOIN platform.tenants t ON t.id = bp.tenant_id
         ORDER BY bp.created_at DESC;`
      );

      const branches = profiles.length
        ? await tx.query<any>(
            `SELECT id, profile_id AS "profileId", code, name,
                    is_head_office AS "isHeadOffice", gstin,
                    address_line1 AS "addressLine1", address_line2 AS "addressLine2",
                    city, state, state_code AS "stateCode", pincode
             FROM platform.business_branches
             WHERE profile_id = ANY($1::uuid[])
             ORDER BY is_head_office DESC, name;`,
            [profiles.map((profile) => profile.id)]
          )
        : [];
      const plans = await tx.query(
        `SELECT id, code, name, price_monthly AS "priceMonthly", currency
         FROM platform.plans
         WHERE is_active = TRUE
         ORDER BY price_monthly, name;`
      );

      return {
        tenants,
        plans,
        supportedModules: SUPPORTED_BUSINESS_MODULES,
        moduleDefaults: DEFAULT_MODULES,
        profiles: profiles.map((profile) => ({
          ...profile,
          branches: branches.filter((branch) => branch.profileId === profile.id),
        })),
      };
    });
  }

  async create(dto: SaveBusinessProfileDto) {
    this.validateImage(dto.logoUrl, 'Logo');
    this.validateImage(dto.digitalSignatureUrl, 'Digital signature');
    this.validateFinancialYear(dto);

    return this.tenantDb.withPlatform(async (tx) => {
      let tenantId = dto.tenantId;
      if (tenantId) {
        const tenant = await tx.queryOne<{ id: string }>(
          'SELECT id FROM platform.tenants WHERE id = $1;',
          [tenantId]
        );
        if (!tenant) {
          throw new NotFoundException('Tenant not found');
        }
      } else {
        const firstTenant = await tx.queryOne<{ id: string }>('SELECT id FROM platform.tenants ORDER BY created_at ASC LIMIT 1;');
        if (firstTenant) {
          tenantId = firstTenant.id;
        } else {
          const newTenant = await tx.queryOne<{ id: string }>(
            `INSERT INTO platform.tenants (slug, display_name, schema_name, status)
             VALUES ('org-' || substr(gen_random_uuid()::text, 1, 8), $1, 't_' || substr(gen_random_uuid()::text, 1, 8), 'active')
             RETURNING id;`,
            [dto.tradeName.trim()]
          );
          tenantId = newTenant!.id;
        }
      }

      const profile = await tx.queryOne<{ id: string }>(
        `INSERT INTO platform.business_profiles (
          tenant_id, legal_name, trade_name, business_type, industry, gstin, pan,
          address_line1, address_line2, city, state, state_code, jurisdiction, pincode,
          financial_year_start, financial_year_end, invoice_prefix, currency, tax_settings,
          logo_url, digital_signature_url, enabled_modules
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
          $18, $19::jsonb, $20, $21, $22::jsonb
        ) RETURNING id;`,
        this.profileValues({ ...dto, tenantId })
      );

      await this.replaceBranches(tx, profile!.id, dto.branches || []);
      if (dto.planId !== undefined && dto.planId) {
        await this.updateTenantPlan(tx, tenantId!, dto.planId);
      }

      return { id: profile!.id };
    });
  }

  async update(profileId: string, dto: SaveBusinessProfileDto) {
    this.validateImage(dto.logoUrl, 'Logo');
    this.validateImage(dto.digitalSignatureUrl, 'Digital signature');
    this.validateFinancialYear(dto);

    return this.tenantDb.withPlatform(async (tx) => {
      const existing = await tx.queryOne<{ tenantId: string }>(
        `SELECT tenant_id AS "tenantId"
         FROM platform.business_profiles
         WHERE id = $1;`,
        [profileId]
      );
      if (!existing) {
        throw new NotFoundException('Business profile not found');
      }
      if (existing.tenantId !== dto.tenantId) {
        throw new BadRequestException('A business profile cannot be reassigned to another tenant');
      }

      await tx.execute(
        `UPDATE platform.business_profiles SET
          legal_name = $2, trade_name = $3, business_type = $4, industry = $5,
          gstin = $6, pan = $7, address_line1 = $8, address_line2 = $9,
          city = $10, state = $11, state_code = $12, jurisdiction = $13,
          pincode = $14, financial_year_start = $15, financial_year_end = $16,
          invoice_prefix = $17, currency = $18, tax_settings = $19::jsonb,
          logo_url = $20, digital_signature_url = $21, enabled_modules = $22::jsonb,
          updated_at = NOW()
         WHERE id = $1;`,
        [profileId, ...this.profileValues(dto).slice(1)]
      );

      await this.replaceBranches(tx, profileId, dto.branches || []);
      if (dto.planId !== undefined) {
        await this.updateTenantPlan(tx, dto.tenantId, dto.planId);
      }

      return { id: profileId };
    });
  }

  async delete(profileId: string) {
    return this.tenantDb.withPlatform(async (tx) => {
      const existing = await tx.queryOne<{ id: string }>(
        'SELECT id FROM platform.business_profiles WHERE id = $1;',
        [profileId]
      );
      if (!existing) {
        throw new NotFoundException('Business profile not found');
      }
      await tx.execute('DELETE FROM platform.business_branches WHERE profile_id = $1;', [profileId]);
      await tx.execute('DELETE FROM platform.business_profiles WHERE id = $1;', [profileId]);
      return { success: true };
    });
  }

  private profileValues(dto: SaveBusinessProfileDto): unknown[] {
    return [
      dto.tenantId,
      dto.legalName.trim(),
      dto.tradeName.trim(),
      dto.businessType,
      dto.industry,
      dto.gstin?.trim().toUpperCase() || null,
      dto.pan?.trim().toUpperCase() || null,
      dto.addressLine1.trim(),
      dto.addressLine2?.trim() || null,
      dto.city.trim(),
      dto.state.trim(),
      dto.stateCode.trim(),
      dto.jurisdiction?.trim() || null,
      dto.pincode.trim(),
      dto.financialYearStart,
      dto.financialYearEnd,
      dto.invoicePrefix.trim(),
      dto.currency.trim().toUpperCase(),
      JSON.stringify(dto.taxSettings || {}),
      dto.logoUrl || null,
      dto.digitalSignatureUrl || null,
      JSON.stringify(dto.enabledModules || DEFAULT_MODULES[dto.industry] || SUPPORTED_BUSINESS_MODULES),
    ];
  }

  private async replaceBranches(tx: TenantTx, profileId: string, branches: SaveBusinessProfileDto['branches']) {
    await tx.execute('DELETE FROM platform.business_branches WHERE profile_id = $1;', [profileId]);
    for (const branch of branches || []) {
      await tx.execute(
        `INSERT INTO platform.business_branches (
          profile_id, code, name, is_head_office, gstin, address_line1, address_line2,
          city, state, state_code, pincode
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);`,
        [
          profileId,
          branch.code.trim().toUpperCase(),
          branch.name.trim(),
          branch.isHeadOffice || false,
          branch.gstin?.trim().toUpperCase() || null,
          branch.addressLine1.trim(),
          branch.addressLine2?.trim() || null,
          branch.city.trim(),
          branch.state.trim(),
          branch.stateCode.trim(),
          branch.pincode.trim(),
        ]
      );
    }
  }

  private async updateTenantPlan(tx: TenantTx, tenantId: string, planId: string | null) {
    if (planId === null) {
      await tx.execute('UPDATE platform.tenants SET plan_id = NULL, updated_at = NOW() WHERE id = $1;', [tenantId]);
      await tx.execute(
        `UPDATE platform.subscriptions SET status = 'CANCELLED'
         WHERE tenant_id = $1 AND status = 'ACTIVE';`,
        [tenantId]
      );
      return;
    }

    const plan = await tx.queryOne<{ id: string }>(
      'SELECT id FROM platform.plans WHERE id = $1 AND is_active = TRUE;',
      [planId]
    );
    if (!plan) {
      throw new BadRequestException('Selected subscription plan does not exist or is inactive');
    }

    await tx.execute('UPDATE platform.tenants SET plan_id = $2, updated_at = NOW() WHERE id = $1;', [
      tenantId,
      planId,
    ]);
    const updated = await tx.execute(
      `UPDATE platform.subscriptions
       SET plan_id = $2, status = 'ACTIVE'
       WHERE tenant_id = $1 AND status = 'ACTIVE';`,
      [tenantId, planId]
    );
    if (updated === 0) {
      await tx.execute(
        `INSERT INTO platform.subscriptions (tenant_id, plan_id, status)
         VALUES ($1, $2, 'ACTIVE');`,
        [tenantId, planId]
      );
    }
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
    if (new Date(dto.financialYearEnd) <= new Date(dto.financialYearStart)) {
      throw new BadRequestException('Financial year end must be after its start date');
    }
  }
}
