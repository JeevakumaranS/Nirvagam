import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UsersService } from './users.service';

describe('UsersService.create', () => {
  let service: UsersService;
  let prisma: any;
  let tx: any;

  const ownerlessBranch = {
    id: 'branch-id',
    ownerId: null,
    userAssignments: [],
  };
  const dto = (memberType: CreateUserDto['memberType']): CreateUserDto => ({
    email: 'member@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'Member',
    roleIds: [],
    branchIds: ['branch-id'],
    memberType,
  });

  beforeEach(() => {
    tx = {
      branch: {
        findMany: jest.fn().mockResolvedValue([ownerlessBranch]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 'business-owner-role-id' }),
        findMany: jest.fn().mockResolvedValue([{ id: 'business-owner-role-id' }]),
      },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'new-user-id',
          email: 'member@example.com',
          passwordHash: 'hashed-password',
        }),
      },
      userBranchAssignment: {
        create: jest.fn().mockResolvedValue({}),
      },
      userRole: {
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (transaction: any) => unknown) =>
        callback(tx),
      ),
    };
    service = new UsersService(prisma as PrismaService);
  });

  it('sets the newly created owner as the branch owner', async () => {
    const result = await service.create('tenant-id', 'business-id', dto('OWNER'));

    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          memberType: 'OWNER',
          reportsToId: null,
          team: null,
        }),
      }),
    );
    expect(tx.branch.updateMany).toHaveBeenCalledWith({
      where: { id: 'branch-id', businessId: 'business-id', ownerId: null },
      data: { ownerId: 'new-user-id' },
    });
    expect(tx.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'new-user-id', roleId: 'business-owner-role-id' },
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('blocks managers and employees until the branch has an owner', async () => {
    await expect(
      service.create('tenant-id', 'business-id', dto('MANAGER')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create('tenant-id', 'business-id', dto('EMPLOYEE')),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('prevents creating a second branch owner', async () => {
    tx.branch.findMany.mockResolvedValue([
      { ...ownerlessBranch, ownerId: 'existing-owner-id' },
    ]);

    await expect(
      service.create('tenant-id', 'business-id', dto('OWNER')),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.create).not.toHaveBeenCalled();
  });
});

describe('UsersService.deactivate', () => {
  it('clears branch ownership before deactivating the user', async () => {
    const tx = {
      branch: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { update: jest.fn().mockResolvedValue({ id: 'owner-id', isActive: false }) },
    };
    const prisma: any = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'owner-id',
          passwordHash: 'secret',
        }),
      },
      $transaction: jest.fn((callback: (transaction: any) => unknown) =>
        callback(tx),
      ),
    };
    const service = new UsersService(prisma as PrismaService);

    await service.deactivate('tenant-id', 'owner-id');

    expect(tx.branch.updateMany).toHaveBeenCalledWith({
      where: { ownerId: 'owner-id' },
      data: { ownerId: null },
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-id' },
      data: { isActive: false },
    });
  });
});