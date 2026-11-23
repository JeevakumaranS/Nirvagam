CREATE TABLE IF NOT EXISTS platform.business_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    legal_name VARCHAR(200) NOT NULL,
    trade_name VARCHAR(200) NOT NULL,
    business_type VARCHAR(30) NOT NULL,
    industry VARCHAR(30) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    jurisdiction VARCHAR(150),
    pincode VARCHAR(10) NOT NULL,
    financial_year_start DATE NOT NULL,
    financial_year_end DATE NOT NULL,
    invoice_prefix VARCHAR(30) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    tax_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    logo_url TEXT,
    digital_signature_url TEXT,
    enabled_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_business_profile_financial_year
        CHECK (financial_year_end > financial_year_start)
);

CREATE INDEX IF NOT EXISTS idx_platform_business_profiles_tenant
    ON platform.business_profiles(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform.business_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES platform.business_profiles(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(150) NOT NULL,
    is_head_office BOOLEAN NOT NULL DEFAULT FALSE,
    gstin VARCHAR(15),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    state_code VARCHAR(2) NOT NULL,
    pincode VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_platform_business_branch_code UNIQUE (profile_id, code)
);
