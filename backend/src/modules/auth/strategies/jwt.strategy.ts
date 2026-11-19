import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { JwtPayload, AuthUser } from '@nirvagam/shared';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'nirvagam_jwt_super_secret_key_production_grade_at_least_32_characters',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        branchAssignments: {
          where: { isDefault: true },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account not found or deactivated');
    }

    const roles: string[] = user.userRoles.map((ur) => ur.role.name);
    const permissionsSet = new Set<string>();

    for (const ur of user.userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissionsSet.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }

    const defaultBranchId = user.branchAssignments[0]?.branchId || payload.branchId;

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      tenantId: user.tenantId,
      businessId: payload.businessId,
      branchId: defaultBranchId,
      roles,
      permissions: Array.from(permissionsSet),
    };
  }
}
