-- 002_customization_metadata.sql
-- Multi-Tenancy Customization Layer: Metadata Registry, Change Log & GIN Indexing

-- Table: custom_entities
CREATE TABLE IF NOT EXISTS custom_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    plural_label VARCHAR(100) NOT NULL,
    table_name VARCHAR(63) UNIQUE NOT NULL,
    icon VARCHAR(50) NOT NULL DEFAULT 'Layers',
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- draft | active | archived
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    version INT NOT NULL DEFAULT 1,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_entities_status ON custom_entities(status);

-- Table: custom_fields
CREATE TABLE IF NOT EXISTS custom_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_key VARCHAR(50) NOT NULL, -- core or custom entity key
    field_key VARCHAR(50) NOT NULL,  -- cf_<slug>
    label VARCHAR(100) NOT NULL,
    datatype VARCHAR(30) NOT NULL,  -- text | long_text | integer | decimal | boolean | date | datetime | select | multi_select | lookup | currency | email | phone | url | file
    storage VARCHAR(20) NOT NULL DEFAULT 'jsonb', -- jsonb | column
    required BOOLEAN NOT NULL DEFAULT FALSE,
    unique_field BOOLEAN NOT NULL DEFAULT FALSE,
    default_value TEXT,
    validation JSONB NOT NULL DEFAULT '{}'::jsonb, -- min, max, regex, max_length, decimal_places, options
    visible_roles TEXT[] NOT NULL DEFAULT '{}',
    editable_roles TEXT[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    show_in_list BOOLEAN NOT NULL DEFAULT TRUE,
    show_in_print BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | hidden | archived
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_entity_field UNIQUE (entity_key, field_key)
);

CREATE INDEX IF NOT EXISTS idx_custom_fields_entity ON custom_fields(entity_key, status);

-- Table: custom_entity_relations
CREATE TABLE IF NOT EXISTS custom_entity_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_entity VARCHAR(50) NOT NULL,
    to_entity VARCHAR(50) NOT NULL,
    relation_type VARCHAR(30) NOT NULL DEFAULT 'many_to_one', -- many_to_one | one_to_many
    on_delete VARCHAR(20) NOT NULL DEFAULT 'restrict', -- restrict | set_null
    field_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_custom_entity_rel UNIQUE (from_entity, field_name)
);

-- Table: schema_change_log (Audited, Reversible Schema Changes)
CREATE TABLE IF NOT EXISTS schema_change_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    change_type VARCHAR(50) NOT NULL, -- ADD_FIELD | PROMOTE_FIELD | ALTER_DATATYPE | CREATE_ENTITY | ARCHIVE_ENTITY
    target VARCHAR(100) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ddl_sql TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'APPLIED', -- DRAFT | PREVIEWED | APPLIED | FAILED | ROLLED_BACK
    requested_by UUID,
    approved_by UUID,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rollback_sql TEXT,
    error TEXT
);

CREATE INDEX IF NOT EXISTS idx_schema_change_log_target ON schema_change_log(target, applied_at DESC);

-- Ensure core extensible tables have `custom_data jsonb` and GIN index for high-performance indexing
DO $$
BEGIN
    -- customers
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'custom_data') THEN
        ALTER TABLE customers ADD COLUMN custom_data JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_customers_custom_data ON customers USING GIN (custom_data);

    -- vendors
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'vendors' AND column_name = 'custom_data') THEN
        ALTER TABLE vendors ADD COLUMN custom_data JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_vendors_custom_data ON vendors USING GIN (custom_data);

    -- items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'items' AND column_name = 'custom_data') THEN
        ALTER TABLE items ADD COLUMN custom_data JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_items_custom_data ON items USING GIN (custom_data);

    -- sales_invoices
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales_invoices' AND column_name = 'custom_data') THEN
        ALTER TABLE sales_invoices ADD COLUMN custom_data JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_custom_data ON sales_invoices USING GIN (custom_data);

    -- purchase_orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'custom_data') THEN
        ALTER TABLE purchase_orders ADD COLUMN custom_data JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_purchase_orders_custom_data ON purchase_orders USING GIN (custom_data);

    -- branches
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'custom_data') THEN
        ALTER TABLE branches ADD COLUMN custom_data JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    CREATE INDEX IF NOT EXISTS idx_branches_custom_data ON branches USING GIN (custom_data);
END $$;
