import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
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
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock_token'),
    verify: jest.fn(),
  };

  const mockTenantDatabaseService = {
    withPlatform: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test_jwt_secret';
      if (key === 'JWT_REFRESH_SECRET') return 'test_jwt_refresh_secret';
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
    mockTenantDatabaseService.withPlatform.mockImplementation((callback: (tx: unknown) => unknown) =>
      callback({ queryOne: jest.fn().mockResolvedValue(null) })
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should throw ConflictException if slug already exists', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValueOnce({ id: 'tenant-1' });

      await expect(
        service.register({
          companyName: 'Test Corp',
          slug: 'testcorp',
          email: 'admin@testcorp.com',
          password: 'Password@123',
          firstName: 'John',
          lastName: 'Doe',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if user email already exists', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({ id: 'user-1' });

      await expect(
        service.register({
          companyName: 'Test Corp',
          slug: 'testcorp',
          email: 'admin@testcorp.com',
          password: 'Password@123',
          firstName: 'John',
          lastName: 'Doe',
        })
      ).rejects.toThrow(ConflictException);
    });

    it('should successfully register a new organization and return tokens', async () => {
      mockPrismaService.tenant.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);
      mockPrismaService.tenant.create.mockResolvedValueOnce({
        id: 'new-tenant-id',
        slug: 'testcorp',
        name: 'Test Corp',
      });
      mockPrismaService.plan.findUnique.mockResolvedValueOnce({ id: 'plan-business' });
      mockPrismaService.business.create.mockResolvedValueOnce({
        id: 'new-business-id',
        legalName: 'Test Corp',
      });
      mockPrismaService.branch.create.mockResolvedValueOnce({
        id: 'new-branch-id',
        name: 'Head Office',
      });
      mockPrismaService.role.findFirst.mockResolvedValueOnce({ id: 'role-owner' });
      mockPrismaService.user.create.mockResolvedValueOnce({
        id: 'new-user-id',
        email: 'admin@testcorp.com',
        firstName: 'John',
        lastName: 'Doe',
      });

      const result = await service.register({
        companyName: 'Test Corp',
        slug: 'testcorp',
        email: 'admin@testcorp.com',
        password: 'Password@123',
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(result.tenant.id).toBe('new-tenant-id');
      expect(result.user.email).toBe('admin@testcorp.com');
      expect(result.accessToken).toBe('mock_token');
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

      expect(result.user.roles).toContain('SUPER_ADMIN');
      expect(result.tenant).toBeNull();
      expect(result.activeBusiness).toBeNull();
      expect(mockPrismaService.user.findUnique).not.toHaveBeenCalled();
      expect(mockJwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({ platformAdmin: true, sub: 'platform-identity-1' }),
        expect.any(Object)
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({
          email: 'unknown@testcorp.com',
          password: 'Password@123',
        })
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException on invalid password', async () => {
      const hash = await bcrypt.hash('CorrectPassword', 10);
      mockPrismaService.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'admin@testcorp.com',
        passwordHash: hash,
        isActive: true,
        tenant: { status: 'ACTIVE' },
        userRoles: [],
        branchAssignments: [],
      });

      await expect(
        service.login({
          email: 'admin@testcorp.com',
          password: 'WrongPassword',
        })
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
