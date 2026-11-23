import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  const contextFor = (user: { roles: string[]; permissions: string[] }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('enforces explicit permissions for business owners', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['customer:create']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(() =>
      guard.canActivate(contextFor({ roles: ['BUSINESS_OWNER'], permissions: [] }))
    ).toThrow(ForbiddenException);
  });

  it('allows requests when all required permissions are granted', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['customer:view']),
    } as unknown as Reflector;
    const guard = new PermissionsGuard(reflector);

    expect(
      guard.canActivate(contextFor({ roles: ['BUSINESS_ADMIN'], permissions: ['customer:view'] }))
    ).toBe(true);
  });
});
