import { ExecutionContext, HttpException } from '@nestjs/common';
import { TenantCacheService } from '../tenant-cache.service';
import { TenantDatabaseService } from '../tenant-database.service';
import { TenantResolverGuard } from '../tenant-resolver.guard';

describe('TenantResolverGuard', () => {
  const guard = new TenantResolverGuard(
    { withPlatform: jest.fn().mockResolvedValue(null) } as unknown as TenantDatabaseService,
    { get: jest.fn().mockResolvedValue(null) } as unknown as TenantCacheService
  );

  const createContext = (path: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ path, headers: {} }),
      }),
    }) as unknown as ExecutionContext;

  it.each([
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/health',
    '/api/v1/platform/tenants',
    '/api/docs',
    '/docs',
  ])('skips tenant resolution for public path %s', async (path) => {
    await expect(guard.canActivate(createContext(path))).resolves.toBe(true);
  });

  it('still requires a tenant for protected paths', async () => {
    await expect(guard.canActivate(createContext('/api/v1/sales'))).rejects.toBeInstanceOf(
      HttpException
    );
  });
});
