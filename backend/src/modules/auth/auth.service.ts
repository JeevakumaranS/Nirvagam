import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDatabaseService } from '../../tenancy/tenant-database.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import {
  TenantStatus,
  JwtPayload,
  AuthUser,
} from '@nirvagam/shared';
import { TenantContext } from '../../tenancy/tenancy.types';
import { jwtExpirySecondsFromConfig } from './jwt-expiry';

interface LoginTenantRecord {
  id: string;
  slug: string;
  display_name: string;
  schema_name: string;
  status: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private tenantDb: TenantDatabaseService
  ) {}

  async register(): Promise<never> {
    throw new ForbiddenException('Public registration is disabled. Contact a platform administrator to create a workspace.');
  }

  async login(dto: LoginDto, host?: string) {
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

    let tenantRecord = await this.resolveLoginTenant(dto.tenantSlug, host);
    if (!tenantRecord && !dto.tenantSlug?.trim()) {
      const matchingTenants = await this.findTenantsForCredentials(email, dto.password);
      if (matchingTenants.length > 1) {
        return {
          workspaceSelectionRequired: true,
          workspaces: matchingTenants.map((tenant) => ({
            slug: tenant.slug,
            displayName: tenant.display_name,
          })),
        };
      }
      tenantRecord = matchingTenants[0] || null;
    }
    if (!tenantRecord) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (tenantRecord.status !== 'active') {
      throw new UnauthorizedException('This organization is not active. Please contact platform support.');
    }

    const tenantPrisma = this.prisma.getClientForSchema(tenantRecord.schema_name);
    const user = await tenantPrisma.user.findUnique({
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

    if (!user || !user.isActive || user.tenantId !== tenantRecord.id) {
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
    const passwordState = await tenantPrisma.$queryRaw<Array<{ mustChangePassword: boolean }>>`
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
      const defaultBiz = await tenantPrisma.business.findFirst({
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

      if (!decoded.tenantId) {
        throw new UnauthorizedException('Tenant identity is missing from the refresh token');
      }
      const tenantRecord = await this.tenantDb.withPlatform((tx) =>
        tx.queryOne<{ id: string; schema_name: string; status: string }>(
          `SELECT id, schema_name, status
           FROM platform.tenants
           WHERE id::text = $1
           LIMIT 1;`,
          [decoded.tenantId]
        )
      );
      if (!tenantRecord || tenantRecord.status !== 'active') {
        throw new UnauthorizedException('Tenant account is no longer active');
      }

      const tenantPrisma = this.prisma.getClientForSchema(tenantRecord.schema_name);
      const user = await tenantPrisma.user.findUnique({
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

      if (!user || !user.isActive || user.tenantId !== tenantRecord.id) {
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
    const expiresIn = jwtExpirySecondsFromConfig(this.configService.get<string>('JWT_EXPIRES_IN'));
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN');
    if (!refreshExpiresIn) {
      throw new Error('JWT_REFRESH_EXPIRES_IN must be configured');
    }

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: accessSecret,
        expiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn,
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

  private async findTenantsForCredentials(email: string, password: string): Promise<LoginTenantRecord[]> {
    const tenants = await this.tenantDb.withPlatform((tx) =>
      tx.query<LoginTenantRecord>(
        `SELECT id, slug, display_name, schema_name, status
         FROM platform.tenants
         WHERE status = 'active'
         ORDER BY slug;`
      )
    );
    const matchingTenants: LoginTenantRecord[] = [];
    let nextTenantIndex = 0;
    const workerCount = Math.min(5, tenants.length);

    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (nextTenantIndex < tenants.length) {
        const tenant = tenants[nextTenantIndex++];
        const context: TenantContext = {
          tenantId: tenant.id,
          schemaName: tenant.schema_name,
          slug: tenant.slug,
          displayName: tenant.display_name,
          status: 'active',
          roleKeys: [],
          branchIds: [],
          planLimits: {
            maxBranches: 1,
            maxUsers: 5,
            maxInvoicesPerMonth: 500,
            featureFlags: {},
          },
        };
        const user = await this.tenantDb.withTenant(context, (tx) =>
          tx.queryOne<{ tenant_id: string; password_hash: string; is_active: boolean }>(
            `SELECT tenant_id, password_hash, is_active
             FROM users
             WHERE lower(email) = $1
             LIMIT 1;`,
            [email]
          )
        );

        if (
          user?.is_active &&
          user.tenant_id === tenant.id &&
          await bcrypt.compare(password, user.password_hash)
        ) {
          matchingTenants.push(tenant);
        }
      }
    }));

    return matchingTenants.sort((first, second) => first.slug.localeCompare(second.slug));
  }

  private async resolveLoginTenant(tenantSlug?: string, host?: string) {
    const normalizedSlug = tenantSlug?.trim().toLowerCase();
    const domain = host?.split(':')[0].toLowerCase();
    const tenants = await this.tenantDb.withPlatform((tx) =>
      tx.query<{
        id: string;
        slug: string;
        display_name: string;
        schema_name: string;
        status: string;
      }>(
        `SELECT t.id, t.slug, t.display_name, t.schema_name, t.status
         FROM platform.tenants t
         LEFT JOIN platform.tenant_domains td
           ON td.tenant_id = t.id AND td.verified = TRUE AND td.domain = $2
         WHERE ($1::text IS NOT NULL AND (t.id::text = $1 OR t.slug = $1 OR t.schema_name = $1))
            OR td.tenant_id IS NOT NULL;`,
        [normalizedSlug || null, domain || null]
      )
    );
    if (tenants.length > 1) {
      throw new UnauthorizedException('Workspace slug does not match the current workspace domain');
    }
    return tenants[0] || null;
  }
}
