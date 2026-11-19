import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
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
    private configService: ConfigService
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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
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

  async getProfile(userId: string) {
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

    return user;
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
}
