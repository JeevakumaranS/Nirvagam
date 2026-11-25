import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Pool, PoolClient, QueryResult } from 'pg';
import { TenantContext } from './tenancy.types';

export interface TenantTx {
  query<R = any>(text: string, params?: any[]): Promise<R[]>;
  queryOne<R = any>(text: string, params?: any[]): Promise<R | null>;
  execute(text: string, params?: any[]): Promise<number>;
  client: PoolClient;
}

export function quoteIdent(identifier: string): string {
  if (!identifier) {
    throw new Error('SECURITY VIOLATION: Cannot quote empty identifier.');
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}

export function validateSchemaName(schemaName: string): void {
  const schemaRegex = /^t_[a-f0-9]{8,32}$/;
  if (!schemaRegex.test(schemaName)) {
    throw new Error(
      `SECURITY VIOLATION: Invalid schema name "${schemaName}". Schema names must match ^t_[a-f0-9]{8,32}$ and cannot contain arbitrary characters.`
    );
  }
}

@Injectable()
export class TenantDatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantDatabaseService.name);
  private pool!: Pool;

  onModuleInit() {
    if (process.env.ENABLE_PER_TENANT_ROLES === 'true') {
      throw new Error(
        'ENABLE_PER_TENANT_ROLES is unsupported; unset it because tenant database roles are not provisioned.'
      );
    }
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL must be configured before initializing tenant database access');
    }

    this.pool = new Pool({
      connectionString,
      max: parseInt(process.env.DB_POOL_MAX || '25', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle PostgreSQL client in pool', err);
    });

    this.logger.log('PostgreSQL Tenant Connection Pool initialized successfully.');
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger.log('PostgreSQL Tenant Connection Pool closed.');
    }
  }

  /**
   * Internal helper wrapping client in TenantTx interface
   */
  private createTxWrapper(client: PoolClient): TenantTx {
    return {
      client,
      async query<R = any>(text: string, params?: any[]): Promise<R[]> {
        const res: QueryResult = await client.query(text, params);
        return res.rows as R[];
      },
      async queryOne<R = any>(text: string, params?: any[]): Promise<R | null> {
        const res: QueryResult = await client.query(text, params);
        return (res.rows[0] as R) || null;
      },
      async execute(text: string, params?: any[]): Promise<number> {
        const res: QueryResult = await client.query(text, params);
        return res.rowCount || 0;
      },
    };
  }

  /**
   * Security Invariant: Every unit of business data work must execute inside withTenant()
   * Runs inside an isolated PostgreSQL transaction with SET LOCAL search_path.
   * On commit or rollback, the transaction-scoped search_path automatically reverts,
   * guaranteeing that connections returned to the pool or PgBouncer in transaction mode
   * CAN NEVER LEAK another tenant's schema or search path.
   */
  async withTenant<T>(
    ctx: TenantContext,
    callback: (tx: TenantTx) => Promise<T>
  ): Promise<T> {
    if (!ctx || !ctx.schemaName) {
      throw new Error('SECURITY VIOLATION: withTenant invoked without valid TenantContext.');
    }

    validateSchemaName(ctx.schemaName);
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN;');

      // Tenant queries never fall back to shared schemas.
      const safeSchema = quoteIdent(ctx.schemaName);
      await client.query(`SET LOCAL search_path TO ${safeSchema};`);

      const txWrapper = this.createTxWrapper(client);
      const result = await callback(txWrapper);

      await client.query('COMMIT;');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK;');
      } catch (rollbackErr) {
        this.logger.error('Error during transaction rollback', rollbackErr);
      }
      throw error;
    } finally {
      // Releasing connection back to pool
      // SET LOCAL guarantees the connection state has returned to session defaults
      client.release();
    }
  }

  /**
   * Executes a unit of work strictly inside the shared platform schema (for provisioning, admin, auth)
   */
  async withPlatform<T>(callback: (tx: TenantTx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN;');
      await client.query('SET LOCAL search_path TO platform, public;');

      const txWrapper = this.createTxWrapper(client);
      const result = await callback(txWrapper);

      await client.query('COMMIT;');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK;');
      } catch (rollbackErr) {
        this.logger.error('Error during platform rollback', rollbackErr);
      }
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Raw pool client execution (strictly for bootstrap, migrations, or tests)
   */
  getPool(): Pool {
    return this.pool;
  }
}
