import { AsyncLocalStorage } from 'async_hooks';
import { TenantContext } from './tenancy.types';

const tenantStorage = new AsyncLocalStorage<TenantContext>();

export class TenantContextStorage {
  /**
   * Run a callback inside an active TenantContext scope.
   */
  static run<R>(context: TenantContext, callback: () => R): R {
    return tenantStorage.run(context, callback);
  }

  /**
   * Retrieve the current TenantContext or throw if called outside a tenant request.
   */
  static get(): TenantContext {
    const ctx = tenantStorage.getStore();
    if (!ctx) {
      throw new Error(
        'SECURITY VIOLATION: Execution attempted outside an active TenantContext. All business data access must occur inside withTenant() or an authorized tenant request.'
      );
    }
    return ctx;
  }

  /**
   * Try to retrieve the current TenantContext without throwing.
   */
  static tryGet(): TenantContext | undefined {
    return tenantStorage.getStore();
  }

  static enterWith(context: TenantContext): void {
    tenantStorage.enterWith(context);
  }
}
