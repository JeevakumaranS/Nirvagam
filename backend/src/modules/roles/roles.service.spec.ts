import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDatabaseService } from '../../tenancy/tenant-database.service';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  const roleId = '018f47a0-3f21-7cc2-98d1-6f4a768aef23';
  const permissionId = '018f47a0-3f21-7cc2-98d1-6f4a768aef24';
  const businessId = '018f47a0-3f21-7cc2-98d1-6f4a768aef25';
  const predefinedRole = {
    id: roleId,
    name: 'ACCOUNTANT',
    description: 'Accounting access',
    businessId: null,
    isSystem: true,
  };
  const customRole = {
    id: roleId,
    name: 'Regional Manager',
    description: 'Branch access',
    businessId,
    isSystem: false,
  };

  let service: RolesService;
  let prisma: any;
  let transaction: any;

  beforeEach(() => {
    transaction = {
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue(predefinedRole),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...predefinedRole,
          rolePermissions: [],
        }),
        create: jest.fn().mockResolvedValue(customRole),
        update: jest.fn().mockResolvedValue(customRole),
        delete: jest.fn().mockResolvedValue(customRole),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([{ id: permissionId }]),
      },
      userRole: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    prisma = {
      role: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([{ id: permissionId }]),
      },
      $transaction: jest.fn((callback) => callback(transaction)),
    };
    service = new RolesService(
      prisma as PrismaService,
      {} as TenantDatabaseService
    );
  });

  it('lists global predefined roles and only the requested business roles', async () => {
    await service.findAll(businessId);

    expect(prisma.role.findMany).toHaveBeenCalledWith({
      where: {
        name: { not: 'SUPER_ADMIN' },
        OR: [
          { isSystem: true, businessId: null },
          { businessId },
        ],
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  });

  it('replaces permissions for a predefined role', async () => {
    await expect(
      service.updateRolePermissions(roleId, businessId, [permissionId])
    ).resolves.toMatchObject({ id: roleId });

    expect(transaction.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId } });
    expect(transaction.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId, permissionId }],
    });
  });

  it('rejects duplicate permission IDs before opening a transaction', async () => {
    await expect(
      service.updateRolePermissions(roleId, businessId, [permissionId, permissionId])
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects permission IDs that do not exist without replacing grants', async () => {
    transaction.permission.findMany.mockResolvedValue([]);

    await expect(
      service.updateRolePermissions(roleId, businessId, [permissionId])
    ).rejects.toThrow(BadRequestException);
    expect(transaction.rolePermission.deleteMany).not.toHaveBeenCalled();
  });

  it('does not allow modifying a role outside the business or predefined scope', async () => {
    transaction.role.findFirst.mockResolvedValue(null);

    await expect(
      service.updateRolePermissions(roleId, businessId, [permissionId])
    ).rejects.toThrow(NotFoundException);
    expect(transaction.rolePermission.deleteMany).not.toHaveBeenCalled();
  });

  it('creates a custom role in the current business', async () => {
    transaction.role.findFirst.mockResolvedValue(null);
    transaction.role.create.mockResolvedValue(customRole);
    transaction.role.findUniqueOrThrow.mockResolvedValue({
      ...customRole,
      rolePermissions: [],
    });

    await service.createBusinessRole(businessId, {
      name: 'Regional Manager',
      description: 'Branch access',
    });

    expect(transaction.role.create).toHaveBeenCalledWith({
      data: {
        businessId,
        name: 'Regional Manager',
        description: 'Branch access',
        isSystem: false,
      },
    });
  });

  it('reserves predefined role names for global roles', async () => {
    transaction.role.findMany.mockResolvedValue([{ name: 'BUSINESS_OWNER' }]);

    await expect(
      service.createBusinessRole(businessId, { name: 'Business Owner' })
    ).rejects.toThrow(ConflictException);
    expect(transaction.role.create).not.toHaveBeenCalled();
  });

  it('does not allow renaming predefined role identifiers', async () => {
    await expect(
      service.updateRole(roleId, businessId, { name: 'Finance Lead' })
    ).rejects.toThrow(BadRequestException);
    expect(transaction.role.update).not.toHaveBeenCalled();
  });

  it('prevents deleting roles assigned to users', async () => {
    transaction.userRole.count.mockResolvedValue(1);

    await expect(service.deleteRole(roleId, businessId)).rejects.toThrow(ConflictException);
    expect(transaction.role.delete).not.toHaveBeenCalled();
  });

  it('deletes an unassigned role', async () => {
    transaction.role.findFirst.mockResolvedValue(customRole);

    await expect(service.deleteRole(roleId, businessId)).resolves.toEqual({ id: roleId });
    expect(transaction.role.delete).toHaveBeenCalledWith({ where: { id: roleId } });
  });
});
