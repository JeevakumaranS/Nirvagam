import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import {
  TenantDatabaseService,
  quoteIdent,
} from '../tenancy/tenant-database.service';
import { TenantContextStorage } from '../tenancy/tenant-context.storage';
import { SchemaCustomizationService } from './schema-customization.service';
import { CustomDataValidatorService } from './custom-data-validator.service';

@Injectable()
export class CustomEntityCrudService {
  private readonly logger = new Logger(CustomEntityCrudService.name);

  constructor(
    private readonly tenantDb: TenantDatabaseService,
    private readonly customizationService: SchemaCustomizationService,
    private readonly validator: CustomDataValidatorService
  ) {}

  /**
   * Generic List endpoint with filtering, search, pagination, and role-based field masking
   */
  async findAll(
    entityKey: string,
    query: { page?: number; limit?: number; search?: string; branchId?: string } = {}
  ): Promise<any> {
    const ctx = TenantContextStorage.get();
    const meta = await this.customizationService.getEntityMetadata(entityKey);
    const { page = 1, limit = 25, search, branchId } = query;
    const offset = (page - 1) * limit;

    const tableName = meta.entity.tableName || meta.entity.table_name || entityKey;
    const safeTable = quoteIdent(tableName);

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      // 1. Build WHERE conditions
      const conditions: string[] = ['is_deleted = false'];
      const params: any[] = [];
      let paramIdx = 1;

      if (branchId) {
        conditions.push(`branch_id = $${paramIdx++}`);
        params.push(branchId);
      }

      if (search && search.trim()) {
        conditions.push(`custom_data::text ILIKE $${paramIdx++}`);
        params.push(`%${search.trim()}%`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // 2. Query total count
      const countRes = await tx.queryOne<any>(
        `SELECT count(*)::int as total FROM ${safeTable} ${whereClause};`,
        params
      );
      const total = countRes.total;

      // 3. Query paginated rows
      const rows = await tx.query<any>(
        `SELECT id, created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy",
                branch_id as "branchId", custom_data as "customData"
         FROM ${safeTable}
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT $${paramIdx++} OFFSET $${paramIdx++};`,
        [...params, limit, offset]
      );

      // Mask fields according to role visibility if applicable
      const sanitizedRows = rows.map((r) => {
        const maskedCustomData = { ...r.customData };
        // If field has visible_roles and user's role is not included, mask it
        for (const f of meta.fields) {
          if (
            f.visible_roles &&
            f.visible_roles.length > 0 &&
            !f.visible_roles.some((role: string) => ctx.roleKeys.includes(role))
          ) {
            delete maskedCustomData[f.field_key];
          }
        }
        return {
          ...r,
          customData: maskedCustomData,
        };
      });

      return {
        data: sanitizedRows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    });
  }

  /**
   * Find single record by UUID
   */
  async findOne(entityKey: string, id: string): Promise<any> {
    const ctx = TenantContextStorage.get();
    const meta = await this.customizationService.getEntityMetadata(entityKey);
    const tableName = meta.entity.tableName || meta.entity.table_name || entityKey;
    const safeTable = quoteIdent(tableName);

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      const row = await tx.queryOne<any>(
        `SELECT id, created_at as "createdAt", updated_at as "updatedAt", created_by as "createdBy",
                branch_id as "branchId", custom_data as "customData"
         FROM ${safeTable}
         WHERE id = $1 AND is_deleted = false
         LIMIT 1;`,
        [id]
      );

      if (!row) {
        throw new NotFoundException(`Record with ID "${id}" not found in [${meta.entity.label || entityKey}].`);
      }

      return row;
    });
  }

  /**
   * Create custom entity record with metadata validation
   */
  async create(entityKey: string, payload: { customData: Record<string, any>; branchId?: string }): Promise<any> {
    const ctx = TenantContextStorage.get();
    const meta = await this.customizationService.getEntityMetadata(entityKey);
    const tableName = meta.entity.tableName || meta.entity.table_name || entityKey;
    const safeTable = quoteIdent(tableName);

    // 1. Validate custom data against metadata
    const validatedData = this.validator.validate(payload.customData, meta.fields, { partial: false });

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      // Check plan max rows limit if custom entity
      const rowCountRes = await tx.queryOne<any>(`SELECT count(*)::int as count FROM ${safeTable};`);
      if (rowCountRes.count >= 100000) {
        throw new BadRequestException('Plan limit reached: Maximum 100,000 records per custom table.');
      }

      // 2. Insert record
      const inserted = await tx.queryOne<any>(
        `INSERT INTO ${safeTable} (
          custom_data, branch_id, created_by
        ) VALUES ($1, $2, $3)
        RETURNING id, created_at as "createdAt", updated_at as "updatedAt", branch_id as "branchId", custom_data as "customData";`,
        [JSON.stringify(validatedData), payload.branchId || null, ctx.userId || null]
      );

      // Audit in tenant_audit_log
      await tx.execute(
        `INSERT INTO tenant_audit_log (
          actor_id, action, entity_type, entity_id, changes
        ) VALUES ($1, 'CREATE', $2, $3, $4);`,
        [ctx.userId || null, entityKey, inserted.id, JSON.stringify(validatedData)]
      );

      return inserted;
    });
  }

  /**
   * Update custom entity record with partial metadata validation
   */
  async update(entityKey: string, id: string, payload: { customData: Record<string, any> }): Promise<any> {
    const ctx = TenantContextStorage.get();
    const meta = await this.customizationService.getEntityMetadata(entityKey);
    const tableName = meta.entity.tableName || meta.entity.table_name || entityKey;
    const safeTable = quoteIdent(tableName);

    // 1. Validate custom data against metadata (partial allow)
    const validatedUpdates = this.validator.validate(payload.customData, meta.fields, { partial: true });

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      const existing = await tx.queryOne<any>(
        `SELECT id, custom_data FROM ${safeTable} WHERE id = $1 AND is_deleted = false LIMIT 1;`,
        [id]
      );
      if (!existing) {
        throw new NotFoundException(`Record "${id}" not found.`);
      }

      // Merge jsonb
      const merged = { ...existing.custom_data, ...validatedUpdates };

      const updated = await tx.queryOne<any>(
        `UPDATE ${safeTable} 
         SET custom_data = $1, updated_at = NOW() 
         WHERE id = $2
         RETURNING id, created_at as "createdAt", updated_at as "updatedAt", branch_id as "branchId", custom_data as "customData";`,
        [JSON.stringify(merged), id]
      );

      // Audit
      await tx.execute(
        `INSERT INTO tenant_audit_log (
          actor_id, action, entity_type, entity_id, changes
        ) VALUES ($1, 'UPDATE', $2, $3, $4);`,
        [ctx.userId || null, entityKey, id, JSON.stringify(validatedUpdates)]
      );

      return updated;
    });
  }

  /**
   * Soft-delete custom record
   */
  async delete(entityKey: string, id: string): Promise<any> {
    const ctx = TenantContextStorage.get();
    const meta = await this.customizationService.getEntityMetadata(entityKey);
    const tableName = meta.entity.tableName || meta.entity.table_name || entityKey;
    const safeTable = quoteIdent(tableName);

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      const deleted = await tx.execute(
        `UPDATE ${safeTable} SET is_deleted = true, updated_at = NOW() WHERE id = $1;`,
        [id]
      );
      if (deleted === 0) {
        throw new NotFoundException(`Record "${id}" not found.`);
      }

      // Audit
      await tx.execute(
        `INSERT INTO tenant_audit_log (
          actor_id, action, entity_type, entity_id
        ) VALUES ($1, 'DELETE', $2, $3);`,
        [ctx.userId || null, entityKey, id]
      );

      return { success: true, id };
    });
  }
}
