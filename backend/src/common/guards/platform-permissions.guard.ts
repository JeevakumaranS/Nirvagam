import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthUser, UserRoleName } from '@nirvagam/shared';
import { TenantDatabaseService } from '../../tenancy/tenant-database.service';
import { PLATFORM_PERMISSIONS_KEY } from '../decorators/platform-permissions.decorator';

@Injectable()
export class PlatformPermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly tenantDb: TenantDatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PLATFORM_PERMISSIONS_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required?.length) return true;
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user?.platformAdmin) throw new ForbiddenException('Platform administrator access required');
    if (user.roles.includes(UserRoleName.SUPER_ADMIN) || user.roles.includes('PLATFORM_SUPER_ADMIN')) return true;

    const role = user.roles[0];
    const rows = await this.tenantDb.withPlatform((tx) => tx.query<{ permission_key: string }>(
      `SELECT p.permission_key FROM platform.platform_role_permissions rpp
       JOIN platform.platform_roles r ON r.id = rpp.role_id
       JOIN platform.platform_permissions p ON p.id = rpp.permission_id
       WHERE r.role_key = $1`, [role]
    ));
    const granted = new Set(rows.map((row) => row.permission_key));
    if (!required.every((permission) => granted.has(permission))) {
      throw new ForbiddenException(`Missing platform permission: ${required.join(', ')}`);
    }
    return true;
  }
}
