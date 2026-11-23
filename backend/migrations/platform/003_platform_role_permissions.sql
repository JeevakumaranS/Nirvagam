-- Configurable access matrix for platform support and finance administrators.
CREATE TABLE IF NOT EXISTS platform.platform_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform.platform_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    permission_key VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(100) NOT NULL,
    label VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform.platform_role_permissions (
    role_id UUID NOT NULL REFERENCES platform.platform_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES platform.platform_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

INSERT INTO platform.platform_roles (role_key, name, description)
VALUES
  ('PLATFORM_SUPPORT_ADMIN', 'Platform Support Admin', 'Customer support and platform troubleshooting access.'),
  ('PLATFORM_FINANCE_ADMIN', 'Platform Finance Admin', 'Platform subscription and finance operations access.')
ON CONFLICT (role_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW();

-- Deliberately platform-specific placeholders. Product-level access details can be filled in later.
INSERT INTO platform.platform_permissions (permission_key, category, label)
VALUES
  ('platform_operations:view', 'Platform Operations', 'View'),
  ('platform_operations:manage', 'Platform Operations', 'Manage'),
  ('tenant_support:view', 'Tenant Support', 'View'),
  ('tenant_support:manage', 'Tenant Support', 'Manage'),
  ('billing_operations:view', 'Billing Operations', 'View'),
  ('billing_operations:manage', 'Billing Operations', 'Manage')
ON CONFLICT (permission_key) DO NOTHING;
