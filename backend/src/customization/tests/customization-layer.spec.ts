import { SchemaCustomizationService } from '../schema-customization.service';
import { CustomDataValidatorService } from '../custom-data-validator.service';
import { TenantDatabaseService } from '../../tenancy/tenant-database.service';
import { TenantCacheService } from '../../tenancy/tenant-cache.service';
import { TenantContextStorage } from '../../tenancy/tenant-context.storage';
import { TenantContext } from '../../tenancy/tenancy.types';

describe('Customization Layer: Security, Invariants & DDL Isolation', () => {
  let tenantDb: TenantDatabaseService;
  let cache: TenantCacheService;
  let customization: SchemaCustomizationService;
  let validator: CustomDataValidatorService;

  const tenantA: TenantContext = {
    tenantId: 'cust-tenant-a-1111',
    schemaName: 't_ca1111111111',
    slug: 'cust-tenant-a',
    displayName: 'Customization Tenant A',
    status: 'active',
    roleKeys: ['BUSINESS_OWNER'],
    branchIds: [],
    planLimits: { maxBranches: 1, maxUsers: 5, maxInvoicesPerMonth: 500, featureFlags: {} },
  };

  const tenantB: TenantContext = {
    tenantId: 'cust-tenant-b-2222',
    schemaName: 't_cb2222222222',
    slug: 'cust-tenant-b',
    displayName: 'Customization Tenant B',
    status: 'active',
    roleKeys: ['BUSINESS_OWNER'],
    branchIds: [],
    planLimits: { maxBranches: 1, maxUsers: 5, maxInvoicesPerMonth: 500, featureFlags: {} },
  };

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://postgres:user@localhost:5432/nirvagam_db';

    tenantDb = new TenantDatabaseService();
    tenantDb.onModuleInit();
    cache = new TenantCacheService();
    customization = new SchemaCustomizationService(tenantDb, cache);
    validator = new CustomDataValidatorService();

    const pool = tenantDb.getPool();

    // Create test schemas with required metadata tables
    for (const t of [tenantA, tenantB]) {
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "${t.schemaName}";`);
      await pool.query(`
        SET search_path TO "${t.schemaName}", public;
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        CREATE TABLE IF NOT EXISTS branches (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS permissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          module VARCHAR(50) NOT NULL,
          action VARCHAR(50) NOT NULL,
          description TEXT,
          CONSTRAINT uq_${t.schemaName}_perms UNIQUE (module, action)
        );

        CREATE TABLE IF NOT EXISTS roles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(50) UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS role_permissions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          role_id UUID NOT NULL,
          permission_id UUID NOT NULL
        );

        INSERT INTO roles (name) VALUES ('BUSINESS_OWNER'), ('BUSINESS_ADMIN') ON CONFLICT DO NOTHING;

        CREATE TABLE IF NOT EXISTS customers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          custom_data JSONB NOT NULL DEFAULT '{}'::jsonb
        );

        CREATE TABLE IF NOT EXISTS journal_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entry_number TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS custom_entities (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          key VARCHAR(50) UNIQUE NOT NULL,
          label VARCHAR(100) NOT NULL,
          plural_label VARCHAR(100) NOT NULL,
          table_name VARCHAR(63) UNIQUE NOT NULL,
          icon VARCHAR(50) NOT NULL DEFAULT 'Layers',
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          is_system BOOLEAN NOT NULL DEFAULT FALSE,
          version INT NOT NULL DEFAULT 1,
          created_by UUID,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS custom_fields (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          entity_key VARCHAR(50) NOT NULL,
          field_key VARCHAR(50) NOT NULL,
          label VARCHAR(100) NOT NULL,
          datatype VARCHAR(30) NOT NULL,
          storage VARCHAR(20) NOT NULL DEFAULT 'jsonb',
          required BOOLEAN NOT NULL DEFAULT FALSE,
          unique_field BOOLEAN NOT NULL DEFAULT FALSE,
          default_value TEXT,
          validation JSONB NOT NULL DEFAULT '{}'::jsonb,
          visible_roles TEXT[] NOT NULL DEFAULT '{}',
          editable_roles TEXT[] NOT NULL DEFAULT '{}',
          sort_order INT NOT NULL DEFAULT 0,
          show_in_list BOOLEAN NOT NULL DEFAULT TRUE,
          show_in_print BOOLEAN NOT NULL DEFAULT FALSE,
          status VARCHAR(20) NOT NULL DEFAULT 'active',
          version INT NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT uq_${t.schemaName}_cf UNIQUE (entity_key, field_key)
        );

        CREATE TABLE IF NOT EXISTS custom_entity_relations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          from_entity VARCHAR(50) NOT NULL,
          to_entity VARCHAR(50) NOT NULL,
          relation_type VARCHAR(30) NOT NULL DEFAULT 'many_to_one',
          on_delete VARCHAR(20) NOT NULL DEFAULT 'restrict',
          field_name VARCHAR(50) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS schema_change_log (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          change_type VARCHAR(50) NOT NULL,
          target VARCHAR(100) NOT NULL,
          before_state JSONB,
          after_state JSONB,
          ddl_sql TEXT,
          status VARCHAR(30) NOT NULL DEFAULT 'APPLIED',
          requested_by UUID,
          approved_by UUID,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          rollback_sql TEXT,
          error TEXT
        );
      `);
    }
  });

  afterAll(async () => {
    const pool = tenantDb.getPool();
    await pool.query(`DROP SCHEMA IF EXISTS "${tenantA.schemaName}" CASCADE;`);
    await pool.query(`DROP SCHEMA IF EXISTS "${tenantB.schemaName}" CASCADE;`);
    await tenantDb.onModuleDestroy();
  });

  describe('Identifier Validation & Security Defenses', () => {
    it('should generate valid cf_ and ct_ prefixed identifiers', () => {
      expect(customization.validateIdentifier('fabric_gsm', 'field')).toBe('cf_fabric_gsm');
      expect(customization.validateIdentifier('cf_fabric_gsm', 'field')).toBe('cf_fabric_gsm');
      expect(customization.validateIdentifier('vehicle_log', 'entity')).toBe('ct_vehicle_log');
    });

    it('should reject SQL injection and illegal characters in identifiers', () => {
      const malicious = [
        "field'; DROP TABLE users; --",
        'field--comment',
        'field/**/injection',
        'field with spaces',
        '123_invalid_start',
        'field_with_very_long_name_exceeding_forty_characters_limit_by_far',
        '',
      ];

      for (const item of malicious) {
        expect(() => customization.validateIdentifier(item, 'field')).toThrow();
      }
    });

    it('should reject reserved PostgreSQL and ERP keywords', () => {
      const keywords = ['select', 'table', 'where', 'from', 'drop', 'status', 'id', 'custom_data'];
      for (const kw of keywords) {
        expect(() => customization.validateIdentifier(kw, 'field')).toThrow(/reserved/i);
      }
    });
  });

  describe('Core Accounting Tables Immutability Invariant', () => {
    it('should strictly block altering or dropping protected tables', async () => {
      await TenantContextStorage.run(tenantA, async () => {
        // Attempting to archive a protected table
        await expect(customization.archiveCustomEntity('journal_entries')).rejects.toThrow();

        // Attempting to alter datatype on protected table
        await expect(
          customization.previewDatatypeChange('journal_entries', 'entry_number', 'integer')
        ).rejects.toThrow();
      });
    });
  });

  describe('Cross-Tenant DDL Isolation', () => {
    it('should create custom field and table in Tenant A without affecting Tenant B', async () => {
      // Create field in Tenant A
      await TenantContextStorage.run(tenantA, async () => {
        const field = await customization.createCustomField({
          entityKey: 'customers',
          fieldKey: 'credit_rating',
          label: 'Credit Rating',
          datatype: 'integer',
          storage: 'jsonb',
        });
        expect(field.field_key).toBe('cf_credit_rating');

        // Create custom entity in Tenant A
        const entity = await customization.createCustomEntity({
          key: 'loom_inspection',
          label: 'Loom Inspection',
          pluralLabel: 'Loom Inspections',
        });
        expect(entity.table_name).toBe('ct_loom_inspection');
      });

      // Verify Tenant B has ZERO trace of Tenant A custom table or field
      await TenantContextStorage.run(tenantB, async () => {
        const pool = tenantDb.getPool();
        const resA = await pool.query(
          `SELECT table_name FROM information_schema.tables WHERE table_schema = '${tenantB.schemaName}' AND table_name = 'ct_loom_inspection';`
        );
        expect(resA.rows).toHaveLength(0);

        const metaB = await customization.getEntityMetadata('customers');
        const hasField = metaB.fields.some((f: any) => f.field_key === 'cf_credit_rating');
        expect(hasField).toBe(false);
      });
    });
  });

  describe('Validation & Promotion to Real Column', () => {
    it('should validate custom_data jsonb against field constraints and reject unknown keys', () => {
      const fieldDefs = [
        { field_key: 'cf_age', label: 'Age', datatype: 'integer', required: true, validation: { min: 18, max: 100 }, status: 'active' },
        { field_key: 'cf_color', label: 'Color', datatype: 'select', validation: { options: ['Red', 'Blue'] }, status: 'active' },
      ];

      // Missing required field
      expect(() => validator.validate({}, fieldDefs)).toThrow(/required/);

      // Unknown key injection
      expect(() => validator.validate({ cf_age: 25, malicious_key: 'hack' }, fieldDefs)).toThrow(
        /Unknown custom field/
      );

      // Invalid option
      expect(() => validator.validate({ cf_age: 25, cf_color: 'Green' }, fieldDefs)).toThrow(
        /Invalid option/
      );

      // Bounds violation
      expect(() => validator.validate({ cf_age: 12 }, fieldDefs)).toThrow(/>= 18/);

      // Valid data passes cleanly
      const valid = validator.validate({ cf_age: '30', cf_color: 'Red' }, fieldDefs);
      expect(valid.cf_age).toBe(30);
      expect(valid.cf_color).toBe('Red');
    });

    it('should promote JSONB field to physical column with batch backfill', async () => {
      await TenantContextStorage.run(tenantA, async () => {
        // Insert customer with custom_data
        const pool = tenantDb.getPool();
        await pool.query(
          `INSERT INTO "${tenantA.schemaName}".customers (name, custom_data) 
           VALUES ('Kavitha Mills', '{"cf_credit_rating": 850}'::jsonb);`
        );

        // Promote field to real column
        const res = await customization.promoteFieldToColumn('customers', 'cf_credit_rating');
        expect(res.success).toBe(true);
        expect(res.storage).toBe('column');
        expect(res.rowsBackfilled).toBe(1);

        // Query physical column directly
        const row = await pool.query(
          `SELECT name, cf_credit_rating FROM "${tenantA.schemaName}".customers WHERE name = 'Kavitha Mills';`
        );
        expect(row.rows[0].cf_credit_rating).toBe('850');
      });
    });

    it('should perform dry-run impact analysis before datatype changes', async () => {
      await TenantContextStorage.run(tenantA, async () => {
        // Integer -> Decimal (Lossless widening)
        const lossless = await customization.previewDatatypeChange(
          'customers',
          'cf_credit_rating',
          'decimal'
        );
        expect(lossless.isLossless).toBe(true);
        expect(lossless.incompatibleRowCount).toBe(0);
        expect(lossless.canApplyDirectly).toBe(true);
      });
    });
  });
});
