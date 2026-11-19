import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationParams } from '@nirvagam/shared';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, params: PaginationParams) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(params.search && {
        OR: [
          { email: { contains: params.search, mode: 'insensitive' } },
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          isActive: true,
          createdAt: true,
          userRoles: {
            select: {
              role: {
                select: { id: true, name: true, description: true },
              },
            },
          },
          branchAssignments: {
            select: {
              isDefault: true,
              branch: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  }

  async findOne(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        userRoles: { include: { role: true } },
        branchAssignments: { include: { branch: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const { passwordHash, ...cleanUser } = user;
    return cleanUser;
  }

  async create(tenantId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictException(`User with email "${dto.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId,
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
        },
      });

      if (dto.roleIds && dto.roleIds.length > 0) {
        for (const roleId of dto.roleIds) {
          await tx.userRole.create({
            data: { userId: user.id, roleId },
          });
        }
      }

      if (dto.branchIds && dto.branchIds.length > 0) {
        for (let i = 0; i < dto.branchIds.length; i++) {
          await tx.userBranchAssignment.create({
            data: {
              userId: user.id,
              branchId: dto.branchIds[i],
              isDefault: i === 0,
            },
          });
        }
      }

      const { passwordHash: _, ...result } = user;
      return result;
    });
  }

  async update(tenantId: string, userId: string, dto: UpdateUserDto) {
    await this.findOne(tenantId, userId);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...(dto.firstName && { firstName: dto.firstName }),
          ...(dto.lastName && { lastName: dto.lastName }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId } });
        for (const roleId of dto.roleIds) {
          await tx.userRole.create({ data: { userId, roleId } });
        }
      }

      if (dto.branchIds) {
        await tx.userBranchAssignment.deleteMany({ where: { userId } });
        for (let i = 0; i < dto.branchIds.length; i++) {
          await tx.userBranchAssignment.create({
            data: { userId, branchId: dto.branchIds[i], isDefault: i === 0 },
          });
        }
      }

      const { passwordHash: _, ...result } = updated;
      return result;
    });
  }

  async deactivate(tenantId: string, userId: string) {
    await this.findOne(tenantId, userId);
    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });
  }
}
