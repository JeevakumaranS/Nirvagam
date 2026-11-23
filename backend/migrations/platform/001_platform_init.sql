-- Schema: platform (shared, global)
CREATE SCHEMA IF NOT EXISTS platform;

-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Table: platform.plans
CREATE TABLE IF NOT EXISTS platform.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    price_monthly NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: platform.plan_limits
CREATE TABLE IF NOT EXISTS platform.plan_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES platform.plans(id) ON DELETE CASCADE,
    max_branches INT NOT NULL DEFAULT 1,
    max_users INT NOT NULL DEFAULT 5,
    max_invoices_per_month INT NOT NULL DEFAULT 500,
    feature_flags JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_plan_limits_plan UNIQUE (plan_id)
);

-- Table: platform.tenants
CREATE TABLE IF NOT EXISTS platform.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(63) UNIQUE NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    schema_name VARCHAR(63) UNIQUE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'provisioning', -- provisioning | active | suspended | archived | deleting | failed
    plan_id UUID REFERENCES platform.plans(id),
    region VARCHAR(50) NOT NULL DEFAULT 'ap-south-1',
    db_cluster VARCHAR(50) NOT NULL DEFAULT 'default',
    schema_version INT NOT NULL DEFAULT 1,
    suspended_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_tenants_status ON platform.tenants(status);
CREATE INDEX IF NOT EXISTS idx_platform_tenants_schema ON platform.tenants(schema_name);

-- Table: platform.tenant_domains
CREATE TABLE IF NOT EXISTS platform.tenant_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    domain VARCHAR(255) UNIQUE NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenant_domains_domain ON platform.tenant_domains(domain);

-- Table: platform.identities (Global user credentials, decoupled from tenant data)
CREATE TABLE IF NOT EXISTS platform.identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(20),
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_identities_email ON platform.identities(email);

-- Table: platform.tenant_memberships (Mapping identities to tenants with tenant-level role keys)
CREATE TABLE IF NOT EXISTS platform.tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES platform.identities(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    tenant_role_key VARCHAR(50) NOT NULL DEFAULT 'BUSINESS_OWNER',
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | INVITED | SUSPENDED
    invited_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tenant_memberships UNIQUE (identity_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_memberships_tenant ON platform.tenant_memberships(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_tenant_memberships_identity ON platform.tenant_memberships(identity_id, status);

-- Table: platform.subscriptions
CREATE TABLE IF NOT EXISTS platform.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES platform.plans(id),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '1 year',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Table: platform.platform_users (SUPER_ADMIN lives HERE only, never in tenant roles)
CREATE TABLE IF NOT EXISTS platform.platform_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id UUID NOT NULL REFERENCES platform.identities(id) ON DELETE CASCADE,
    is_super_admin BOOLEAN NOT NULL DEFAULT TRUE,
    role VARCHAR(50) NOT NULL DEFAULT 'SUPER_ADMIN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_platform_users_identity UNIQUE (identity_id)
);

-- Table: platform.tenant_migrations_registry
CREATE TABLE IF NOT EXISTS platform.tenant_migrations_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    version INT NOT NULL,
    status VARCHAR(30) NOT NULL, -- PENDING | SUCCESS | FAILED
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    error TEXT,
    checksum VARCHAR(64),
    duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_migration_registry_tenant ON platform.tenant_migrations_registry(tenant_id, version);

-- Table: platform.platform_audit_log (Cross-tenant administrative actions & impersonation)
CREATE TABLE IF NOT EXISTS platform.platform_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(100),
    reason TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
