import { Injectable, Logger } from '@nestjs/common';
import { TenantRecord } from './tenancy.types';

@Injectable()
export class TenantCacheService {
  private readonly logger = new Logger(TenantCacheService.name);
  private readonly memoryCache = new Map<string, { value: any; expiresAt: number }>();

  /**
   * Generates a tenant-scoped cache key following standard: t:{tenantId}:{key}
   */
  getTenantKey(tenantId: string, subKey: string): string {
    return `t:${tenantId}:${subKey}`;
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds: number = 60): Promise<void> {
    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async delete(key: string): Promise<void> {
    this.memoryCache.delete(key);
  }

  /**
   * Flush all keys for a tenant by prefix t:{tenantId}:*
   */
  async flushTenant(tenantId: string): Promise<void> {
    const prefix = `t:${tenantId}:`;
    let count = 0;
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefix)) {
        this.memoryCache.delete(key);
        count++;
      }
    }
    this.logger.log(`Flushed ${count} cache keys for tenant [${tenantId}]`);
  }

  // Specialized Tenant Helpers
  async getTenant(identifier: string): Promise<TenantRecord | null> {
    return this.get<TenantRecord>(`platform:tenant:${identifier}`);
  }

  async setTenant(identifier: string, tenant: TenantRecord, ttlSeconds: number = 60): Promise<void> {
    await this.set(`platform:tenant:${identifier}`, tenant, ttlSeconds);
    if (tenant.id !== identifier) {
      await this.set(`platform:tenant:${tenant.id}`, tenant, ttlSeconds);
    }
    if (tenant.slug && tenant.slug !== identifier) {
      await this.set(`platform:tenant:${tenant.slug}`, tenant, ttlSeconds);
    }
  }

  async invalidateTenant(tenantId: string, slug?: string): Promise<void> {
    await this.delete(`platform:tenant:${tenantId}`);
    if (slug) {
      await this.delete(`platform:tenant:${slug}`);
    }
    await this.flushTenant(tenantId);
  }
}
