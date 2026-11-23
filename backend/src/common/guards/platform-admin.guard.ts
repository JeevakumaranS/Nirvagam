import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { AuthUser } from '@nirvagam/shared';

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (!request.user?.platformAdmin) {
      throw new ForbiddenException('This endpoint is restricted to platform administrators');
    }
    return true;
  }
}
