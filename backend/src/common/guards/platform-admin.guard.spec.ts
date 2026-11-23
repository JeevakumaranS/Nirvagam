import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

describe('PlatformAdminGuard', () => {
  const guard = new PlatformAdminGuard();

  const contextFor = (user?: { platformAdmin?: boolean; roles?: string[] }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('allows authenticated platform administrators', () => {
    expect(guard.canActivate(contextFor({ platformAdmin: true }))).toBe(true);
  });

  it('rejects users who only have a super-admin-looking role', () => {
    expect(() =>
      guard.canActivate(contextFor({ platformAdmin: false, roles: ['SUPER_ADMIN'] }))
    ).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });
});
