import { ForbiddenException, Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  async canActivate(context: ExecutionContext) {
    const authenticated = await super.canActivate(context);
    if (!authenticated) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const path = request.originalUrl?.split('?')[0] || '';
    const passwordSetupRoute =
      (request.method === 'POST' && path.endsWith('/auth/change-password')) ||
      (request.method === 'GET' && path.endsWith('/auth/me'));
    if (user?.mustChangePassword && !passwordSetupRoute) {
      throw new ForbiddenException('You must change your temporary password before using the workspace');
    }
    return true;
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication token is invalid or expired');
    }
    return user;
  }
}
