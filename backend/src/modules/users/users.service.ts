import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginationParams } from '@nirvagam/shared';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string, params: PaginationParams) {
    if (!tenantId) {
      return { items: [], total: 0, page: 1, limit: 20, totalPages: 0 };
    }

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

  async create(tenantId: string, businessId: string, dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });
    if (existing) {
      throw new ConflictException(`User with email "${dto.email}" already exists`);
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const memberType = dto.memberType || 'EMPLOYEE';
      const branchIds = dto.branchIds || [];
      if (!['OWNER', 'MANAGER', 'EMPLOYEE'].includes(memberType)) {
        throw new BadRequestException('Invalid team member position type');
      }
      if (!branchIds.length) {
        throw new BadRequestException('A branch assignment is required for a team member');
      }
      if (memberType === 'OWNER' && branchIds.length !== 1) {
        throw new BadRequestException('An owner must be assigned to exactly one branch');
      }

      const branches = await tx.branch.findMany({
        where: { id: { in: branchIds }, businessId },
        select: {
          id: true,
          ownerId: true,
          userAssignments: {
            select: {
              user: {
                select: {
                  id: true,
                  isActive: true,
                  memberType: true,
                  userRoles: {
                    select: { role: { select: { name: true } } },
                  },
                },
              },
            },
          },
        },
      });
      if (branches.length !== branchIds.length) {
        throw new BadRequestException('One or more branches are not available to this business');
      }

      const existingOwnerIds = branches.map((branch) => {
        const ownerMember = branch.userAssignments.find(
          ({ user }) =>
            user.isActive &&
            (user.memberType === 'OWNER' ||
              user.userRoles.some((userRole) => userRole.role.name === 'BUSINESS_OWNER'))
        );
        return branch.ownerId || ownerMember?.user.id || null;
      });

      if (memberType === 'OWNER' && existingOwnerIds[0]) {
        throw new ConflictException('This branch already has an owner');
      }
      if (memberType !== 'OWNER' && existingOwnerIds.some((ownerId) => !ownerId)) {
        throw new BadRequestException('Create a branch owner before adding managers or employees');
      }

      let roleIds = dto.roleIds || [];
      if (memberType === 'OWNER') {
        const ownerRole = await tx.role.findFirst({
          where: { name: 'BUSINESS_OWNER', isSystem: true, businessId: null },
          select: { id: true },
        });
        if (!ownerRole) {
          throw new BadRequestException(
            'Business Owner role is not initialized; contact an administrator'
          );
        }
        roleIds = [ownerRole.id];
      }

      await this.validateRoleIds(tx, businessId, roleIds);
      const user = await tx.user.create({
        data: {
          tenantId,
          email: dto.email.toLowerCase().trim(),
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          reportsToId: memberType === 'OWNER' ? null : dto.reportsToId || null,
          team: memberType === 'OWNER' ? null : dto.team || null,
          designation: dto.designation || null,
          memberType,
          status: dto.status || 'ACTIVE',
          ...(dto.joiningDate ? { joiningDate: new Date(dto.joiningDate) } : {}),
        },
      });

      if (roleIds.length > 0) {
        for (const roleId of roleIds) {
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

      if (memberType === 'OWNER') {
        const ownerAssignment = await tx.branch.updateMany({
          where: { id: branchIds[0], businessId, ownerId: null },
          data: { ownerId: user.id },
        });
        if (ownerAssignment.count !== 1) {
          throw new ConflictException('This branch already has an owner');
        }
      }

      const { passwordHash: _, ...result } = user;
      return result;
    });
  }

  async update(tenantId: string, businessId: string, userId: string, dto: UpdateUserDto) {
    await this.findOne(tenantId, userId);

    return this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await this.validateRoleIds(tx, businessId, dto.roleIds);
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          ...(dto.firstName && { firstName: dto.firstName }),
          ...(dto.lastName && { lastName: dto.lastName }),
          ...(dto.phone !== undefined && { phone: dto.phone }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.reportsToId !== undefined && { reportsToId: dto.reportsToId || null }),
          ...(dto.team !== undefined && { team: dto.team || null }),
          ...(dto.designation !== undefined && { designation: dto.designation || null }),
          ...(dto.memberType !== undefined && { memberType: dto.memberType }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.joiningDate ? { joiningDate: new Date(dto.joiningDate) } : {}),
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
    return this.prisma.$transaction(async (tx) => {
      await tx.branch.updateMany({
        where: { ownerId: userId },
        data: { ownerId: null },
      });
      return tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
    });
  }

  private async validateRoleIds(
    tx: Prisma.TransactionClient,
    businessId: string,
    roleIds: string[]
  ) {
    if (new Set(roleIds).size !== roleIds.length) {
      throw new BadRequestException('Duplicate role IDs are not allowed');
    }

    if (!roleIds.length) {
      return;
    }

    const roles = await tx.role.findMany({
      where: {
        id: { in: roleIds },
        OR: [
          { isSystem: true, businessId: null },
          ...(businessId ? [{ businessId }] : []),
        ],
      },
      select: { id: true },
    });

    if (roles.length !== roleIds.length) {
      throw new BadRequestException('One or more roles are not available to this business');
    }
  }

  async getBranchHierarchy(tenantId: string) {
    if (!tenantId) {
      return [];
    }

    const businesses = await this.prisma.business.findMany({
      where: { tenantId, isActive: true },
      select: { id: true, tradeName: true, legalName: true },
    });
    const businessIds = businesses.map((b) => b.id);
    if (!businessIds.length) {
      return [];
    }

    const branches = await this.prisma.branch.findMany({
      where: { businessId: { in: businessIds }, isActive: true },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            designation: true,
            status: true,
            team: true,
            joiningDate: true,
            userRoles: { include: { role: true } },
          },
        },
        userAssignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatarUrl: true,
                isActive: true,
                status: true,
                team: true,
                designation: true,
                memberType: true,
                reportsToId: true,
                joiningDate: true,
                createdAt: true,
                userRoles: {
                  include: {
                    role: {
                      select: { id: true, name: true, description: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ isHeadOffice: 'desc' }, { name: 'asc' }],
    });

    const getInitials = (first?: string | null, last?: string | null) => {
      const f = (first || '').trim().charAt(0).toUpperCase();
      const l = (last || '').trim().charAt(0).toUpperCase();
      return `${f}${l}` || 'U';
    };

    return branches.map((branch) => {
      // 1. Collect all distinct members assigned to this branch
      const rawMembers = branch.userAssignments
        .map((ua) => ua.user)
        .filter((u) => Boolean(u && u.isActive));

      const memberMap = new Map<string, (typeof rawMembers)[0]>();
      rawMembers.forEach((m) => memberMap.set(m.id, m));

      // 2. Resolve branch owner
      let ownerUser: any = branch.owner;
      if (!ownerUser && rawMembers.length > 0) {
        ownerUser =
          rawMembers.find(
            (m) =>
              m.memberType === 'OWNER' ||
              m.userRoles?.some((ur) => ur.role?.name === 'BUSINESS_OWNER')
          ) || null;
      }

      const ownerData = ownerUser
        ? {
            id: ownerUser.id,
            name: `${ownerUser.firstName} ${ownerUser.lastName}`.trim(),
            firstName: ownerUser.firstName,
            lastName: ownerUser.lastName,
            email: ownerUser.email,
            phone: ownerUser.phone || '',
            avatarUrl: ownerUser.avatarUrl,
            initials: getInitials(ownerUser.firstName, ownerUser.lastName),
            role: ownerUser.userRoles?.[0]?.role?.name || 'Branch Owner',
            designation: ownerUser.designation || 'Branch Owner / Director',
            status: (ownerUser.status as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE') || 'ACTIVE',
            joiningDate: ownerUser.joiningDate ? new Date(ownerUser.joiningDate).toISOString() : null,
          }
        : null;

      // 3. Build teams from non-owner members
      const nonOwnerMembers = rawMembers.filter((m) => !ownerUser || m.id !== ownerUser.id);

      const teamMembers = nonOwnerMembers.filter((m) => Boolean(m.team && m.team.trim()));
      const directMembersWithoutTeam = nonOwnerMembers.filter((m) => !m.team || !m.team.trim());

      const getCleanRoleName = (emp: any, isMgr: boolean) => {
        const rawRole = emp.userRoles?.[0]?.role?.name;
        if (rawRole) {
          return rawRole
            .replace(/_/g, ' ')
            .toLowerCase()
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
        return isMgr ? 'Manager' : 'Employee';
      };

      const checkIsManager = (m: any) => {
        return (
          m.memberType === 'MANAGER' ||
          rawMembers.some((sub) => sub.reportsToId === m.id && sub.id !== m.id) ||
          m.userRoles?.some((ur: any) => ur.role?.name.includes('MANAGER')) ||
          Boolean(m.designation && m.designation.toLowerCase().includes('manager'))
        );
      };
      const managersFirst = (a: any, b: any) =>
        Number(checkIsManager(b)) - Number(checkIsManager(a));

      // Group team-assigned members by team name
      const teamGroups = new Map<string, typeof teamMembers>();
      teamMembers.forEach((m) => {
        const teamName = m.team!.trim();
        if (!teamGroups.has(teamName)) {
          teamGroups.set(teamName, []);
        }
        teamGroups.get(teamName)!.push(m);
      });

      // Construct team hierarchy nodes
      const teamNodes: any[] = [];

      teamGroups.forEach((membersInTeam, teamName) => {
        // Build tree within this team
        const teamMemberMap = new Map(membersInTeam.map((m) => [m.id, m]));
        const visitedInTree = new Set<string>();

        const buildReportsTree = (managerId: string, currentPath: Set<string>): any[] => {
          const directReports = membersInTeam.filter(
            (m) => m.reportsToId === managerId && m.id !== managerId
          ).sort(managersFirst);

          return directReports
            .map((emp) => {
              if (currentPath.has(emp.id)) {
                return null; // cycle detected
              }
              visitedInTree.add(emp.id);

              const nextPath = new Set(currentPath);
              nextPath.add(emp.id);

              const isEmpManager = checkIsManager(emp);
              const children = buildReportsTree(emp.id, nextPath).filter(Boolean);

              const directMgr = teamMemberMap.get(managerId) || memberMap.get(managerId);
              const resolvedManagerName = directMgr
                ? `${directMgr.firstName} ${directMgr.lastName}`.trim()
                : (ownerData?.name || null);

              const formattedRole = getCleanRoleName(emp, isEmpManager);

              return {
                id: emp.id,
                nodeType: isEmpManager ? 'manager' : 'employee',
                name: `${emp.firstName} ${emp.lastName}`.trim(),
                role: formattedRole,
                designation: emp.designation || null,
                email: emp.email,
                phone: emp.phone || '',
                avatarUrl: emp.avatarUrl,
                initials: getInitials(emp.firstName, emp.lastName),
                status: (emp.status as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE') || (emp.isActive ? 'ACTIVE' : 'INACTIVE'),
                team: teamName,
                managerId,
                managerName: resolvedManagerName,
                ownerName: ownerData?.name || null,
                branchName: branch.name,
                branchId: branch.id,
                joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString() : null,
                memberCount: children.length || undefined,
                children,
              };
            })
            .filter(Boolean);
        };

        // Top-level members in this team (not reporting to someone else inside this same team)
        const topLevelMembers = membersInTeam.filter(
          (m) =>
            !m.reportsToId ||
            (ownerUser && m.reportsToId === ownerUser.id) ||
            !teamMemberMap.has(m.reportsToId)
        ).sort(managersFirst);

        const managerNodes: any[] = [];

        topLevelMembers.forEach((topMember) => {
          visitedInTree.add(topMember.id);
          const isManager = checkIsManager(topMember);
          const children = buildReportsTree(topMember.id, new Set([topMember.id])).filter(Boolean);

          const directMgr = topMember.reportsToId ? (teamMemberMap.get(topMember.reportsToId) || memberMap.get(topMember.reportsToId)) : null;
          const topManagerName = directMgr
            ? `${directMgr.firstName} ${directMgr.lastName}`.trim()
            : (ownerData?.name || null);

          const formattedRole = getCleanRoleName(topMember, isManager);

          managerNodes.push({
            id: topMember.id,
            nodeType: isManager ? 'manager' : 'employee',
            name: `${topMember.firstName} ${topMember.lastName}`.trim(),
            role: formattedRole,
            designation: topMember.designation || null,
            email: topMember.email,
            phone: topMember.phone || '',
            avatarUrl: topMember.avatarUrl,
            initials: getInitials(topMember.firstName, topMember.lastName),
            status: (topMember.status as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE') || (topMember.isActive ? 'ACTIVE' : 'INACTIVE'),
            team: teamName,
            managerId: topMember.reportsToId || null,
            managerName: topManagerName,
            ownerName: ownerData?.name || null,
            branchName: branch.name,
            branchId: branch.id,
            joiningDate: topMember.joiningDate ? new Date(topMember.joiningDate).toISOString() : null,
            memberCount: children.length || undefined,
            children,
          });
        });

        // Any leftover members from cycle or detached reference
        membersInTeam
          .filter((member) => !visitedInTree.has(member.id))
          .sort(managersFirst)
          .forEach((leftover) => {
            const isManager = checkIsManager(leftover);
            const directMgr = leftover.reportsToId ? (teamMemberMap.get(leftover.reportsToId) || memberMap.get(leftover.reportsToId)) : null;
            const leftoverMgrName = directMgr
              ? `${directMgr.firstName} ${directMgr.lastName}`.trim()
              : (ownerData?.name || null);

            const formattedRole = getCleanRoleName(leftover, isManager);

            managerNodes.push({
              id: leftover.id,
              nodeType: isManager ? 'manager' : 'employee',
              name: `${leftover.firstName} ${leftover.lastName}`.trim(),
              role: formattedRole,
              designation: leftover.designation || null,
              email: leftover.email,
              phone: leftover.phone || '',
              avatarUrl: leftover.avatarUrl,
              initials: getInitials(leftover.firstName, leftover.lastName),
              status: (leftover.status as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE') || (leftover.isActive ? 'ACTIVE' : 'INACTIVE'),
              team: teamName,
              managerId: leftover.reportsToId || null,
              managerName: leftoverMgrName,
              ownerName: ownerData?.name || null,
              branchName: branch.name,
              branchId: branch.id,
              joiningDate: leftover.joiningDate ? new Date(leftover.joiningDate).toISOString() : null,
              children: [],
            });
          });

        teamNodes.push({
          id: `team-${branch.id}-${teamName.toLowerCase().replace(/\s+/g, '-')}`,
          nodeType: 'team',
          name: teamName,
          role: 'Team',
          designation: `${membersInTeam.length} Members`,
          status: 'ACTIVE',
          initials: teamName.slice(0, 2).toUpperCase(),
          branchName: branch.name,
          branchId: branch.id,
          memberCount: membersInTeam.length,
          children: managerNodes,
        });
      });

      // Construct direct members without team (they report directly to the branch owner)
      const directNodes: any[] = [...directMembersWithoutTeam]
        .sort(managersFirst)
        .map((emp) => {
          const isManager = checkIsManager(emp);
          const formattedRole = getCleanRoleName(emp, isManager);
          return {
            id: emp.id,
            nodeType: isManager ? 'manager' : 'employee',
            name: `${emp.firstName} ${emp.lastName}`.trim(),
            role: formattedRole,
            designation: emp.designation || null,
            email: emp.email,
            phone: emp.phone || '',
            avatarUrl: emp.avatarUrl,
            initials: getInitials(emp.firstName, emp.lastName),
            status: (emp.status as 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE') || (emp.isActive ? 'ACTIVE' : 'INACTIVE'),
            team: null,
            managerId: ownerData?.id || null,
            managerName: ownerData?.name || null,
            ownerName: ownerData?.name || null,
            branchName: branch.name,
            branchId: branch.id,
            joiningDate: emp.joiningDate ? new Date(emp.joiningDate).toISOString() : null,
            children: [],
          };
        });

      // 4. Construct the branch root tree: Branch -> Owner -> (Teams + Direct Members)
      let branchTree: any[] = [];
      if (ownerData) {
        branchTree = [
          {
            id: ownerData.id,
            nodeType: 'owner',
            name: ownerData.name,
            role: 'Branch Owner',
            designation: ownerData.designation,
            email: ownerData.email,
            phone: ownerData.phone,
            avatarUrl: ownerData.avatarUrl,
            initials: ownerData.initials,
            status: ownerData.status,
            branchName: branch.name,
            branchId: branch.id,
            joiningDate: ownerData.joiningDate,
            children: [...teamNodes, ...directNodes],
          },
        ];
      } else {
        branchTree = [...teamNodes, ...directNodes];
      }

      const distinctTeams = new Set(
        teamMembers.map((m) => m.team?.trim()).filter(Boolean)
      );

      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        city: branch.city,
        state: branch.state,
        location: `${branch.city}, ${branch.state}`,
        isHeadOffice: branch.isHeadOffice,
        memberCount: rawMembers.length,
        teamCount: distinctTeams.size,
        owner: ownerData,
        tree: branchTree,
      };
    });
  }
}
