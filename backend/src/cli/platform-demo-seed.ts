import { Pool, PoolClient } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

type DemoBusiness = {
  key: string;
  slug: string;
  name: string;
  legalName: string;
  industry: string;
  status: string;
  planCode: string;
  subscriptionStatus: string;
  periodEnd: string;
  paymentStatus: string;
  paymentAmount: number;
  ticketStatus: string;
  ticketSubject: string;
};

const businesses: DemoBusiness[] = [
  {
    key: 'platform-demo-a', slug: 'demo-a-aurora-textiles', name: 'Aurora Textiles', legalName: 'Aurora Textiles Private Limited',
    industry: 'TEXTILE', status: 'active', planCode: 'DEMO_GROWTH', subscriptionStatus: 'ACTIVE', periodEnd: '2099-12-31',
    paymentStatus: 'PAID', paymentAmount: 4999, ticketStatus: 'RESOLVED', ticketSubject: 'Resolved invoice export request',
  },
  {
    key: 'platform-demo-b', slug: 'demo-b-bluebird-foods', name: 'Bluebird Foods', legalName: 'Bluebird Foods Private Limited',
    industry: 'RESTAURANT', status: 'trialing', planCode: 'DEMO_STARTER', subscriptionStatus: 'TRIALING', periodEnd: '2099-12-31',
    paymentStatus: 'PENDING', paymentAmount: 1999, ticketStatus: 'OPEN', ticketSubject: 'Unable to configure trial workspace',
  },
  {
    key: 'platform-demo-c', slug: 'demo-c-cascade-electricals', name: 'Cascade Electricals', legalName: 'Cascade Electricals Private Limited',
    industry: 'ELECTRICAL', status: 'suspended', planCode: 'DEMO_GROWTH', subscriptionStatus: 'EXPIRED', periodEnd: '2025-12-31',
    paymentStatus: 'PENDING', paymentAmount: 4999, ticketStatus: 'PENDING', ticketSubject: 'Renewal payment follow-up',
  },
];

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envCandidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), 'backend/.env'),
  ];
  const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
  const env = envPath ? fs.readFileSync(envPath, 'utf8') : '';
  const match = env.match(/^DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/m);
  if (!match) throw new Error('DATABASE_URL is required');
  return match[1];
}

async function one<T = any>(client: PoolClient, sql: string, params: any[] = []): Promise<T | null> {
  const result = await client.query(sql, params);
  return (result.rows[0] as T) || null;
}

async function seedBusiness(client: PoolClient, demo: DemoBusiness) {
  const plan = await one<{ id: string }>(client, `INSERT INTO platform.plans (code, name, price_monthly, currency, is_active)
    VALUES ($1, $2, $3, 'INR', TRUE) ON CONFLICT (code) DO UPDATE SET code = EXCLUDED.code RETURNING id`,
    [demo.planCode, demo.planCode === 'DEMO_STARTER' ? 'Demo Starter' : 'Demo Growth', demo.planCode === 'DEMO_STARTER' ? 1999 : 4999]);
  if (!plan) throw new Error(`Unable to create plan ${demo.planCode}`);
  await client.query(`INSERT INTO platform.plan_limits (plan_id) VALUES ($1) ON CONFLICT (plan_id) DO NOTHING`, [plan.id]);

  const tenant = await one<{ id: string }>(client, `INSERT INTO platform.tenants
    (slug, display_name, schema_name, status, plan_id, metadata)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    ON CONFLICT (slug) DO UPDATE SET display_name = platform.tenants.display_name
    RETURNING id`, [demo.slug, demo.name, `t_demo_${demo.key.slice(-1)}`, demo.status, plan.id, JSON.stringify({ demoSeedKey: demo.key })]);
  if (!tenant) throw new Error(`Unable to create tenant ${demo.slug}`);

  const profile = await one<{ id: string }>(client, `INSERT INTO platform.business_profiles
    (tenant_id, legal_name, trade_name, business_type, industry, gstin, pan, address_line1, city, state,
     state_code, pincode, financial_year_start, financial_year_end, invoice_prefix, currency, enabled_modules)
    VALUES ($1, $2, $3, 'PRIVATE_LIMITED', $4, $5, $6, 'Demo Business Park', 'Chennai', 'Tamil Nadu',
      '33', $7, '2026-04-01', '2027-03-31', $8, 'INR', $9::jsonb)
    ON CONFLICT DO NOTHING RETURNING id`, [tenant.id, demo.legalName, demo.name, demo.industry,
      `33${demo.key.slice(-1)}1234567${demo.key.slice(-1)}`, `A${demo.key.slice(-1)}12345678`,
      `60000${demo.key.slice(-1)}`, `DEM${demo.key.slice(-1)}-`, JSON.stringify(['sales', 'accounting', 'reports'])]);
  const profileId = profile?.id || (await one<{ id: string }>(client, 'SELECT id FROM platform.business_profiles WHERE tenant_id = $1', [tenant.id]))?.id;
  if (!profileId) throw new Error(`Unable to create profile for ${demo.slug}`);
  await client.query(`INSERT INTO platform.business_branches
    (profile_id, code, name, is_head_office, address_line1, city, state, state_code, pincode)
    VALUES ($1, 'HQ', 'Head Office', TRUE, 'Demo Business Park', 'Chennai', 'Tamil Nadu', '33', $2)
    ON CONFLICT (profile_id, code) DO NOTHING`, [profileId, `60000${demo.key.slice(-1)}`]);

  const subscription = await one<{ id: string }>(client, `INSERT INTO platform.subscriptions
    (tenant_id, plan_id, status, current_period_start, current_period_end, auto_renew)
    SELECT $1, $2, $3, NOW(), $4::timestamptz, $5
    WHERE NOT EXISTS (SELECT 1 FROM platform.subscriptions WHERE tenant_id = $1)
    RETURNING id`, [tenant.id, plan.id, demo.subscriptionStatus, demo.periodEnd, demo.subscriptionStatus === 'ACTIVE']);
  const subscriptionId = subscription?.id || (await one<{ id: string }>(client,
    'SELECT id FROM platform.subscriptions WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 1', [tenant.id]))?.id;
  if (!subscriptionId) throw new Error(`Unable to create subscription for ${demo.slug}`);

  await client.query(`INSERT INTO platform.subscription_payments
    (tenant_id, subscription_id, invoice_number, amount, currency, status, due_at, paid_at)
    VALUES ($1, $2, $3, $4, 'INR', $5::text, NOW(), CASE WHEN $5::text = 'PAID' THEN NOW() ELSE NULL END)
    ON CONFLICT (invoice_number) DO NOTHING`, [tenant.id, subscriptionId, `DEMO-${demo.key.toUpperCase()}`, demo.paymentAmount, demo.paymentStatus]);
  await client.query(`INSERT INTO platform.support_requests
    (tenant_id, subject, description, priority, status, resolution, resolved_at)
    SELECT $1::uuid, $2::text, $3::text, $4::text, $5::text, CASE WHEN $5::text = 'RESOLVED' THEN 'Resolved in demo seed' ELSE NULL END,
      CASE WHEN $5::text = 'RESOLVED' THEN NOW() ELSE NULL END
    WHERE NOT EXISTS (SELECT 1 FROM platform.support_requests WHERE tenant_id = $1::uuid AND subject = $2::text)`,
    [tenant.id, demo.ticketSubject, `Development-only sample request for ${demo.name}`, demo.ticketStatus === 'OPEN' ? 'HIGH' : 'MEDIUM', demo.ticketStatus]);
  await client.query(`INSERT INTO platform.platform_audit_log (action, target_type, target_id, metadata)
    SELECT 'DEMO_DATA_SEEDED', 'TENANT', $1::text, $2::jsonb
    WHERE NOT EXISTS (SELECT 1 FROM platform.platform_audit_log WHERE target_id = $1::text AND metadata->>'demoSeedKey' = $3::text)`,
    [tenant.id, JSON.stringify({ demoSeedKey: demo.key, subscriptionStatus: demo.subscriptionStatus }), demo.key]);
}

async function main() {
  if ((process.env.NODE_ENV || 'development').toLowerCase() === 'production') {
    throw new Error('The platform demo seed is disabled when NODE_ENV=production');
  }
  const pool = new Pool({ connectionString: loadDatabaseUrl() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const demo of businesses) await seedBusiness(client, demo);
    await client.query('COMMIT');
    console.log('Platform demo seed completed: 3 idempotent businesses and linked records ensured.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
