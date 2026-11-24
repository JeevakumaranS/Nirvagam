import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BusinessType as PrismaBusinessType, IndustryType as PrismaIndustryType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { TenantDatabaseService, TenantTx } from './tenant-database.service';
import { SaveBusinessProfileDto, SUPPORTED_BUSINESS_MODULES } from './dto/save-business-profile.dto';
import { AuthUser } from '@nirvagam/shared';

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
    private readonly prisma: PrismaService
  ) {}

  async getWorkspace() {
    const workspace = await this.tenantDb.withPlatform(async (tx) => {
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
                bp.address_line2 AS "addressLine2", bp.city, bp.district, bp.state,
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
                    city, district, state, state_code AS "stateCode", pincode
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

    const tenantIds = workspace.profiles.map((profile) => profile.tenantId);
    const ownerUsers = tenantIds.length
      ? await this.prisma.$queryRaw<Array<{
          tenantId: string;
          email: string;
          mustChangePassword: boolean;
        }>>`
          SELECT u.tenant_id AS "tenantId", u.email,
                 u.must_change_password AS "mustChangePassword"
          FROM users u
          JOIN user_roles ur ON ur.user_id = u.id
          JOIN roles r ON r.id = ur.role_id
          WHERE u.tenant_id = ANY(${tenantIds}::uuid[])
            AND r.name = 'BUSINESS_OWNER';
        `
      : [];

    return {
      ...workspace,
      profiles: workspace.profiles.map((profile) => ({
        ...profile,
        username: ownerUsers.find((owner) => owner.tenantId === profile.tenantId)?.email || null,
        requirePasswordChange:
          ownerUsers.find((owner) => owner.tenantId === profile.tenantId)?.mustChangePassword ?? true,
      })),
    };
  }

  async create(dto: SaveBusinessProfileDto, actor?: AuthUser) {
    if (!dto.username || !dto.temporaryPassword) {
      throw new BadRequestException('Owner username and temporary password are required for new business registration');
    }
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
        // Every platform business registration gets its own tenant record.
        // Reusing the oldest tenant would merge unrelated businesses and break
        // the tenant boundary required by the future Tenant Admin integration.
        const newTenant = await tx.queryOne<{ id: string }>(
          `INSERT INTO platform.tenants (slug, display_name, schema_name, status, metadata)
           VALUES ('org-' || substr(gen_random_uuid()::text, 1, 8), $1,
             't_' || substr(gen_random_uuid()::text, 1, 8), 'active', $2::jsonb)
           RETURNING id;`,
          [dto.tradeName.trim(), JSON.stringify({ source: 'platform_business_registration' })]
        );
        tenantId = newTenant!.id;
      }

      const profile = await tx.queryOne<{ id: string }>(
        `INSERT INTO platform.business_profiles (
          tenant_id, legal_name, trade_name, business_type, industry, gstin, pan,
          address_line1, address_line2, city, district, state, state_code, jurisdiction, pincode,
          financial_year_start, financial_year_end, invoice_prefix, currency, tax_settings,
          logo_url, digital_signature_url, enabled_modules
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18,
          $19, $20::jsonb, $21, $22, $23::jsonb
        ) RETURNING id;`,
        this.profileValues({ ...dto, tenantId })
      );

      await this.replaceBranches(tx, profile!.id, dto.branches || []);
      if (dto.planId !== undefined && dto.planId) {
        await this.updateTenantPlan(tx, tenantId!, dto.planId);
      }
      await this.syncOwnerAccount(tx, profile!.id, tenantId!, dto, true);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'BUSINESS_REGISTERED', 'TENANT', $2, $3)`,
        [actor?.id || null, tenantId, JSON.stringify({ profileId: profile!.id, tradeName: dto.tradeName })]);

      return { id: profile!.id };
    });
  }

  async update(profileId: string, dto: SaveBusinessProfileDto, actor?: AuthUser) {
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
          city = $10, district = $11, state = $12, state_code = $13, jurisdiction = $14,
          pincode = $15, financial_year_start = $16, financial_year_end = $17,
          invoice_prefix = $18, currency = $19, tax_settings = $20::jsonb,
          logo_url = $21, digital_signature_url = $22, enabled_modules = $23::jsonb,
          updated_at = NOW()
         WHERE id = $1;`,
        [profileId, ...this.profileValues(dto).slice(1)]
      );

      await this.replaceBranches(tx, profileId, dto.branches || []);
      if (dto.planId !== undefined) {
        await this.updateTenantPlan(tx, dto.tenantId, dto.planId);
      }
      await this.syncOwnerAccount(tx, profileId, dto.tenantId, dto, false);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'BUSINESS_PROFILE_UPDATED', 'TENANT', $2, $3)`,
        [actor?.id || null, dto.tenantId, JSON.stringify({ profileId })]);

      return { id: profileId };
    });
  }

  async delete(profileId: string, actor?: AuthUser) {
    return this.tenantDb.withPlatform(async (tx) => {
      const existing = await tx.queryOne<{ id: string; tenantId: string }>(
        'SELECT id, tenant_id AS "tenantId" FROM platform.business_profiles WHERE id = $1;',
        [profileId]
      );
      if (!existing) {
        throw new NotFoundException('Business profile not found');
      }
      await tx.execute('DELETE FROM platform.business_branches WHERE profile_id = $1;', [profileId]);
      await tx.execute('DELETE FROM platform.business_profiles WHERE id = $1;', [profileId]);
      await tx.execute(`INSERT INTO platform.platform_audit_log (actor_id, action, target_type, target_id, metadata)
        VALUES ($1, 'BUSINESS_PROFILE_DELETED', 'TENANT', $2, $3)`,
        [actor?.id || null, existing.tenantId, JSON.stringify({ profileId })]);
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
      dto.district?.trim() || null,
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

  private async syncOwnerAccount(
    tx: TenantTx,
    profileId: string,
    tenantId: string,
    dto: SaveBusinessProfileDto,
    isNewProfile: boolean
  ) {
    const tenantRecord = await tx.queryOne<{ slug: string }>(
      'SELECT slug FROM platform.tenants WHERE id = $1;',
      [tenantId]
    );
    if (!tenantRecord) {
      throw new NotFoundException('Tenant not found');
    }

    const username = dto.username?.trim().toLowerCase();
    if (!username && dto.temporaryPassword) {
      throw new BadRequestException('A username is required when setting a temporary password');
    }
    if (isNewProfile && !username) {
      throw new BadRequestException('Owner username is required');
    }

    const branches = dto.branches?.length
      ? dto.branches
      : [{
          code: 'HQ',
          name: 'Head Office',
          isHeadOffice: true,
          gstin: dto.gstin,
          addressLine1: dto.addressLine1,
          addressLine2: dto.addressLine2,
          city: dto.city,
          state: dto.state,
          stateCode: dto.stateCode,
          pincode: dto.pincode,
        }];

    await this.prisma.$transaction(async (prismaTx) => {
      const currentTenant = await prismaTx.tenant.findUnique({ where: { id: tenantId } });
      if (!currentTenant) {
        const slugConflict = await prismaTx.tenant.findUnique({ where: { slug: tenantRecord.slug } });
        if (slugConflict) {
          throw new ConflictException('The platform tenant slug is already assigned to a different application tenant');
        }
        await prismaTx.tenant.create({
          data: { id: tenantId, slug: tenantRecord.slug, name: dto.tradeName.trim() },
        });
      } else {
        await prismaTx.tenant.update({
          where: { id: tenantId },
          data: { name: dto.tradeName.trim() },
        });
      }

      const businessData = {
        tenantId,
        legalName: dto.legalName.trim(),
        tradeName: dto.tradeName.trim(),
        businessType: dto.businessType as PrismaBusinessType,
        industry: dto.industry as PrismaIndustryType,
        pan: dto.pan?.trim().toUpperCase() || null,
        logoUrl: dto.logoUrl || null,
        signatureUrl: dto.digitalSignatureUrl || null,
        currency: dto.currency.trim().toUpperCase(),
        taxSettings: JSON.parse(JSON.stringify(dto.taxSettings || {})),
        addressLine1: dto.addressLine1.trim(),
        addressLine2: dto.addressLine2?.trim() || null,
        city: dto.city.trim(),
        state: dto.state.trim(),
        stateCode: dto.stateCode.trim(),
        pincode: dto.pincode.trim(),
        enabledModules: dto.enabledModules || [],
      };
      const existingBusiness = await prismaTx.business.findUnique({ where: { id: profileId } });
      if (existingBusiness && existingBusiness.tenantId !== tenantId) {
        throw new ConflictException('This profile ID is already associated with a different tenant business');
      }
      if (existingBusiness) {
        await prismaTx.business.update({ where: { id: profileId }, data: businessData });
      } else {
        await prismaTx.business.create({ data: { id: profileId, ...businessData } });
      }

      const createdBranches = [];
      for (const [index, branch] of branches.entries()) {
        const code = branch.code.trim().toUpperCase();
        const existingBranch = await prismaTx.branch.findUnique({
          where: { businessId_code: { businessId: profileId, code } },
        });
        if (existingBranch) {
          createdBranches.push(await prismaTx.branch.update({
            where: { id: existingBranch.id },
            data: {
              name: branch.name.trim(),
              isHeadOffice: branch.isHeadOffice || index === 0,
              gstin: branch.gstin?.trim().toUpperCase() || null,
              addressLine1: branch.addressLine1.trim(),
              addressLine2: branch.addressLine2?.trim() || null,
              city: branch.city.trim(),
              state: branch.state.trim(),
              stateCode: branch.stateCode.trim(),
              pincode: branch.pincode.trim(),
            },
          }));
          continue;
        }
        createdBranches.push(await prismaTx.branch.create({
          data: {
            businessId: profileId,
            code,
            name: branch.name.trim(),
            isHeadOffice: branch.isHeadOffice || index === 0,
            gstin: branch.gstin?.trim().toUpperCase() || null,
            addressLine1: branch.addressLine1.trim(),
            addressLine2: branch.addressLine2?.trim() || null,
            city: branch.city.trim(),
            state: branch.state.trim(),
            stateCode: branch.stateCode.trim(),
            pincode: branch.pincode.trim(),
          },
        }));
      }
      const ownerBranch = createdBranches.find((branch) => branch.isHeadOffice) || createdBranches[0];
      if (!ownerBranch) {
        throw new BadRequestException('At least one business branch is required to create the owner account');
      }

      const ownerRole = await prismaTx.role.findFirst({
        where: { name: 'BUSINESS_OWNER', businessId: null },
      });
      if (!ownerRole) {
        throw new BadRequestException('Business Owner role is not initialized; seed the system roles before registration');
      }

      const existingOwner = await prismaTx.user.findFirst({
        where: {
          tenantId,
          userRoles: { some: { role: { name: 'BUSINESS_OWNER' } } },
        },
      });
      if (!username) {
        if (isNewProfile) {
          throw new BadRequestException('Owner username is required');
        }
        if (existingOwner && dto.requirePasswordChange !== undefined) {
          await prismaTx.$executeRaw`
            UPDATE users
            SET must_change_password = ${dto.requirePasswordChange}
            WHERE id = ${existingOwner.id}::uuid;
          `;
        }
        return;
      }

      const usernameOwner = await prismaTx.user.findUnique({ where: { email: username } });
      if (usernameOwner && usernameOwner.id !== existingOwner?.id) {
        throw new ConflictException('This username is already in use');
      }
      if (!existingOwner && !dto.temporaryPassword) {
        throw new BadRequestException('A temporary password is required when creating the owner account');
      }

      const passwordHash = dto.temporaryPassword
        ? await bcrypt.hash(dto.temporaryPassword, 12)
        : undefined;
      const owner = existingOwner
        ? await prismaTx.user.update({
            where: { id: existingOwner.id },
            data: {
              email: username,
              ...(passwordHash ? { passwordHash } : {}),
            },
          })
        : await prismaTx.user.create({
            data: {
              tenantId,
              email: username,
              passwordHash: passwordHash!,
              firstName: dto.tradeName.trim(),
              lastName: 'Owner',
            },
          });

      if (dto.requirePasswordChange !== undefined || passwordHash) {
        await prismaTx.$executeRaw`
          UPDATE users
          SET must_change_password = ${dto.requirePasswordChange ?? true}
          WHERE id = ${owner.id}::uuid;
        `;
      }

      for (const branch of createdBranches) {
        const warehouse = await prismaTx.warehouse.findFirst({ where: { branchId: branch.id } });
        if (!warehouse) {
          await prismaTx.warehouse.create({
            data: {
              branchId: branch.id,
              name: `${branch.name} Warehouse`,
              code: `WH-${branch.code}`,
              isDefault: true,
            },
          });
        }
      }

      await prismaTx.userRole.upsert({
        where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
        create: { userId: owner.id, roleId: ownerRole.id },
        update: {},
      });
      await prismaTx.userBranchAssignment.updateMany({
        where: { userId: owner.id, isDefault: true },
        data: { isDefault: false },
      });
      await prismaTx.userBranchAssignment.upsert({
        where: { userId_branchId: { userId: owner.id, branchId: ownerBranch.id } },
        create: { userId: owner.id, branchId: ownerBranch.id, isDefault: true },
        update: { isDefault: true },
      });
    });
  }

  private async replaceBranches(tx: TenantTx, profileId: string, branches: SaveBusinessProfileDto['branches']) {
    await tx.execute('DELETE FROM platform.business_branches WHERE profile_id = $1;', [profileId]);
    for (const branch of branches || []) {
      await tx.execute(
        `INSERT INTO platform.business_branches (
          profile_id, code, name, is_head_office, gstin, address_line1, address_line2,
          city, district, state, state_code, pincode
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);`,
        [
          profileId,
          branch.code.trim().toUpperCase(),
          branch.name.trim(),
          branch.isHeadOffice || false,
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
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(dto.financialYearStart) || !datePattern.test(dto.financialYearEnd)) {
      throw new BadRequestException('Financial year dates must use the YYYY-MM-DD format');
    }
    if (new Date(dto.financialYearEnd) <= new Date(dto.financialYearStart)) {
      throw new BadRequestException('Financial year end must be after its start date');
    }
  }
}
