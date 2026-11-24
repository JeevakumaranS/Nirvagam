-- Platform operations for support and SaaS subscription administration.
CREATE TABLE IF NOT EXISTS platform.support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES platform.tenants(id) ON DELETE SET NULL,
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    assigned_to UUID REFERENCES platform.identities(id) ON DELETE SET NULL,
    resolution TEXT,
    escalated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
ALTER TABLE platform.subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON platform.support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_tenant ON platform.support_requests(tenant_id);

CREATE TABLE IF NOT EXISTS platform.subscription_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES platform.tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES platform.subscriptions(id) ON DELETE SET NULL,
    invoice_number VARCHAR(80) UNIQUE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    paid_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON platform.subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created ON platform.subscription_payments(created_at);

-- A richer permission catalogue is used by the platform permission matrix.
INSERT INTO platform.platform_roles (role_key, name, description)
VALUES
  ('PLATFORM_SUPER_ADMIN', 'Platform Super Admin', 'Unrestricted platform administration.')
ON CONFLICT (role_key) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = NOW();

INSERT INTO platform.platform_permissions (permission_key, category, label) VALUES
 ('platform_dashboard:view','Platform Dashboard','View'),
 ('platform_tenants:view','Business & Tenants','View'),
 ('platform_tenants:manage','Business & Tenants','Activate / Suspend'),
 ('support_requests:view','Customer Support','View requests'),
 ('support_requests:manage','Customer Support','Manage requests'),
 ('support_requests:escalate','Customer Support','Escalate requests'),
 ('usage_analytics:view','Usage Analytics','View'),
 ('activity_logs:view','Activity & Audit Logs','View'),
 ('subscriptions:view','Subscriptions','View'),
 ('subscriptions:manage','Subscriptions','Manage'),
 ('plans:view','Plans','View'),
 ('plans:manage','Plans','Manage'),
 ('trials:manage','Free Trials','Manage'),
 ('payments:view','Payments','View'),
 ('payments:manage','Payments','Manage'),
 ('invoices:view','Subscription Invoices','View'),
 ('renewals:manage','Renewals','Manage'),
 ('revenue_reports:view','Revenue Reports','View'),
 ('platform_roles:view','System Roles & Permissions','View'),
 ('platform_roles:manage','System Roles & Permissions','Manage'),
 ('platform_users:manage','Platform Administrators','Manage'),
 ('global_settings:view','Global Settings','View'),
 ('global_settings:manage','Global Settings','Manage')
ON CONFLICT (permission_key) DO UPDATE SET category = EXCLUDED.category, label = EXCLUDED.label;

-- Safe defaults for the two operational roles. Super Admin is handled as an explicit bypass.
INSERT INTO platform.platform_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM platform.platform_roles r
JOIN platform.platform_permissions p ON p.permission_key IN (
 'platform_dashboard:view','platform_tenants:view','support_requests:view','support_requests:manage',
 'support_requests:escalate','usage_analytics:view','activity_logs:view','subscriptions:view'
)
WHERE r.role_key = 'PLATFORM_SUPPORT_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO platform.platform_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM platform.platform_roles r
JOIN platform.platform_permissions p ON p.permission_key IN (
 'platform_dashboard:view','platform_tenants:view','platform_tenants:manage','activity_logs:view',
 'subscriptions:view','subscriptions:manage','plans:view','plans:manage','trials:manage',
 'payments:view','payments:manage','invoices:view','renewals:manage','revenue_reports:view'
)
WHERE r.role_key = 'PLATFORM_FINANCE_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO platform.platform_role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM platform.platform_roles r CROSS JOIN platform.platform_permissions p
WHERE r.role_key = 'PLATFORM_SUPER_ADMIN'
ON CONFLICT DO NOTHING;
