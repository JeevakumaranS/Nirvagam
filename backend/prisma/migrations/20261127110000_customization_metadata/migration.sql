CREATE TABLE IF NOT EXISTS "custom_entities" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" VARCHAR(50) UNIQUE NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "plural_label" VARCHAR(100) NOT NULL,
  "table_name" VARCHAR(63) UNIQUE NOT NULL,
  "icon" VARCHAR(50) NOT NULL DEFAULT 'Layers',
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "version" INT NOT NULL DEFAULT 1,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "idx_custom_entities_status"
  ON "custom_entities" ("status");

CREATE TABLE IF NOT EXISTS "custom_fields" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "entity_key" VARCHAR(50) NOT NULL,
  "field_key" VARCHAR(50) NOT NULL,
  "label" VARCHAR(100) NOT NULL,
  "datatype" VARCHAR(30) NOT NULL,
  "storage" VARCHAR(20) NOT NULL DEFAULT 'jsonb',
  "required" BOOLEAN NOT NULL DEFAULT FALSE,
  "unique_field" BOOLEAN NOT NULL DEFAULT FALSE,
  "default_value" TEXT,
  "validation" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "visible_roles" TEXT[] NOT NULL DEFAULT '{}',
  "editable_roles" TEXT[] NOT NULL DEFAULT '{}',
  "sort_order" INT NOT NULL DEFAULT 0,
  "show_in_list" BOOLEAN NOT NULL DEFAULT TRUE,
  "show_in_print" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'active',
  "version" INT NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_entity_field" UNIQUE ("entity_key", "field_key")
);

CREATE INDEX IF NOT EXISTS "idx_custom_fields_entity"
  ON "custom_fields" ("entity_key", "status");

CREATE TABLE IF NOT EXISTS "custom_entity_relations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "from_entity" VARCHAR(50) NOT NULL,
  "to_entity" VARCHAR(50) NOT NULL,
  "relation_type" VARCHAR(30) NOT NULL DEFAULT 'many_to_one',
  "on_delete" VARCHAR(20) NOT NULL DEFAULT 'restrict',
  "field_name" VARCHAR(50) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "uq_custom_entity_rel" UNIQUE ("from_entity", "field_name")
);

CREATE TABLE IF NOT EXISTS "schema_change_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "change_type" VARCHAR(50) NOT NULL,
  "target" VARCHAR(100) NOT NULL,
  "before_state" JSONB,
  "after_state" JSONB,
  "ddl_sql" TEXT,
  "status" VARCHAR(30) NOT NULL DEFAULT 'APPLIED',
  "requested_by" UUID,
  "approved_by" UUID,
  "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "rollback_sql" TEXT,
  "error" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_schema_change_log_target"
  ON "schema_change_log" ("target", "applied_at" DESC);

DO $migration$
DECLARE
  target_name TEXT;
  target_tables TEXT[] := ARRAY[
    'customers',
    'suppliers',
    'products',
    'product_variants',
    'sales_invoices',
    'purchase_orders',
    'purchase_invoices',
    'branches',
    'grn'
  ];
BEGIN
  FOREACH target_name IN ARRAY target_tables
  LOOP
    IF to_regclass(format('%I', target_name)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I ADD COLUMN IF NOT EXISTS "custom_data" JSONB NOT NULL DEFAULT ''{}''::jsonb',
        target_name
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON %I USING GIN ("custom_data")',
        'idx_' || target_name || '_custom_data',
        target_name
      );
    END IF;
  END LOOP;
END
$migration$;
