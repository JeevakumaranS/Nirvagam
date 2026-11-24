import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '@nirvagam/shared';

@Injectable()
export class PlatformSuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
    if (!user?.platformAdmin || !user.roles?.some((role) => role === 'SUPER_ADMIN' || role === 'PLATFORM_SUPER_ADMIN')) {
      throw new ForbiddenException('This endpoint is restricted to Platform Super Admins');
    }
    return true;
  }
}
