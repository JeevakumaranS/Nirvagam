# ADR 002: Metadata-Driven Hybrid Customization Layer for Schema-per-Tenant Multi-Tenancy

## Status
Accepted

## Context
Enterprise Indian ERP users (textiles, retail, manufacturing, pharmaceuticals, logistics) require custom business entities (e.g., *Batch Inspections*, *Weaving Looms*, *Vehicle Logbooks*) and custom fields on core transactions (e.g., *E-Way Bill transporter ID*, *Fabric GSM*, *Expiry Date*, *Customer Credit Rating*).

However, in a multi-tenant ERP:
1. Direct, arbitrary DDL (e.g. users typing `ALTER TABLE` or `CREATE TABLE`) from the UI introduces catastrophic security vulnerabilities (SQL injection, privilege escalation, dropping protected audit/financial constraints).
2. Unrestricted DDL on core financial and inventory tables (`sales_invoices`, `journal_entries`, `journal_lines`, `chart_of_accounts`, `stock_movements`, `gst_settings`) could compromise double-entry accounting integrity, tax compliance (GST filings), and immutability.
3. Rapidly altering database schemas on live tables can cause exclusive table locks (`AccessExclusiveLock`), resulting in production downtime, query timeouts, and connection pool exhaustion.

## Options Considered

### Option 1: Pure Columnar DDL for Every Custom Field
- **Mechanism**: Every custom field triggers `ALTER TABLE <core_table> ADD COLUMN <field_name> <type>`.
- **Drawbacks**: Requires table locks; PostgreSQL has a limit of 1,600 columns per table; DDL migrations for thousands of tenants create immense metadata churn in `pg_attribute`; rollback requires dropping live columns; high risk of lock contention during peak transaction hours.

### Option 2: Pure Key-Value / EAV (Entity-Attribute-Value) Pattern
- **Mechanism**: A generic table `entity_attributes(entity_id, attribute_key, value)`.
- **Drawbacks**: Devastating query performance; requires multiple JOINs for each record; breaks indexing, sorting, filtering, and reporting; completely negates PostgreSQL's relational optimizer.

### Option 3: Metadata-Driven JSONB Hybrid with On-Demand Column Promotion [CHOSEN]
- **Mechanism**:
  1. **Protected Core Invariant**: Core accounting, ledger, invoice, inventory, tax, and audit tables are immutable in their core columns. No existing core column can ever be altered or dropped.
  2. **Metadata-Driven Registry**: Every custom entity (`custom_entities`), custom field (`custom_fields`), and relationship (`custom_entity_relations`) is declared as strongly typed metadata with validation rules (regex, min, max, options, required, visible/editable roles).
  3. **Default Storage (`jsonb`)**: Custom fields default to storage in a `custom_data jsonb` column indexed with a PostgreSQL GIN index (`USING GIN (custom_data)`).
     - Writing custom fields requires zero DDL.
     - Validation occurs at the application boundary against metadata.
     - Schema changes are instant, transactional, and risk-free.
  4. **On-Demand Column Promotion**: For high-frequency query fields (e.g., fields heavily used in WHERE clauses, ORDER BY, or financial reporting), a background job promotes the field:
     - `ALTER TABLE <table_name> ADD COLUMN cf_<slug> <data_type>` (nullable).
     - Batch backfills existing values from `custom_data->>'<field_key>'`.
     - Flips metadata storage pointer from `jsonb` to `column`.
  5. **Custom Tables (`ct_<key>`)**: Dedicated tenant-level tables created via validated DDL templates with standard base columns (`id`, `created_at`, `updated_at`, `created_by`, `branch_id`, `is_deleted`, `custom_data jsonb`).
  6. **Safe Widening vs. Protected Narrowing**: Only lossless datatype conversions are applied directly. Lossy conversions require dry-run impact analysis, shadow backup columns (`<field>__bak_v<n>`), and explicit administrative approval.

## Scale Boundaries & Safety Guarantees
- **Namespace Sanitization**: All custom fields are prefixed with `cf_` and custom tables with `ct_`. Identifiers must strictly match `^[a-z][a-z0-9_]{2,40}$` and cannot collide with the PostgreSQL/ERP reserved word blocklist.
- **Tenant Isolation**: DDL operations are executed strictly within `withTenant(ctx, ...)` holding an advisory lock (`pg_advisory_xact_lock(hashtext('customization_' || tenantId))`) with strict `statement_timeout = '5s'` and `lock_timeout = '3s'`.
- **Plan Quotas**: Soft and hard quotas from `platform.plan_limits` (`max_custom_entities`, `max_custom_fields_per_entity`, `max_rows`) prevent runaway resource exhaustion.
