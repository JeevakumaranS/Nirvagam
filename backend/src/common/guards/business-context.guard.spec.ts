import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { BusinessContextGuard } from './business-context.guard';

describe('BusinessContextGuard', () => {
  const guard = new BusinessContextGuard();

  const contextFor = (user?: { businessId?: string; platformAdmin?: boolean }) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as ExecutionContext;

  it('allows users with a valid business context', () => {
    expect(guard.canActivate(contextFor({ businessId: '018f47a0-3f21-7cc2-98d1-6f4a768aef23' }))).toBe(true);
  });

  it.each([
    undefined,
    { businessId: '' },
    { businessId: 'not-a-uuid' },
    { businessId: '018f47a0-3f21-7cc2-98d1-6f4a768aef23', platformAdmin: true },
  ])('rejects requests without a usable business context', (user) => {
    expect(() => guard.canActivate(contextFor(user))).toThrow(ForbiddenException);
  });
});
