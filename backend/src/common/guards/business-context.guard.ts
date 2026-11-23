import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { AuthUser } from '@nirvagam/shared';

@Injectable()
export class BusinessContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    const businessId = request.user?.businessId;

    if (request.user?.platformAdmin || !businessId || !isUUID(businessId)) {
      throw new ForbiddenException('An active business context is required');
    }

    return true;
  }
}
