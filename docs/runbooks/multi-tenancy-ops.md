# Multi-Tenancy Operations Runbook (Schema-per-Tenant)

This runbook documents operational procedures for managing tenant lifecycles, backups, point-in-time recovery, schema migrations, and horizontal sharding in **Nirvagam Business Suite**.

---

## 1. Architecture Overview
- **Platform Schema (`platform`)**: Stores shared global accounts, identity logins, subscriptions, tenant directory, and cross-tenant audit trails.
- **Tenant Schemas (`t_<short_uuid>`)**: Contains all business transactions, GST invoices, inventory, chart of accounts, and tenant roles.
- **Security Boundary**: Every SQL transaction runs with `SET LOCAL search_path TO "t_<short_uuid>", platform, public;`. Connections returned to the pool or PgBouncer never retain previous tenant search paths.

---

## 2. Tenant Provisioning
### Via CLI:
```bash
npx ts-node backend/src/cli/tenant-cli.ts provision \
  --slug=chennai-traders \
  --name="Chennai Traders PVT LTD" \
  --email="admin@chennaitraders.com"
```
### Via REST API (Super Admin):
```http
POST /platform/tenants
Content-Type: application/json
Authorization: Bearer <SUPER_ADMIN_JWT>

{
  "slug": "chennai-traders",
  "displayName": "Chennai Traders PVT LTD",
  "ownerEmail": "admin@chennaitraders.com",
  "planCode": "ENTERPRISE",
  "region": "ap-south-1"
}
```

---

## 3. Tenant Lifecycle Operations

### A. Suspend / Block Access
Suspension immediately revokes access without destroying business data.
```http
POST /platform/tenants/:tenantId/suspend
Content-Type: application/json

{ "reason": "Overdue invoice for subscription renewal" }
```
- Cache key `platform:tenant:{id}` is evicted. Subsequent requests receive `403 FORBIDDEN (TENANT_SUSPENDED)`.

### B. Resume Tenant
```http
POST /platform/tenants/:tenantId/resume
```

### C. Soft-Delete & 30-Day Cold Storage Purge
1. Mark `platform.tenants.status = 'deleting'` with a 30-day grace window.
2. After 30 days, backup the tenant schema to encrypted S3 / cold storage:
```bash
pg_dump -h $DB_HOST -U $DB_USER -d nirvagam_db \
  --schema="t_8f3a1c2d" \
  --format=custom \
  --file="t_8f3a1c2d_final_archive.dump"

aws s3 cp t_8f3a1c2d_final_archive.dump \
  s3://nirvagam-cold-storage/tenants/t_8f3a1c2d/
```
3. Drop the schema:
```sql
DROP SCHEMA "t_8f3a1c2d" CASCADE;
```

---

## 4. Single-Tenant Backup & Recovery

### A. Backup Single Tenant
```bash
pg_dump -h localhost -U postgres -d nirvagam_db \
  --schema="t_917a4e9d59c2" \
  --format=custom \
  --file="backup_t_917a4e9d59c2.dump"
```

### B. Point-in-Time Restore into New Sandbox / Test Schema
To test or debug without overwriting live tenant data:
```bash
# 1. Create sandbox schema
psql -d nirvagam_db -c 'CREATE SCHEMA "t_sandbox_917a";'

# 2. Restore data into the new schema
pg_restore -d nirvagam_db \
  --schema="t_917a4e9d59c2" \
  --clean --if-exists \
  backup_t_917a4e9d59c2.dump
```

### C. Clone Tenant (for Staging / Demo Environments)
```bash
pg_dump -d nirvagam_db --schema="t_live_source" --format=custom -f /tmp/source.dump
# Substitute schema name in metadata and restore into clone
sed -i 's/t_live_source/t_demo_clone/g' /tmp/source.dump # or use search_path remap
```

---

## 5. Multi-Tenant Schema Migrations

### A. Run Migration Runner
```bash
# Apply migrations to all tenants with 5 parallel workers
npx ts-node backend/src/cli/tenant-cli.ts migrate --concurrency=5

# Dry run mode
npx ts-node backend/src/cli/tenant-cli.ts migrate --dry-run

# Single tenant targeted migration
npx ts-node backend/src/cli/tenant-cli.ts migrate --tenant=kavitha-textiles
```

### B. Inspect Migration Health & Drift
```http
GET /platform/health/migrations
```
Returns:
- Distribution of tenants across schema versions (e.g. 98% on v3, 2% on v2).
- List of failed migrations with error stack and timestamps.

### C. Recovering a Failed Tenant Migration
1. Check `platform.tenant_migrations_registry` for the exact SQL statement that failed.
2. Fix the migration script or write an idempotent hotfix.
3. Re-run migration targeting the specific tenant:
```bash
npx ts-node backend/src/cli/tenant-cli.ts migrate --tenant=<failed_tenant_id>
```

---

## 6. Horizontal Database Sharding Thresholds
- **Threshold Limit**: ~1,500–2,000 active tenants per PostgreSQL cluster.
- **Indicators to Add Shard**:
  1. `pg_class` and `pg_attribute` relation count > 80,000.
  2. Autovacuum worker lag on transaction wrap-around.
  3. Migration run time exceeds 30 minutes for `--all`.
- **Moving a Tenant to a New Cluster Shard**:
  1. Set tenant `status = 'suspended'` (maintenance window).
  2. `pg_dump -n t_xxxx` from source cluster.
  3. `pg_restore` into destination cluster.
  4. Update `platform.tenants.db_cluster = 'cluster-in-south-2'` and set `status = 'active'`.
  5. Invalidate tenant cache.
