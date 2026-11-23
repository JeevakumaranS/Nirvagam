import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  TenantDatabaseService,
  quoteIdent,
} from '../tenancy/tenant-database.service';
import { TenantCacheService } from '../tenancy/tenant-cache.service';
import { TenantContextStorage } from '../tenancy/tenant-context.storage';
import {
  PROTECTED_TABLES,
  EXTENSIBLE_CORE_TABLES,
  RESERVED_IDENTIFIERS,
  DATATYPE_TO_PG_MAP,
} from './customization.constants';
import {
  CreateCustomFieldInput,
  CreateCustomEntityInput,
  DatatypeImpactAnalysis,
  CustomDatatype,
} from './customization.types';

@Injectable()
export class SchemaCustomizationService {
  private readonly logger = new Logger(SchemaCustomizationService.name);

  constructor(
    private readonly tenantDb: TenantDatabaseService,
    private readonly cache: TenantCacheService
  ) {}

  /**
   * Validates server-generated and user slugs against security invariants
   */
  validateIdentifier(name: string, type: 'field' | 'entity'): string {
    if (!name || typeof name !== 'string') {
      throw new BadRequestException('Identifier cannot be empty.');
    }
    const trimmed = name.toLowerCase().trim();
    if (/[^a-z0-9_]/.test(trimmed)) {
      throw new BadRequestException(
        `Identifier "${name}" contains invalid characters. Only lowercase alphanumeric and underscores are allowed.`
      );
    }
    const prefix = type === 'field' ? 'cf_' : 'ct_';
    const fullName = trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`;
    const slugPart = fullName.substring(prefix.length);

    // Slug part must start with a lowercase letter
    if (!/^[a-z][a-z0-9_]{1,37}$/.test(slugPart)) {
      throw new BadRequestException(
        `Invalid ${type} identifier "${fullName}". The name after prefix must start with a letter.`
      );
    }

    // Regex check on full identifier: ^[a-z][a-z0-9_]{2,40}$
    const regex = /^[a-z][a-z0-9_]{2,40}$/;
    if (!regex.test(fullName)) {
      throw new BadRequestException(
        `Invalid ${type} identifier "${fullName}". Must match ^[a-z][a-z0-9_]{2,40}$`
      );
    }

    const stripped = fullName.replace(new RegExp(`^${prefix}`), '');
    if (RESERVED_IDENTIFIERS.has(stripped) || RESERVED_IDENTIFIERS.has(fullName)) {
      throw new BadRequestException(
        `Identifier "${fullName}" is a reserved PostgreSQL/ERP keyword and cannot be used.`
      );
    }

    return fullName;
  }

  /**
   * Asserts that core protected tables are never altered or dropped
   */
  private assertNotProtectedTable(tableName: string, operation: string): void {
    const normalized = tableName.toLowerCase().trim();
    if (PROTECTED_TABLES.has(normalized)) {
      throw new ForbiddenException(
        `SECURITY VIOLATION: Operation [${operation}] is strictly forbidden on core protected table "${tableName}". Core columns and accounting structures are immutable.`
      );
    }
  }

  // =========================================================================
  // 1. CUSTOM FIELDS ON CORE OR CUSTOM ENTITIES
  // =========================================================================

  async createCustomField(input: CreateCustomFieldInput): Promise<any> {
    const ctx = TenantContextStorage.get();
    const fieldKey = this.validateIdentifier(input.fieldKey, 'field');
    const entityKey = input.entityKey.toLowerCase().trim();

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      // 1. Check if entity exists (core or custom)
      let tableName = entityKey;
      if (!EXTENSIBLE_CORE_TABLES.has(entityKey)) {
        const customEntity = await tx.queryOne<any>(
          `SELECT table_name FROM custom_entities WHERE key = $1 AND status != 'archived' LIMIT 1;`,
          [entityKey]
        );
        if (!customEntity) {
          throw new BadRequestException(`Entity "${entityKey}" does not exist in extensible registry.`);
        }
        tableName = customEntity.table_name;
      }

      // 2. Check for duplicate field key
      const existing = await tx.queryOne(
        `SELECT id FROM custom_fields WHERE entity_key = $1 AND field_key = $2 LIMIT 1;`,
        [entityKey, fieldKey]
      );
      if (existing) {
        throw new BadRequestException(
          `Field key "${fieldKey}" already exists on entity "${entityKey}".`
        );
      }

      // Check soft plan limit
      const currentCount = await tx.queryOne<any>(
        `SELECT count(*)::int as count FROM custom_fields WHERE entity_key = $1 AND status = 'active';`,
        [entityKey]
      );
      if (currentCount.count >= 100) {
        throw new BadRequestException('Maximum limit of 100 custom fields per entity reached.');
      }

      // 3. Store in metadata table (default storage is jsonb)
      const storageMode = input.storage === 'column' ? 'column' : 'jsonb';

      const fieldRecord = await tx.queryOne<any>(
        `INSERT INTO custom_fields (
          entity_key, field_key, label, datatype, storage, required, unique_field,
          default_value, validation, visible_roles, editable_roles, sort_order,
          show_in_list, show_in_print, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'active')
        RETURNING *;`,
        [
          entityKey,
          fieldKey,
          input.label,
          input.datatype,
          storageMode,
          input.required || false,
          input.unique || false,
          input.defaultValue || null,
          JSON.stringify(input.validation || {}),
          input.visibleRoles || [],
          input.editableRoles || [],
          input.sortOrder || 0,
          input.showInList !== false,
          input.showInPrint || false,
        ]
      );

      // If requested direct column storage: add column
      let ddlSql = '';
      if (storageMode === 'column') {
        const pgType = DATATYPE_TO_PG_MAP[input.datatype] || 'TEXT';
        ddlSql = `ALTER TABLE ${quoteIdent(tableName)} ADD COLUMN IF NOT EXISTS ${quoteIdent(fieldKey)} ${pgType};`;
        await tx.execute(ddlSql);
      }

      // 4. Audit in schema_change_log
      await tx.execute(
        `INSERT INTO schema_change_log (
          change_type, target, after_state, ddl_sql, status, requested_by
        ) VALUES ('ADD_FIELD', $1, $2, $3, 'APPLIED', $4);`,
        [
          `${entityKey}.${fieldKey}`,
          JSON.stringify(fieldRecord),
          ddlSql || 'JSONB_STORAGE_METADATA_ONLY',
          ctx.userId || null,
        ]
      );

      await this.cache.delete(`t:${ctx.tenantId}:metadata:${entityKey}`);
      return fieldRecord;
    });
  }

  /**
   * Promotes a hot custom field from JSONB to a typed PostgreSQL column with zero downtime
   */
  async promoteFieldToColumn(entityKey: string, fieldKey: string): Promise<any> {
    const ctx = TenantContextStorage.get();

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      // 1. Fetch field definition
      const field = await tx.queryOne<any>(
        `SELECT * FROM custom_fields WHERE entity_key = $1 AND field_key = $2 AND status = 'active' LIMIT 1;`,
        [entityKey, fieldKey]
      );
      if (!field) {
        throw new BadRequestException(`Custom field "${fieldKey}" not found on "${entityKey}".`);
      }
      if (field.storage === 'column') {
        return { message: 'Field is already promoted to physical column.', field };
      }

      // Resolve table name
      let tableName = entityKey;
      if (!EXTENSIBLE_CORE_TABLES.has(entityKey)) {
        const customEntity = await tx.queryOne<any>(
          `SELECT table_name FROM custom_entities WHERE key = $1 LIMIT 1;`,
          [entityKey]
        );
        tableName = customEntity.table_name;
      }

      const pgType = DATATYPE_TO_PG_MAP[field.datatype] || 'TEXT';
      const safeTable = quoteIdent(tableName);
      const safeCol = quoteIdent(fieldKey);

      // 2. Add nullable column
      const addColumnSql = `ALTER TABLE ${safeTable} ADD COLUMN IF NOT EXISTS ${safeCol} ${pgType};`;
      await tx.execute(addColumnSql);

      // 3. Batch backfill from custom_data jsonb
      let backfillSql = '';
      if (['integer', 'decimal', 'currency'].includes(field.datatype)) {
        backfillSql = `UPDATE ${safeTable} 
          SET ${safeCol} = (custom_data->>'${fieldKey}')::${pgType}
          WHERE custom_data ? '${fieldKey}' AND custom_data->>'${fieldKey}' ~ '^-?[0-9]+(\\.[0-9]+)?$';`;
      } else if (['date', 'datetime'].includes(field.datatype)) {
        backfillSql = `UPDATE ${safeTable} 
          SET ${safeCol} = (custom_data->>'${fieldKey}')::${pgType}
          WHERE custom_data ? '${fieldKey}';`;
      } else if (field.datatype === 'boolean') {
        backfillSql = `UPDATE ${safeTable} 
          SET ${safeCol} = (custom_data->>'${fieldKey}')::boolean
          WHERE custom_data ? '${fieldKey}';`;
      } else {
        backfillSql = `UPDATE ${safeTable} 
          SET ${safeCol} = custom_data->>'${fieldKey}'
          WHERE custom_data ? '${fieldKey}';`;
      }

      const rowsUpdated = await tx.execute(backfillSql);

      // 4. Update metadata to storage = 'column'
      await tx.execute(
        `UPDATE custom_fields SET storage = 'column', updated_at = NOW() WHERE id = $1;`,
        [field.id]
      );

      // 5. Add index if show_in_list or high selectivity
      let indexSql = '';
      if (field.show_in_list) {
        indexSql = `CREATE INDEX IF NOT EXISTS ${quoteIdent(`idx_${tableName}_${fieldKey}`)} ON ${safeTable} (${safeCol});`;
        await tx.execute(indexSql);
      }

      // 6. Audit in schema change log
      await tx.execute(
        `INSERT INTO schema_change_log (
          change_type, target, before_state, after_state, ddl_sql, status, requested_by
        ) VALUES ('PROMOTE_FIELD', $1, $2, $3, $4, 'APPLIED', $5);`,
        [
          `${entityKey}.${fieldKey}`,
          JSON.stringify({ storage: 'jsonb' }),
          JSON.stringify({ storage: 'column', pgType, rowsUpdated }),
          `${addColumnSql} ${backfillSql} ${indexSql}`,
          ctx.userId || null,
        ]
      );

      await this.cache.delete(`t:${ctx.tenantId}:metadata:${entityKey}`);

      return {
        success: true,
        entityKey,
        fieldKey,
        storage: 'column',
        pgType,
        rowsBackfilled: rowsUpdated,
      };
    });
  }

  // =========================================================================
  // 2. CUSTOM TABLES (CUSTOM ENTITIES)
  // =========================================================================

  async createCustomEntity(input: CreateCustomEntityInput): Promise<any> {
    const ctx = TenantContextStorage.get();
    const entityKey = input.key.toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    const tableName = this.validateIdentifier(entityKey, 'entity');

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      // 1. Check uniqueness
      const existing = await tx.queryOne(
        `SELECT id FROM custom_entities WHERE key = $1 OR table_name = $2 LIMIT 1;`,
        [entityKey, tableName]
      );
      if (existing) {
        throw new BadRequestException(`Custom entity with key "${entityKey}" already exists.`);
      }

      // Check soft plan limit
      const entityCount = await tx.queryOne<any>(
        `SELECT count(*)::int as count FROM custom_entities WHERE status != 'archived';`
      );
      if (entityCount.count >= 50) {
        throw new BadRequestException('Maximum limit of 50 custom entities reached for this workspace.');
      }

      // 2. DDL: Create custom table with standard audited columns
      const safeTable = quoteIdent(tableName);
      const ddlSql = `
        CREATE TABLE IF NOT EXISTS ${safeTable} (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_by UUID,
          branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
          is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
          custom_data JSONB NOT NULL DEFAULT '{}'::jsonb
        );
        CREATE INDEX IF NOT EXISTS ${quoteIdent(`idx_${tableName}_custom_data`)} ON ${safeTable} USING GIN (custom_data);
        CREATE INDEX IF NOT EXISTS ${quoteIdent(`idx_${tableName}_created_at`)} ON ${safeTable} (created_at DESC);
      `;

      await tx.execute(ddlSql);

      // 3. Register in custom_entities metadata
      const entityRecord = await tx.queryOne<any>(
        `INSERT INTO custom_entities (
          key, label, plural_label, table_name, icon, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, 'active', $6)
        RETURNING *;`,
        [
          entityKey,
          input.label,
          input.pluralLabel,
          tableName,
          input.icon || 'Layers',
          ctx.userId || null,
        ]
      );

      // 4. Register new module in permissions matrix & grant to owner/admin
      const actions = ['Approve', 'Cancel', 'Create', 'Delete', 'Edit', 'Export', 'Print', 'View'];
      for (const act of actions) {
        const perm = await tx.queryOne<any>(
          `INSERT INTO permissions (module, action, description)
           VALUES ($1, $2, $3)
           ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description
           RETURNING id;`,
          [input.label, act, `Can ${act} ${input.label}`]
        );

        // Grant to BUSINESS_OWNER and BUSINESS_ADMIN roles
        await tx.execute(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT id, $1 FROM roles WHERE name IN ('BUSINESS_OWNER', 'BUSINESS_ADMIN')
           ON CONFLICT DO NOTHING;`,
          [perm.id]
        );
      }

      // 5. Create initial custom fields if provided
      if (input.fields && input.fields.length > 0) {
        for (const f of input.fields) {
          await this.createCustomField({ ...f, entityKey });
        }
      }

      // 6. Audit in schema change log
      await tx.execute(
        `INSERT INTO schema_change_log (
          change_type, target, after_state, ddl_sql, status, requested_by
        ) VALUES ('CREATE_ENTITY', $1, $2, $3, 'APPLIED', $4);`,
        [entityKey, JSON.stringify(entityRecord), ddlSql, ctx.userId || null]
      );

      return entityRecord;
    });
  }

  /**
   * Safely archives a custom entity (renames and hides, avoids immediate destructive DROP)
   */
  async archiveCustomEntity(entityKey: string): Promise<any> {
    const ctx = TenantContextStorage.get();

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      const entity = await tx.queryOne<any>(
        `SELECT * FROM custom_entities WHERE key = $1 AND status != 'archived' LIMIT 1;`,
        [entityKey]
      );
      if (!entity) {
        throw new BadRequestException(`Active custom entity "${entityKey}" not found.`);
      }

      this.assertNotProtectedTable(entity.table_name, 'ARCHIVE_ENTITY');

      const archiveTableName = `${entity.table_name}__archived_${Date.now()}`;
      const renameSql = `ALTER TABLE ${quoteIdent(entity.table_name)} RENAME TO ${quoteIdent(archiveTableName)};`;
      await tx.execute(renameSql);

      await tx.execute(
        `UPDATE custom_entities 
         SET status = 'archived', table_name = $1, updated_at = NOW() 
         WHERE id = $2;`,
        [archiveTableName, entity.id]
      );

      await tx.execute(
        `INSERT INTO schema_change_log (
          change_type, target, before_state, after_state, ddl_sql, status, requested_by
        ) VALUES ('ARCHIVE_ENTITY', $1, $2, $3, $4, 'APPLIED', $5);`,
        [
          entityKey,
          JSON.stringify(entity),
          JSON.stringify({ status: 'archived', archiveTableName }),
          renameSql,
          ctx.userId || null,
        ]
      );

      await this.cache.delete(`t:${ctx.tenantId}:metadata:${entityKey}`);
      return { success: true, entityKey, status: 'archived', archiveTableName };
    });
  }

  // =========================================================================
  // 3. CONTROLLED DATATYPE CHANGES & IMPACT ANALYSIS
  // =========================================================================

  /**
   * Dry-run impact analysis: counts incompatible rows, returns warnings & samples
   */
  async previewDatatypeChange(
    entityKey: string,
    fieldKey: string,
    targetType: CustomDatatype
  ): Promise<DatatypeImpactAnalysis> {
    const ctx = TenantContextStorage.get();

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      const field = await tx.queryOne<any>(
        `SELECT * FROM custom_fields WHERE entity_key = $1 AND field_key = $2 AND status = 'active' LIMIT 1;`,
        [entityKey, fieldKey]
      );
      if (!field) {
        throw new BadRequestException(`Custom field "${fieldKey}" not found on "${entityKey}".`);
      }

      const currentType: CustomDatatype = field.datatype;
      let tableName = entityKey;
      if (!EXTENSIBLE_CORE_TABLES.has(entityKey)) {
        const ent = await tx.queryOne<any>(
          `SELECT table_name FROM custom_entities WHERE key = $1 LIMIT 1;`,
          [entityKey]
        );
        tableName = ent.table_name;
      }

      this.assertNotProtectedTable(tableName, 'ALTER_DATATYPE');

      // Check lossless / widening rules
      const isLossless = this.isLosslessConversion(currentType, targetType);

      // Check row counts and invalid samples
      const safeTable = quoteIdent(tableName);
      const totalCountRes = await tx.queryOne<any>(`SELECT count(*)::int as count FROM ${safeTable};`);
      const totalRowCount = totalCountRes.count;

      let incompatibleRowCount = 0;
      let sampleIncompatibleValues: any[] = [];
      const warnings: string[] = [];

      if (!isLossless && totalRowCount > 0) {
        // Query rows where cast fails
        const sampleRes = await this.findIncompatibleSamples(tx, tableName, field, targetType);
        incompatibleRowCount = sampleRes.count;
        sampleIncompatibleValues = sampleRes.samples;
        warnings.push(
          `Narrowing conversion detected from ${currentType} to ${targetType}. ${incompatibleRowCount} of ${totalRowCount} rows cannot be cast automatically.`
        );
      }

      const requiresShadowBackup = !isLossless && totalRowCount > 0;
      const shadowBackupColumn = requiresShadowBackup
        ? `${fieldKey}__bak_v${field.version}`
        : undefined;

      return {
        fieldKey,
        entityKey,
        currentType,
        targetType,
        isLossless,
        totalRowCount,
        incompatibleRowCount,
        sampleIncompatibleValues,
        requiresShadowBackup,
        shadowBackupColumn,
        estimatedDurationMs: Math.max(50, totalRowCount * 2),
        canApplyDirectly: isLossless || incompatibleRowCount === 0,
        warnings,
      };
    });
  }

  /**
   * Executes datatype conversion following the expand -> backfill -> swap -> contract pattern
   */
  async applyDatatypeChange(
    entityKey: string,
    fieldKey: string,
    targetType: CustomDatatype
  ): Promise<any> {
    const ctx = TenantContextStorage.get();
    const preview = await this.previewDatatypeChange(entityKey, fieldKey, targetType);

    if (preview.incompatibleRowCount > 0) {
      throw new BadRequestException(
        `Cannot apply datatype change: ${preview.incompatibleRowCount} rows contain incompatible data for ${targetType}. Resolve invalid rows first.`
      );
    }

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      let tableName = entityKey;
      if (!EXTENSIBLE_CORE_TABLES.has(entityKey)) {
        const ent = await tx.queryOne<any>(
          `SELECT table_name FROM custom_entities WHERE key = $1 LIMIT 1;`,
          [entityKey]
        );
        tableName = ent.table_name;
      }

      const safeTable = quoteIdent(tableName);
      let ddlSql = '';

      // If stored in physical column: execute expand -> swap pattern
      const field = await tx.queryOne<any>(
        `SELECT * FROM custom_fields WHERE entity_key = $1 AND field_key = $2 LIMIT 1;`,
        [entityKey, fieldKey]
      );

      if (field.storage === 'column') {
        const targetPgType = DATATYPE_TO_PG_MAP[targetType] || 'TEXT';
        const shadowCol = `${fieldKey}__bak_v${field.version}`;

        // 1. Rename existing column to shadow backup
        await tx.execute(
          `ALTER TABLE ${safeTable} RENAME COLUMN ${quoteIdent(fieldKey)} TO ${quoteIdent(shadowCol)};`
        );

        // 2. Add new column with target type
        await tx.execute(
          `ALTER TABLE ${safeTable} ADD COLUMN ${quoteIdent(fieldKey)} ${targetPgType};`
        );

        // 3. Backfill cast values
        await tx.execute(
          `UPDATE ${safeTable} SET ${quoteIdent(fieldKey)} = ${quoteIdent(shadowCol)}::${targetPgType};`
        );

        ddlSql = `RENAME ${fieldKey} -> ${shadowCol}; ADD ${fieldKey} ${targetPgType}; BACKFILL;`;
      }

      // Update metadata version and datatype
      await tx.execute(
        `UPDATE custom_fields 
         SET datatype = $1, version = version + 1, updated_at = NOW() 
         WHERE id = $2;`,
        [targetType, field.id]
      );

      // Audit in schema change log
      await tx.execute(
        `INSERT INTO schema_change_log (
          change_type, target, before_state, after_state, ddl_sql, status, requested_by
        ) VALUES ('ALTER_DATATYPE', $1, $2, $3, $4, 'APPLIED', $5);`,
        [
          `${entityKey}.${fieldKey}`,
          JSON.stringify({ datatype: field.datatype, version: field.version }),
          JSON.stringify({ datatype: targetType, version: field.version + 1 }),
          ddlSql || 'JSONB_DATATYPE_METADATA_UPDATE',
          ctx.userId || null,
        ]
      );

      await this.cache.delete(`t:${ctx.tenantId}:metadata:${entityKey}`);

      return {
        success: true,
        fieldKey,
        oldType: field.datatype,
        newType: targetType,
        version: field.version + 1,
      };
    });
  }

  private isLosslessConversion(from: CustomDatatype, to: CustomDatatype): boolean {
    if (from === to) return true;
    if (from === 'integer' && ['decimal', 'currency'].includes(to)) return true;
    if (from === 'date' && to === 'datetime') return true;
    if (['text', 'select'].includes(from) && to === 'long_text') return true;
    if (from === 'email' && to === 'text') return true;
    return false;
  }

  private async findIncompatibleSamples(
    tx: any,
    tableName: string,
    field: any,
    targetType: CustomDatatype
  ): Promise<{ count: number; samples: any[] }> {
    const safeTable = quoteIdent(tableName);
    const colExpr = field.storage === 'column'
      ? quoteIdent(field.field_key)
      : `custom_data->>'${field.field_key}'`;

    if (['integer', 'decimal', 'currency'].includes(targetType)) {
      // Find rows where value is not empty and not numeric
      const invalidRows = await (tx as any).query(
        `SELECT ${colExpr} as val 
         FROM ${safeTable} 
         WHERE ${colExpr} IS NOT NULL 
           AND ${colExpr} != '' 
           AND ${colExpr} !~ '^-?[0-9]+(\\.[0-9]+)?$'
         LIMIT 5;`
      );
      return { count: invalidRows.length, samples: invalidRows.map((r: any) => r.val) };
    }

    return { count: 0, samples: [] };
  }

  // =========================================================================
  // 4. METADATA QUERY HELPERS
  // =========================================================================

  async getEntityMetadata(entityKey: string): Promise<any> {
    const ctx = TenantContextStorage.get();
    const cacheKey = `t:${ctx.tenantId}:metadata:${entityKey}`;
    const cached = await this.cache.get<any>(cacheKey);
    if (cached) return cached;

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      const fields = await tx.query<any>(
        `SELECT * FROM custom_fields 
         WHERE entity_key = $1 AND status != 'archived' 
         ORDER BY sort_order ASC, created_at ASC;`,
        [entityKey]
      );

      let entityInfo: any = { key: entityKey, isCore: EXTENSIBLE_CORE_TABLES.has(entityKey) };
      if (!entityInfo.isCore) {
        entityInfo = await tx.queryOne<any>(
          `SELECT * FROM custom_entities WHERE key = $1 LIMIT 1;`,
          [entityKey]
        );
      }

      const relations = await tx.query<any>(
        `SELECT * FROM custom_entity_relations WHERE from_entity = $1 OR to_entity = $1;`,
        [entityKey]
      );

      const result = {
        entity: entityInfo,
        fields,
        relations,
      };

      await this.cache.set(cacheKey, result, 120);
      return result;
    });
  }

  async listEntities(): Promise<any[]> {
    const ctx = TenantContextStorage.get();

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      // Core entities list
      const coreEntities = Array.from(EXTENSIBLE_CORE_TABLES).map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        pluralLabel: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
        tableName: key,
        isCore: true,
        status: 'active',
      }));

      // Custom entities from metadata
      const customEntities = await tx.query<any>(
        `SELECT key, label, plural_label as "pluralLabel", table_name as "tableName", icon, status, is_system as "isSystem", version, created_at as "createdAt"
         FROM custom_entities
         WHERE status != 'archived'
         ORDER BY label ASC;`
      );

      return [...coreEntities, ...customEntities];
    });
  }

  async getSchemaHistory(limit: number = 50): Promise<any[]> {
    const ctx = TenantContextStorage.get();

    return await this.tenantDb.withTenant(ctx, async (tx) => {
      return tx.query(
        `SELECT id, change_type as "changeType", target, before_state as "beforeState",
                after_state as "afterState", ddl_sql as "ddlSql", status, requested_by as "requestedBy",
                applied_at as "appliedAt", error
         FROM schema_change_log
         ORDER BY applied_at DESC
         LIMIT $1;`,
        [limit]
      );
    });
  }
}
