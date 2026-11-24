import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDatabaseService } from '../../tenancy/tenant-database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  TenantStatus,
  AccountGroup,
  PlanTier,
  JwtPayload,
  AuthUser,
} from '@nirvagam/shared';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tenantDb: TenantDatabaseService
  ) {}

  async register(dto: RegisterDto) {
    // 1. Check existing tenant or user
    const existingSlug = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug.toLowerCase().trim() },
    });
    if (existingSlug) {
      throw new ConflictException(`Workspace slug "${dto.slug}" is already registered`);
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existingUser) {
      throw new ConflictException(`Email "${dto.email}" is already registered`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // 2. Atomic transaction to initialize the entire organization
    return this.prisma.$transaction(async (tx) => {
      // Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName,
          slug: dto.slug.toLowerCase().trim(),
          status: TenantStatus.ACTIVE,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14-day trial
        },
      });

      // Link default starter or business subscription
      const starterPlan = await tx.plan.findUnique({ where: { tier: PlanTier.BUSINESS } });
      if (starterPlan) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: starterPlan.id,
            status: TenantStatus.ACTIVE,
            startDate: new Date(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Create Primary Business Entity
      const business = await tx.business.create({
        data: {
          tenantId: tenant.id,
          legalName: dto.companyName,
          tradeName: dto.companyName,
          businessType: dto.businessType as any || 'PRIVATE_LIMITED',
          industry: dto.industry as any || 'RETAIL',
          pan: dto.pan,
          addressLine1: 'Main Office Road',
          city: 'Chennai',
          state: dto.state || 'Tamil Nadu',
          stateCode: dto.stateCode || '33',
          pincode: '600001',
          country: 'India',
        },
      });

      // Create Head Office Branch
      const branch = await tx.branch.create({
        data: {
          businessId: business.id,
          name: 'Head Office',
          code: 'HO',
          isHeadOffice: true,
          gstin: dto.gstin,
          addressLine1: 'Main Office Road',
          city: 'Chennai',
          state: dto.state || 'Tamil Nadu',
          stateCode: dto.stateCode || '33',
          pincode: '600001',
        },
      });

      // Create Default Warehouse for Head Office
      await tx.warehouse.create({
        data: {
          branchId: branch.id,
          name: 'Main Store Warehouse',
          code: 'WH-HO',
          isDefault: true,
        },
      });

      // Create Default Fiscal Period
      await tx.fiscalPeriod.create({
        data: {
          businessId: business.id,
          name: 'FY 2026-2027',
          startDate: new Date('2026-04-01'),
          endDate: new Date('2027-03-31'),
          isActive: true,
        },
      });

      // Create Standard Tax Rates
      const taxRates = [
        { name: 'GST 0% (Nil)', rate: 0, cgst: 0, sgst: 0, igst: 0 },
        { name: 'GST 5%', rate: 5, cgst: 2.5, sgst: 2.5, igst: 5 },
        { name: 'GST 12%', rate: 12, cgst: 6, sgst: 6, igst: 12 },
        { name: 'GST 18%', rate: 18, cgst: 9, sgst: 9, igst: 18, isDefault: true },
        { name: 'GST 28%', rate: 28, cgst: 14, sgst: 14, igst: 28 },
      ];
      for (const tr of taxRates) {
        await tx.taxRate.create({
          data: {
            businessId: business.id,
            name: tr.name,
            rate: tr.rate,
            cgstRate: tr.cgst,
            sgstRate: tr.sgst,
            igstRate: tr.igst,
            isDefault: !!tr.isDefault,
          },
        });
      }

      // Create Standard Units
      const standardUnits = [
        { name: 'Pieces', symbol: 'PCS', decimalPlaces: 0, isDefault: true },
        { name: 'Box', symbol: 'BOX', decimalPlaces: 0 },
        { name: 'Kilogram', symbol: 'KG', decimalPlaces: 3 },
      ];
      for (const u of standardUnits) {
        await tx.unit.create({
          data: {
            businessId: business.id,
            name: u.name,
            symbol: u.symbol,
            decimalPlaces: u.decimalPlaces,
            isDefault: u.isDefault,
          },
        });
      }

      // Initialize Standard Chart of Accounts
      const accounts = [
        { code: '1010', name: 'Cash in Hand', group: AccountGroup.ASSET, subGroup: 'Cash' },
        { code: '1020', name: 'Operating Bank Account', group: AccountGroup.ASSET, subGroup: 'Bank' },
        { code: '1030', name: 'Accounts Receivable (Debtors)', group: AccountGroup.ASSET, subGroup: 'Accounts Receivable' },
        { code: '1040', name: 'Merchandise Inventory', group: AccountGroup.ASSET, subGroup: 'Inventory' },
        { code: '1051', name: 'Input CGST', group: AccountGroup.ASSET, subGroup: 'Tax Receivable' },
        { code: '1052', name: 'Input SGST', group: AccountGroup.ASSET, subGroup: 'Tax Receivable' },
        { code: '1053', name: 'Input IGST', group: AccountGroup.ASSET, subGroup: 'Tax Receivable' },
        { code: '2010', name: 'Accounts Payable (Creditors)', group: AccountGroup.LIABILITY, subGroup: 'Accounts Payable' },
        { code: '2021', name: 'Output CGST', group: AccountGroup.LIABILITY, subGroup: 'Tax Payable' },
        { code: '2022', name: 'Output SGST', group: AccountGroup.LIABILITY, subGroup: 'Tax Payable' },
        { code: '2023', name: 'Output IGST', group: AccountGroup.LIABILITY, subGroup: 'Tax Payable' },
        { code: '3010', name: 'Capital Account', group: AccountGroup.EQUITY, subGroup: 'Equity' },
        { code: '4010', name: 'Sales Revenue', group: AccountGroup.INCOME, subGroup: 'Operating Revenue' },
        { code: '5010', name: 'Cost of Goods Sold (COGS)', group: AccountGroup.EXPENSE, subGroup: 'Direct Expense' },
        { code: '5020', name: 'Purchase Expenses', group: AccountGroup.EXPENSE, subGroup: 'Direct Expense' },
        { code: '5090', name: 'Round-off Account', group: AccountGroup.EXPENSE, subGroup: 'Adjustment' },
      ];
      for (const a of accounts) {
        await tx.chartOfAccount.create({
          data: {
            businessId: business.id,
            code: a.code,
            name: a.name,
            group: a.group,
            subGroup: a.subGroup,
            isSystem: true,
          },
        });
      }

      // Document Sequences
      const defaultSeqs = [
        { type: 'TAX_INVOICE', prefix: 'INV-26/', nextNumber: 1, padding: 4 },
        { type: 'POS_RECEIPT', prefix: 'POS-26/', nextNumber: 1, padding: 4 },
        { type: 'PURCHASE_INVOICE', prefix: 'PUR-26/', nextNumber: 1, padding: 4 },
      ];
      for (const seq of defaultSeqs) {
        await tx.documentSequence.create({
          data: {
            businessId: business.id,
            branchId: branch.id,
            documentType: seq.type,
            prefix: seq.prefix,
            nextNumber: seq.nextNumber,
            padding: seq.padding,
          },
        });
      }

      // Create Admin User
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email.toLowerCase().trim(),
          passwordHash: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
        },
      });

      // Assign Business Owner Role
      const ownerRole = await tx.role.findFirst({ where: { name: 'BUSINESS_OWNER' } });
      if (ownerRole) {
        await tx.userRole.create({
          data: {
            userId: user.id,
            roleId: ownerRole.id,
          },
        });
      }

      // Assign User to Head Office Branch
      await tx.userBranchAssignment.create({
        data: {
          userId: user.id,
          branchId: branch.id,
          isDefault: true,
        },
      });

      // Generate Tokens
      const tokens = await this.generateTokens({
        sub: user.id,
        email: user.email,
        tenantId: tenant.id,
        businessId: business.id,
        branchId: branch.id,
        roles: ['BUSINESS_OWNER'],
        permissions: ['*:*'],
      });

      return {
        tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
        business: { id: business.id, legalName: business.legalName },
        branch: { id: branch.id, name: branch.name },
        user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
        ...tokens,
      };
    });
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const platformAdmin = await this.tenantDb.withPlatform((tx) =>
      tx.queryOne<{
        id: string;
        email: string;
        password_hash: string;
        first_name: string | null;
        last_name: string | null;
        status: string;
        role: string | null;
        is_super_admin: boolean;
      }>(
        `SELECT i.id, i.email, i.password_hash, i.first_name, i.last_name, i.status,
                pu.role, pu.is_super_admin
         FROM platform.identities i
         JOIN platform.platform_users pu ON pu.identity_id = i.id
         WHERE lower(i.email) = $1
         LIMIT 1;`,
        [email]
      )
    );

    if (platformAdmin) {
      const passwordValid =
        platformAdmin.status === 'ACTIVE' &&
        (await bcrypt.compare(dto.password, platformAdmin.password_hash));
      if (!passwordValid) {
        throw new UnauthorizedException('Invalid email or password');
      }

      // Legacy super-admin identities may have a null role; preserve their Super Admin identity.
      const roleName = platformAdmin.role || 'SUPER_ADMIN';
      const roles = [roleName];
      const permissions = await this.getPlatformPermissions(roleName, platformAdmin.is_super_admin);
      const payload: JwtPayload = {
        sub: platformAdmin.id,
        email: platformAdmin.email,
        tenantId: '',
        businessId: '',
        roles,
        permissions,
        platformAdmin: true,
      };
      const tokens = await this.generateTokens(payload);

      return {
        user: {
          id: platformAdmin.id,
          email: platformAdmin.email,
          firstName: platformAdmin.first_name || '',
          lastName: platformAdmin.last_name || '',
          roles,
          permissions,
          platformAdmin: true,
        },
        tenant: null,
        activeBusiness: null,
        ...tokens,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        branchAssignments: {
          where: { isDefault: true },
          include: {
            branch: {
              include: { business: true },
            },
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.tenant.status === TenantStatus.SUSPENDED) {
      throw new UnauthorizedException('Organization account has been suspended. Please contact platform support.');
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const passwordState = await this.prisma.$queryRaw<Array<{ mustChangePassword: boolean }>>`
      SELECT must_change_password AS "mustChangePassword"
      FROM users
      WHERE id = ${user.id}::uuid;
    `;
    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }

    // Determine active business and branch
    const primaryBranch = user.branchAssignments[0]?.branch;
    let businessId = primaryBranch?.businessId;

    if (!businessId) {
      const defaultBiz = await this.prisma.business.findFirst({
        where: { tenantId: user.tenantId },
        include: { branches: true },
      });
      businessId = defaultBiz?.id || '';
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      businessId: businessId || '',
      branchId: primaryBranch?.id,
      roles,
      permissions: Array.from(permissions),
    };

    const tokens = await this.generateTokens(payload);

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles,
        permissions: Array.from(permissions),
        mustChangePassword: passwordState[0]?.mustChangePassword ?? false,
      },
      tenant: {
        id: user.tenant.id,
        slug: user.tenant.slug,
        name: user.tenant.name,
        status: user.tenant.status,
      },
      activeBusiness: primaryBranch ? {
        id: primaryBranch.business.id,
        legalName: primaryBranch.business.legalName,
        tradeName: primaryBranch.business.tradeName,
        branchId: primaryBranch.id,
        branchName: primaryBranch.name,
      } : null,
      ...tokens,
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'nirvagam_jwt_refresh_super_secret_key_at_least_32_characters';
      const decoded = this.jwtService.verify<JwtPayload>(dto.refreshToken, { secret: refreshSecret });

      if (decoded.platformAdmin) {
        const platformAdmin = await this.tenantDb.withPlatform((tx) =>
          tx.queryOne<{ id: string; email: string; status: string; role: string | null }>(
            `SELECT i.id, i.email, i.status, pu.role
             FROM platform.identities i
             JOIN platform.platform_users pu ON pu.identity_id = i.id
             WHERE i.id = $1
             LIMIT 1;`,
            [decoded.sub]
          )
        );

        if (!platformAdmin || platformAdmin.status !== 'ACTIVE') {
          throw new UnauthorizedException('Platform admin account is no longer active');
        }

        const roleName = platformAdmin.role || 'PLATFORM_SUPER_ADMIN';
        return this.generateTokens({
          sub: platformAdmin.id,
          email: platformAdmin.email,
          tenantId: '',
          businessId: '',
          roles: [roleName],
          permissions: await this.getPlatformPermissions(roleName, roleName === 'PLATFORM_SUPER_ADMIN'),
          platformAdmin: true,
        });
      }

      const user = await this.prisma.user.findUnique({
        where: { id: decoded.sub },
        include: {
          userRoles: {
            include: {
              role: {
                include: { rolePermissions: { include: { permission: true } } },
              },
            },
          },
        },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User account no longer valid');
      }

      const roles = user.userRoles.map((ur) => ur.role.name);
      const permissions = new Set<string>();
      for (const ur of user.userRoles) {
        for (const rp of ur.role.rolePermissions) {
          permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
        }
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        businessId: decoded.businessId,
        branchId: decoded.branchId,
        roles,
        permissions: Array.from(permissions),
      };

      return this.generateTokens(newPayload);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const rows = await this.prisma.$queryRaw<Array<{
      id: string;
      passwordHash: string;
      mustChangePassword: boolean;
      isActive: boolean;
    }>>`
      SELECT id, password_hash AS "passwordHash",
             must_change_password AS "mustChangePassword",
             is_active AS "isActive"
      FROM users
      WHERE id = ${userId}::uuid;
    `;
    const user = rows[0];
    if (!user || !user.isActive) {
      throw new NotFoundException('User profile not found');
    }

    if (!user.mustChangePassword && !dto.currentPassword) {
      throw new BadRequestException('Current password is required');
    }
    if (
      dto.currentPassword &&
      !(await bcrypt.compare(dto.currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (await bcrypt.compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException('New password must be different from the temporary password');
    }

    await this.prisma.$executeRaw`
      UPDATE users
      SET password_hash = ${await bcrypt.hash(dto.newPassword, 12)},
          must_change_password = false,
          updated_at = NOW()
      WHERE id = ${user.id}::uuid;
    `;
    return { success: true };
  }

  async getProfile(userId: string, platformAdmin = false) {
    if (platformAdmin) {
      const identity = await this.tenantDb.withPlatform((tx) =>
        tx.queryOne<{
          id: string;
          email: string;
          first_name: string | null;
          last_name: string | null;
          phone: string | null;
          created_at: Date;
          status: string;
          role: string | null;
        }>(
          `SELECT i.id, i.email, i.first_name, i.last_name, i.phone, i.created_at, i.status, pu.role
           FROM platform.identities i
           JOIN platform.platform_users pu ON pu.identity_id = i.id
           WHERE i.id = $1
           LIMIT 1;`,
          [userId]
        )
      );

      if (!identity || identity.status !== 'ACTIVE') {
        throw new NotFoundException('Platform admin profile not found');
      }

      const roleName = identity.role || 'PLATFORM_SUPER_ADMIN';
      const permissions = await this.getPlatformPermissions(roleName, roleName === 'PLATFORM_SUPER_ADMIN');
      return {
        id: identity.id,
        email: identity.email,
        firstName: identity.first_name || '',
        lastName: identity.last_name || '',
        phone: identity.phone,
        avatarUrl: null,
        tenant: null,
        userRoles: [{ role: { name: roleName } }],
        permissions,
        branchAssignments: [],
        createdAt: identity.created_at,
        platformAdmin: true,
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        tenantId: true,
        createdAt: true,
        tenant: {
          select: { id: true, name: true, slug: true, status: true },
        },
        userRoles: {
          select: { role: { select: { id: true, name: true, description: true } } },
        },
        branchAssignments: {
          select: {
            isDefault: true,
            branch: {
              select: {
                id: true,
                name: true,
                code: true,
                business: { select: { id: true, legalName: true, tradeName: true } },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const passwordState = await this.prisma.$queryRaw<Array<{ mustChangePassword: boolean }>>`
      SELECT must_change_password AS "mustChangePassword"
      FROM users
      WHERE id = ${userId}::uuid;
    `;
    return {
      ...user,
      mustChangePassword: passwordState[0]?.mustChangePassword ?? false,
      platformAdmin: false,
    };
  }

  private async generateTokens(payload: JwtPayload) {
    const accessSecret = this.configService.get<string>('JWT_SECRET') || 'nirvagam_jwt_super_secret_key_production_grade_at_least_32_characters';
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') || 'nirvagam_jwt_refresh_super_secret_key_at_least_32_characters';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: 900, // 15 mins in seconds
    };
  }

  private async getPlatformPermissions(role: string, isSuperAdmin = false): Promise<string[]> {
    if (isSuperAdmin || role === 'PLATFORM_SUPER_ADMIN' || role === 'SUPER_ADMIN') return ['*:*'];
    const rows = await this.tenantDb.withPlatform((tx) => tx.query<{ permission_key: string }>(
      `SELECT p.permission_key FROM platform.platform_role_permissions rpp
       JOIN platform.platform_roles r ON r.id = rpp.role_id
       JOIN platform.platform_permissions p ON p.id = rpp.permission_id
       WHERE r.role_key = $1`, [role]
    ));
    return rows.map((row) => row.permission_key);
  }
}
