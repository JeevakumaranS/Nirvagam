import { Module, Global } from '@nestjs/common';
import { TenantDatabaseService } from './tenant-database.service';
import { TenantCacheService } from './tenant-cache.service';
import { TenantProvisioningService } from './tenant-provisioning.service';
import { TenantMigrationService } from './tenant-migration.service';
import { TenantResolverGuard } from './tenant-resolver.guard';
import { TenantContextMiddleware } from './tenant-context.middleware';
import { TenantStorageService } from './tenant-storage.service';
import { TenantJobService } from './tenant-job.service';
import { TenantLoggerInterceptor } from './tenant-logger.interceptor';
import { PlatformController } from './platform.controller';
import { PlatformBusinessRegistrationController } from './platform-business-registration.controller';
import { PlatformBusinessRegistrationService } from './platform-business-registration.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Global()
@Module({
  controllers: [PlatformController, PlatformBusinessRegistrationController],
  providers: [
    TenantDatabaseService,
    TenantCacheService,
    TenantProvisioningService,
    TenantMigrationService,
    TenantResolverGuard,
    TenantContextMiddleware,
    TenantStorageService,
    TenantJobService,
    TenantLoggerInterceptor,
    PlatformBusinessRegistrationService,
    PermissionsGuard,
  ],
  exports: [
    TenantDatabaseService,
    TenantCacheService,
    TenantProvisioningService,
    TenantMigrationService,
    TenantResolverGuard,
    TenantContextMiddleware,
    TenantStorageService,
    TenantJobService,
    TenantLoggerInterceptor,
    PlatformBusinessRegistrationService,
    PermissionsGuard,
  ],
})
export class TenancyModule {}
