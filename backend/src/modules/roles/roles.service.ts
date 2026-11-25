import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantDatabaseService } from '../../tenancy/tenant-database.service';
import { TenantContextStorage } from '../../tenancy/tenant-context.storage';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantDb: TenantDatabaseService
  ) {}

  async findAll(businessId?: string) {
    const tenantCtx = TenantContextStorage.tryGet();

    // 1. If running inside TenantContext: execute strictly inside the tenant schema
    if (tenantCtx) {
      return await this.tenantDb.withTenant(tenantCtx, async (tx) => {
        // Query tenant roles (SUPER_ADMIN lives exclusively in platform schema and is never listed)
        const roles = await tx.query<any>(
          `SELECT id, name, description, is_system as "isSystem", created_at as "createdAt"
           FROM roles
           WHERE name != 'SUPER_ADMIN'
           ORDER BY is_system DESC, name ASC;`
        );

        // Fetch mapped permissions for each role
        for (const r of roles) {
          const perms = await tx.query<any>(
            `SELECT p.id, p.resource, p.action, p.description
             FROM role_permissions rp
             JOIN permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = $1
             ORDER BY p.resource ASC, p.action ASC;`,
            [r.id]
          );

          r.rolePermissions = perms.map((p) => ({
            roleId: r.id,
            permissionId: p.id,
            permission: {
              id: p.id,
              resource: p.resource,
              action: p.action,
              description: p.description,
            },
          }));
        }

        return roles;
      });
    }

    // 2. Fallback for platform / public fallback (excluding SUPER_ADMIN from tenant listing)
    return this.prisma.role.findMany({
      where: {
        name: { not: 'SUPER_ADMIN' },
        OR: [
          { isSystem: true, businessId: null },
          ...(businessId ? [{ businessId }] : []),
        ],
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getAllPermissions() {
    const tenantCtx = TenantContextStorage.tryGet();

    if (tenantCtx) {
      return await this.tenantDb.withTenant(tenantCtx, async (tx) => {
        const permissions = await tx.query<any>(
          `SELECT id, resource, action, description
           FROM permissions
           ORDER BY resource ASC, action ASC;`
        );

        const grouped: Record<string, any[]> = {};
        for (const p of permissions) {
          if (!grouped[p.resource]) {
            grouped[p.resource] = [];
          }
          grouped[p.resource].push(p);
        }
        return grouped;
      });
    }

    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    const grouped: Record<string, any[]> = {};
    for (const p of permissions) {
      if (!grouped[p.resource]) {
        grouped[p.resource] = [];
      }
      grouped[p.resource].push(p);
    }

    return grouped;
  }

  async createBusinessRole(businessId: string, dto: CreateRoleDto) {
    if (!businessId) {
      throw new BadRequestException('An active business is required to create a role');
    }

    const name = dto.name.trim();
    return this.prisma.$transaction(async (tx) => {
      await this.assertRoleNameAvailable(tx, businessId, name);
      const role = await tx.role.create({
        data: {
          businessId,
          name,
          description: dto.description?.trim() || null,
          isSystem: false,
        },
      });

      return tx.role.findUniqueOrThrow({
        where: { id: role.id },
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  async updateRole(roleId: string, businessId: string, dto: UpdateRoleDto) {
    return this.prisma.$transaction(async (tx) => {
      const role = await this.findEditableRole(tx, roleId, businessId);
      if (!role) {
        throw new NotFoundException('Role not found');
      }

      const data: Prisma.RoleUpdateInput = {};
      if (dto.name !== undefined) {
        const name = dto.name.trim();
        if (role.isSystem && name !== role.name) {
          throw new BadRequestException('Predefined role names cannot be changed');
        }
        if (!role.isSystem && name !== role.name) {
          await this.assertRoleNameAvailable(tx, businessId, name, roleId);
          data.name = name;
        }
      }
      if (dto.description !== undefined) {
        data.description = dto.description?.trim() || null;
      }

      return tx.role.update({
        where: { id: roleId },
        data,
        include: { rolePermissions: { include: { permission: true } } },
      });
    });
  }

  async updateRolePermissions(roleId: string, businessId: string, permissionIds: string[]) {
    if (new Set(permissionIds).size !== permissionIds.length) {
      throw new BadRequestException('Duplicate permission IDs are not allowed');
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await this.findEditableRole(tx, roleId, businessId);
      if (!role) {
        throw new NotFoundException('Role not found');
      }

      const permissions = await tx.permission.findMany({
        where: { id: { in: permissionIds } },
        select: { id: true },
      });
      if (permissions.length !== permissionIds.length) {
        throw new BadRequestException('One or more permissions do not exist');
      }

      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        });
      }

      return tx.role.findUniqueOrThrow({
        where: { id: roleId },
        include: {
          rolePermissions: {
            include: { permission: true },
          },
        },
      });
    });
  }

  async deleteRole(roleId: string, businessId: string) {
    return this.prisma.$transaction(async (tx) => {
      const role = await this.findEditableRole(tx, roleId, businessId);
      if (!role) {
        throw new NotFoundException('Role not found');
      }

      const assignmentCount = await tx.userRole.count({ where: { roleId } });
      if (assignmentCount > 0) {
        throw new ConflictException('Role cannot be deleted while it is assigned to users');
      }

      await tx.role.delete({ where: { id: roleId } });
      return { id: roleId };
    });
  }

  private async findEditableRole(
    tx: Prisma.TransactionClient,
    roleId: string,
    businessId: string
  ) {
    return tx.role.findFirst({
      where: {
        id: roleId,
        name: { not: 'SUPER_ADMIN' },
        OR: [
          { isSystem: true, businessId: null },
          ...(businessId ? [{ businessId }] : []),
        ],
      },
    });
  }

  private async assertRoleNameAvailable(
    tx: Prisma.TransactionClient,
    businessId: string,
    name: string,
    exceptRoleId?: string
  ) {
    if (!name) {
      throw new BadRequestException('Role name is required');
    }

    const normalizedName = this.normalizeRoleName(name);
    const systemRoles = await tx.role.findMany({
      where: { isSystem: true, businessId: null },
      select: { name: true },
    });
    if (systemRoles.some((role) => this.normalizeRoleName(role.name) === normalizedName)) {
      throw new ConflictException('Role name is reserved for a predefined role');
    }

    const existingRole = await tx.role.findFirst({
      where: {
        businessId,
        ...(exceptRoleId ? { id: { not: exceptRoleId } } : {}),
        name: { equals: name, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existingRole) {
      throw new ConflictException(`A role named "${name}" already exists`);
    }
  }

  private normalizeRoleName(name: string) {
    return name.trim().replace(/[\s-]+/g, '_').toUpperCase();
  }
}
