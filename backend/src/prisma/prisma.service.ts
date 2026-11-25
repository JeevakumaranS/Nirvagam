import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextStorage } from '../tenancy/tenant-context.storage';
import { validateSchemaName } from '../tenancy/tenant-database.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly tenantClients = new Map<string, PrismaClient>();

  constructor() {
    super();
    return new Proxy(this, {
      get: (target, property, receiver) => {
        const context = TenantContextStorage.tryGet();
        const targetValue = Reflect.get(target, property, target);
        if (property === 'constructor' || property === 'then') {
          return targetValue;
        }
        if (
          property === 'getClientForSchema' ||
          property === 'onModuleInit' ||
          property === 'onModuleDestroy' ||
          property === 'onApplicationBootstrap' ||
          property === 'onApplicationShutdown' ||
          property === 'beforeApplicationShutdown' ||
          property === '$connect' ||
          property === '$disconnect'
        ) {
          return typeof targetValue === 'function' ? targetValue.bind(target) : targetValue;
        }
        if (!context) {
          if (typeof property === 'symbol') {
            return targetValue;
          }
          throw new Error(
            'SECURITY VIOLATION: Prisma access requires an authenticated tenant context or an explicit tenant schema.'
          );
        }

        const client = target.getClientForSchema(context.schemaName);
        const value = Reflect.get(client, property, client);
        return typeof value === 'function' ? value.bind(client) : value;
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await Promise.all(Array.from(this.tenantClients.values(), (client) => client.$disconnect()));
    await this.$disconnect();
  }

  getClientForSchema(schemaName: string): PrismaClient {
    validateSchemaName(schemaName);
    const existing = this.tenantClients.get(schemaName);
    if (existing) {
      return existing;
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required for tenant database access');
    }
    const tenantUrl = new URL(connectionString);
    tenantUrl.searchParams.set('schema', schemaName);

    const client = new PrismaClient({
      datasources: { db: { url: tenantUrl.toString() } },
    });
    this.tenantClients.set(schemaName, client);
    return client;
  }
}
