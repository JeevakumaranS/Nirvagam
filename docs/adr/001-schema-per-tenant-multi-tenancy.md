# ADR 001: Schema-per-Tenant Multi-Tenancy Architecture

## Status
Accepted

## Context
Nirvagam Business Suite is an Indian ERP system handling commercial operations (Sales, GST Invoicing, POS, Purchases, GRN, Inventory, Double-Entry General Ledger, Financial Statements).

In multi-tenant SaaS ERPs, tenant isolation is not merely an application concern; it is a critical security and compliance boundary. Business tenants store confidential financial records, GSTIN transactions, journal ledgers, customer pricing, and audit logs. A vulnerability or bug in application query construction must never result in cross-tenant data leakage.

## Options Considered

### Option 1: Shared Database, Shared Schema with Row-Level Isolation (RLS / `tenant_id`)
- **Pros**: Simplest to migrate initially; single set of tables; lowest database catalog overhead.
- **Cons**: High risk of catastrophic cross-tenant data leaks if a single developer query omits `tenant_id` or an ORM bypasses Postgres RLS. Backups, restores, and point-in-time recoveries for a single tenant require selective table exports and complex relational filtering. No physical data boundary for Indian DPDP compliance.

### Option 2: Database-per-Tenant
- **Pros**: Complete physical isolation; distinct database connections; independent server allocation.
- **Cons**: High infrastructure cost and resource consumption (Postgres background workers, connection pools per DB, shared memory). Severe connection pool exhaustion when scaling beyond a few hundred small-and-medium businesses (SMBs). Provisioning takes several seconds to minutes.

### Option 3: Shared Database, Schema-per-Tenant (`platform` + `t_<uuid>`) [CHOSEN]
- **Pros**:
  1. **Strict Security Boundary**: The schema itself is the isolation boundary. SQL queries run inside the tenant's schema search path (`SET LOCAL search_path TO "t_<uuid>", platform, public`). If a query omits a WHERE clause, it only affects that tenant's records.
  2. **Zero-leakage connection pooling**: Connections are returned to the pool after each transaction. Transaction-scoped `SET LOCAL` ensures that when a connection is recycled or passed through PgBouncer in transaction mode, the previous tenant's `search_path` never leaks.
  3. **Independent Tenant Backups & Restores**: A tenant can be dumped and restored using standard `pg_dump -n t_<uuid>` without touching any other tenant's data. Restoring into a test/sandbox environment (`CREATE SCHEMA t_sandbox; pg_restore ...`) is effortless.
  4. **Efficient Resource Utilization**: A single connection pool and database instance comfortably serves hundreds to thousands of SMB tenants with fast onboarding (sub-second schema provisioning).

## Scale Boundaries & Trade-offs
1. **Catalog Bloat**: PostgreSQL stores metadata in system catalogs (`pg_class`, `pg_attribute`, `pg_index`). Having more than 2,000–3,000 schemas with ~40 tables each (80,000–120,000 relations) causes cache misses in `relcache` and slows autovacuum and DDL migrations.
2. **Horizontal Sharding Strategy**:
   - Each `platform.tenants` record includes a `db_cluster` identifier (e.g., `cluster-us-east-1a`, `cluster-in-south-1`).
   - When a database cluster approaches the threshold (1,500 active tenants), new tenant provisioning routes to the next cluster shard seamlessly.
   - Moving a tenant across clusters is a simple `pg_dump -n t_<uuid>` | `pg_restore` operation with a temporary maintenance lock.

## Key Invariants
- **No User-Derived Schema Names**: Schema names are strictly `t_<short_uuid>` derived from server-generated UUIDs, validated against `/^t_[a-f0-9]{8,32}$/`.
- **Transaction-Scoped Search Path**: Always use `SET LOCAL search_path`, never session-level `SET search_path`.
- **Platform Separation**: Identities, billing, subscription plans, and platform users (like `SUPER_ADMIN`) reside exclusively in the `platform` schema. Business tables inside `t_<uuid>` reference `platform.identities(id)` without hard foreign keys to preserve independent dump/restore capability.
