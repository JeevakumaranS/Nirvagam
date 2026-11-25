import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { TenantDatabaseService } from '../../tenancy/tenant-database.service';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService: any = {
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    plan: {
      findUnique: jest.fn(),
    },
    subscription: {
      create: jest.fn(),
    },
    business: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    branch: {
      create: jest.fn(),
    },
    warehouse: {
      create: jest.fn(),
    },
    fiscalPeriod: {
      create: jest.fn(),
    },
    taxRate: {
      create: jest.fn(),
    },
    unit: {
      create: jest.fn(),
    },
    chartOfAccount: {
      create: jest.fn(),
    },
    documentSequence: {
      create: jest.fn(),
    },
    role: {
      findFirst: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
    userBranchAssignment: {
      create: jest.fn(),
    },
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
    getClientForSchema: jest.fn(),
  };

  const mockTenantPrisma: any = {
    user: {
      findUnique: jest.fn(),
    },
    business: {
      findFirst: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  const tenantRecord = {
    id: 'tenant-1',
    slug: 'workspace-a',
    display_name: 'Workspace A',
    schema_name: 't_aaaaaaaaaaaa',
    status: 'active',
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock_token'),
    verify: jest.fn(),
  };

  const mockTenantDatabaseService = {
    withPlatform: jest.fn(),
    withTenant: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test_jwt_secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test_jwt_refresh_secret';
      if (key === 'JWT_EXPIRES_IN') return '168';
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      return null;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: TenantDatabaseService, useValue: mockTenantDatabaseService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    jest.clearAllMocks();
    mockPrismaService.getClientForSchema.mockReturnValue(mockTenantPrisma);
    mockTenantDatabaseService.withPlatform.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({
        queryOne: jest.fn().mockResolvedValue(null),
        query: jest.fn((sql: string, params?: unknown[]) =>
          Promise.resolve(
            sql.includes('LEFT JOIN platform.tenant_domains') && !params?.some(Boolean)
              ? []
              : [tenantRecord]
          )
        ),
      })
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('rejects public workspace registration', async () => {
      await expect(service.register()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login', () => {
    it('authenticates active platform super admins from platform identities', async () => {
      const passwordHash = await bcrypt.hash('StrongPassword@123', 10);
      mockTenantDatabaseService.withPlatform.mockImplementationOnce(
        (callback: (tx: unknown) => unknown) =>
          callback({
            queryOne: jest.fn().mockResolvedValue({
              id: 'platform-identity-1',
              email: 'root@example.com',
              password_hash: passwordHash,
              first_name: 'Platform',
              last_name: 'Admin',
              status: 'ACTIVE',
            }),
          })
      );

      const result = await service.login({
        email: 'root@example.com',
        password: 'StrongPassword@123',
      });

      expect(result).toEqual(expect.objectContaining({
        user: expect.objectContaining({ roles: expect.arrayContaining(['SUPER_ADMIN']) }),
        tenant: null,
        activeBusiness: null,
      }));
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ platformAdmin: true, sub: 'platform-identity-1' }),
        expect.any(Object)
      );
      expect(mockJwtService.signAsync).toHaveBeenNthCalledWith(
        1,
        expect.any(Object),
        expect.objectContaining({ expiresIn: 604800 })
      );
      expect(result).toHaveProperty('expiresIn', 604800);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockTenantPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({
          email: 'unknown@testcorp.com',
          password: 'Password@123',
          tenantSlug: tenantRecord.slug,
        })
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.getClientForSchema).toHaveBeenCalledWith(tenantRecord.schema_name);
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('authenticates a user only through the selected tenant schema', async () => {
      const passwordHash = await bcrypt.hash('StrongPassword@123', 10);
      mockTenantPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'tenant-user-1',
        email: 'owner@example.com',
        passwordHash,
        isActive: true,
        tenantId: tenantRecord.id,
        firstName: 'Jane',
        lastName: 'Doe',
        tenant: { id: tenantRecord.id, slug: tenantRecord.slug, name: tenantRecord.display_name, status: 'ACTIVE' },
        userRoles: [],
        branchAssignments: [],
      });
      mockTenantPrisma.$queryRaw.mockResolvedValueOnce([{ mustChangePassword: true }]);
      mockTenantPrisma.business.findFirst.mockResolvedValueOnce({ id: 'business-a' });

      const result = await service.login({
        email: 'owner@example.com',
        password: 'StrongPassword@123',
        tenantSlug: tenantRecord.slug,
      });

      expect(mockPrismaService.getClientForSchema).toHaveBeenCalledWith(tenantRecord.schema_name);
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(result).toEqual(expect.objectContaining({
        tenant: expect.objectContaining({ slug: tenantRecord.slug }),
        user: expect.objectContaining({ mustChangePassword: true }),
      }));
    });

    it('logs in without a slug when the credentials match one tenant account', async () => {
      const passwordHash = await bcrypt.hash('StrongPassword@123', 10);
      mockTenantDatabaseService.withTenant.mockImplementation(
        (_context: unknown, callback: (tx: unknown) => unknown) =>
          callback({
            queryOne: jest.fn().mockResolvedValue({
              tenant_id: tenantRecord.id,
              password_hash: passwordHash,
              is_active: true,
            }),
          })
      );
      mockTenantPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'tenant-user-1',
        email: 'owner@example.com',
        passwordHash,
        isActive: true,
        tenantId: tenantRecord.id,
        firstName: 'Jane',
        lastName: 'Doe',
        tenant: { id: tenantRecord.id, slug: tenantRecord.slug, name: tenantRecord.display_name, status: 'ACTIVE' },
        userRoles: [],
        branchAssignments: [],
      });
      mockTenantPrisma.$queryRaw.mockResolvedValueOnce([{ mustChangePassword: false }]);
      mockTenantPrisma.business.findFirst.mockResolvedValueOnce({ id: 'business-a' });

      const result = await service.login({
        email: 'owner@example.com',
        password: 'StrongPassword@123',
      });

      expect(mockPrismaService.getClientForSchema).toHaveBeenCalledWith(tenantRecord.schema_name);
      expect(result).toEqual(expect.objectContaining({
        tenant: expect.objectContaining({ slug: tenantRecord.slug }),
      }));
    });

    it('rejects credentials that do not match any tenant without requesting a workspace', async () => {
      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'WrongPassword@123',
        })
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.getClientForSchema).not.toHaveBeenCalled();
    });

    it('asks for a workspace when valid credentials match multiple tenant accounts', async () => {
      const anotherTenant = {
        ...tenantRecord,
        id: 'tenant-2',
        slug: 'workspace-b',
        display_name: 'Workspace B',
        schema_name: 't_bbbbbbbbbbbb',
      };
      const passwordHash = await bcrypt.hash('StrongPassword@123', 10);
      mockTenantDatabaseService.withPlatform.mockImplementation((callback: (tx: unknown) => unknown) =>
        callback({
          queryOne: jest.fn().mockResolvedValue(null),
          query: jest.fn((sql: string, params?: unknown[]) =>
            Promise.resolve(
              sql.includes('LEFT JOIN platform.tenant_domains') && !params?.some(Boolean)
                ? []
                : [tenantRecord, anotherTenant]
            )
          ),
        })
      );
      mockTenantDatabaseService.withTenant.mockImplementation(
        (context: { tenantId: string }, callback: (tx: unknown) => unknown) =>
          callback({
            queryOne: jest.fn().mockResolvedValue({
              tenant_id: context.tenantId,
              password_hash: passwordHash,
              is_active: true,
            }),
          })
      );

      const result = await service.login({
        email: 'owner@example.com',
        password: 'StrongPassword@123',
      });

      expect(result).toEqual({
        workspaceSelectionRequired: true,
        workspaces: [
          { slug: tenantRecord.slug, displayName: tenantRecord.display_name },
          { slug: anotherTenant.slug, displayName: anotherTenant.display_name },
        ],
      });
      expect(mockPrismaService.getClientForSchema).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const hash = await bcrypt.hash('CorrectPassword', 10);
      mockTenantPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@testcorp.com',
        passwordHash: hash,
        isActive: true,
        tenantId: tenantRecord.id,
        tenant: { status: 'ACTIVE' },
        userRoles: [],
        branchAssignments: [],
      });

      await expect(
        service.login({
          email: 'admin@testcorp.com',
          password: 'WrongPassword',
          tenantSlug: tenantRecord.slug,
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('does not query tenant users when the workspace is suspended', async () => {
      mockTenantDatabaseService.withPlatform.mockImplementation((callback: (tx: unknown) => unknown) =>
        callback({
          queryOne: jest.fn().mockResolvedValue(null),
          query: jest.fn().mockResolvedValue([{ ...tenantRecord, status: 'suspended' }]),
        })
      );

      await expect(
        service.login({
          email: 'admin@testcorp.com',
          password: 'Password@123',
          tenantSlug: tenantRecord.slug,
        })
      ).rejects.toThrow(UnauthorizedException);
      expect(mockPrismaService.getClientForSchema).not.toHaveBeenCalled();
    });

    describe('changePassword', () => {
      it('allows a user with a temporary password to set a new password without the temporary password', async () => {
        const passwordHash = await bcrypt.hash('Temporary@123', 10);
        mockPrismaService.$queryRaw.mockResolvedValueOnce([{
          id: 'user-1',
          passwordHash,
          mustChangePassword: true,
          isActive: true,
        }]);
        mockPrismaService.$executeRaw.mockResolvedValueOnce(1);

        await expect(
          service.changePassword('user-1', { newPassword: 'NewPassword@123' })
        ).resolves.toEqual({ success: true });
        expect(mockPrismaService.$executeRaw).toHaveBeenCalled();
      });

      it('requires the current password for a regular password change', async () => {
        mockPrismaService.$queryRaw.mockResolvedValueOnce([{
          id: 'user-1',
          passwordHash: await bcrypt.hash('Current@123', 10),
          mustChangePassword: false,
          isActive: true,
        }]);

        await expect(
          service.changePassword('user-1', { newPassword: 'NewPassword@123' })
        ).rejects.toThrow('Current password is required');
      });
    });
  });
});
