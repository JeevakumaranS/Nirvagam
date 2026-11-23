import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { CustomizationModule } from './customization/customization.module';
import { TenantContextMiddleware } from './tenancy/tenant-context.middleware';
import { TenantLoggerInterceptor } from './tenancy/tenant-logger.interceptor';

import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { BusinessesModule } from './modules/businesses/businesses.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { ProductsModule } from './modules/products/products.module';
import { PartnersModule } from './modules/partners/partners.module';
import { SalesModule } from './modules/sales/sales.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TenancyModule,
    CustomizationModule,
    AuthModule,
    TenantsModule,
    BusinessesModule,
    UsersModule,
    RolesModule,
    ProductsModule,
    PartnersModule,
    SalesModule,
    PurchasesModule,
    AccountingModule,
    ReportsModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantLoggerInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
