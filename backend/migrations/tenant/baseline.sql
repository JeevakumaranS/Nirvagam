-- Baseline Schema Template for Tenant Schemas (t_<short_uuid>)
-- Executed inside the target tenant schema: SET LOCAL search_path TO "<target_schema>", public;

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: schema_migrations (Tracking tenant schema migrations)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    duration_ms INT NOT NULL DEFAULT 0
);

-- Table: business_profile
CREATE TABLE IF NOT EXISTS business_profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    legal_name VARCHAR(200) NOT NULL,
    trade_name VARCHAR(200) NOT NULL,
    gstin VARCHAR(15) NOT NULL,
    pan VARCHAR(10) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    state_code VARCHAR(2),
    pincode VARCHAR(10),
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: branches
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_head_office BOOLEAN NOT NULL DEFAULT FALSE,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    state_code VARCHAR(2),
    pincode VARCHAR(10),
    gstin VARCHAR(15),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: financial_years
CREATE TABLE IF NOT EXISTS financial_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,
    is_current BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: gst_settings
CREATE TABLE IF NOT EXISTS gst_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_composition BOOLEAN NOT NULL DEFAULT FALSE,
    e_invoicing_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    e_way_bill_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    gsp_username VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: numbering_series
CREATE TABLE IF NOT EXISTS numbering_series (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    prefix VARCHAR(30) NOT NULL,
    current_number INT NOT NULL DEFAULT 0,
    padding_zeros INT NOT NULL DEFAULT 5,
    suffix VARCHAR(20),
    financial_year_id UUID REFERENCES financial_years(id) ON DELETE SET NULL,
    CONSTRAINT uq_numbering_series UNIQUE (entity_type, prefix)
);

-- Table: roles (Tenant-specific roles)
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: permissions (Standard ERP module x action catalog)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    CONSTRAINT uq_permissions_module_action UNIQUE (module, action)
);

-- Table: role_permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    CONSTRAINT uq_role_permissions UNIQUE (role_id, permission_id)
);

-- Table: tenant_users (Users within this tenant, soft reference to platform.identities)
CREATE TABLE IF NOT EXISTS tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL, -- Soft reference to platform.identities.id
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_users_identity ON tenant_users(identity_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON tenant_users(email);

-- Table: user_roles
CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT uq_user_roles UNIQUE (user_id, role_id)
);

-- Table: user_branch_access
CREATE TABLE IF NOT EXISTS user_branch_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES tenant_users(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_user_branch_access UNIQUE (user_id, branch_id)
);

-- Table: customers
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(150),
    billing_address TEXT,
    state VARCHAR(100),
    state_code VARCHAR(2),
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON customers(gstin);

-- Table: vendors
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(150),
    billing_address TEXT,
    state VARCHAR(100),
    state_code VARCHAR(2),
    opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    current_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);

-- Table: warehouses
CREATE TABLE IF NOT EXISTS warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: items
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku VARCHAR(64) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    barcode VARCHAR(64),
    hsn_code VARCHAR(10),
    uom VARCHAR(20) NOT NULL DEFAULT 'NOS',
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    cess_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    reorder_level NUMERIC(10, 2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_items_sku ON items(sku);
CREATE INDEX IF NOT EXISTS idx_items_barcode ON items(barcode);
CREATE INDEX IF NOT EXISTS idx_items_hsn ON items(hsn_code);

-- Table: stock
CREATE TABLE IF NOT EXISTS stock (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reserved_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    available_quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_item_warehouse UNIQUE (item_id, warehouse_id)
);

-- Table: stock_movements
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
    movement_type VARCHAR(30) NOT NULL, -- INWARD | OUTWARD | TRANSFER | ADJUSTMENT
    quantity NUMERIC(12, 2) NOT NULL,
    reference_type VARCHAR(50),
    reference_id UUID,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: pos_shifts
CREATE TABLE IF NOT EXISTS pos_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    opened_by_id UUID,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    starting_cash NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cash_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    card_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    upi_sales NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
);

-- Table: sales_invoices
CREATE TABLE IF NOT EXISTS sales_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    financial_year_id UUID REFERENCES financial_years(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    balance_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
    irn VARCHAR(100),
    qr_code TEXT,
    notes TEXT,
    created_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoices_date ON sales_invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer ON sales_invoices(customer_id);

-- Table: sales_invoice_items
CREATE TABLE IF NOT EXISTS sales_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    item_name VARCHAR(200) NOT NULL,
    hsn_code VARCHAR(10),
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    gst_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL
);

-- Table: quotes
CREATE TABLE IF NOT EXISTS quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    quote_date DATE NOT NULL,
    valid_until DATE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: credit_notes
CREATE TABLE IF NOT EXISTS credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_number VARCHAR(50) UNIQUE NOT NULL,
    credit_note_date DATE NOT NULL,
    original_invoice_id UUID REFERENCES sales_invoices(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sgst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    igst_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    reason TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'ISSUED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: purchase_orders
CREATE TABLE IF NOT EXISTS purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_number VARCHAR(50) UNIQUE NOT NULL,
    po_date DATE NOT NULL,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    taxable_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'CONFIRMED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: purchase_order_items
CREATE TABLE IF NOT EXISTS purchase_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL,
    taxable_amount NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL
);

-- Table: grn (Goods Receipt Notes)
CREATE TABLE IF NOT EXISTS grn (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_number VARCHAR(50) UNIQUE NOT NULL,
    grn_date DATE NOT NULL,
    po_id UUID REFERENCES purchase_orders(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    vendor_invoice_number VARCHAR(50),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: grn_items
CREATE TABLE IF NOT EXISTS grn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES grn(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
    quantity_received NUMERIC(10, 2) NOT NULL,
    unit_cost NUMERIC(12, 2) NOT NULL,
    total_amount NUMERIC(12, 2) NOT NULL
);

-- Table: chart_of_accounts (Standard Indian Accounting Taxonomy)
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code VARCHAR(30) UNIQUE NOT NULL,
    account_name VARCHAR(150) NOT NULL,
    group_type VARCHAR(50) NOT NULL, -- ASSETS | LIABILITIES | EQUITY | REVENUE | EXPENSES
    parent_id UUID REFERENCES chart_of_accounts(id),
    is_reconciliation BOOLEAN NOT NULL DEFAULT FALSE,
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coa_group ON chart_of_accounts(group_type);

-- Table: journal_entries (Double-entry core with debit=credit constraint)
CREATE TABLE IF NOT EXISTS journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_number VARCHAR(50) UNIQUE NOT NULL,
    entry_date DATE NOT NULL,
    financial_year_id UUID REFERENCES financial_years(id),
    reference_type VARCHAR(50),
    reference_id UUID,
    narration TEXT,
    total_debit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_credit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(30) NOT NULL DEFAULT 'POSTED',
    created_by_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_debit_credit_balance CHECK (total_debit = total_credit)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);

-- Table: journal_lines
CREATE TABLE IF NOT EXISTS journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
    debit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    credit_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    branch_id UUID REFERENCES branches(id),
    description TEXT,
    CONSTRAINT chk_line_amount CHECK (
        (debit_amount > 0 AND credit_amount = 0) OR
        (credit_amount > 0 AND debit_amount = 0)
    )
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);

-- Table: tenant_audit_log (Business actions within this tenant)
CREATE TABLE IF NOT EXISTS tenant_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    changes JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: tenant_settings
CREATE TABLE IF NOT EXISTS tenant_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(50) NOT NULL,
    key VARCHAR(50) NOT NULL,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_settings UNIQUE (category, key)
);

-- Table: attachments
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    storage_key VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Record baseline migration version 1
INSERT INTO schema_migrations (version, name, checksum, duration_ms)
VALUES (1, '001_baseline', 'sha256_baseline_v1', 0)
ON CONFLICT (version) DO NOTHING;
