# Customization Layer Operations Runbook

This runbook describes operational procedures for managing custom fields, custom entities (`ct_*`), datatype conversions, and schema change recovery in **Nirvagam Business Suite**.

---

## 1. Safety Invariants & Architecture
1. **Protected Core Tables**:
   `journal_entries`, `journal_lines`, `chart_of_accounts`, `sales_invoices`, `stock_movements`, `gst_settings`, `roles`, `permissions`, `role_permissions`, `tenant_audit_log`, `schema_migrations`, `schema_change_log`.
   *Rule: Core columns, constraints, and audit structures can NEVER be altered or dropped.*
2. **Identifier Namespacing**:
   Custom fields are prefixed with `cf_` (e.g. `cf_fabric_gsm`) and custom tables with `ct_` (e.g. `ct_loom_inspection`). All names are validated against `^[a-z][a-z0-9_]{2,40}$` and the reserved keywords blocklist.
3. **JSONB-First Hybrid Pattern**:
   Custom fields are stored in `custom_data jsonb` on extensible tables (`customers`, `vendors`, `items`, `sales_invoices`, `purchase_orders`, `branches`) with a GIN index (`CREATE INDEX ... USING GIN (custom_data)`).
   Promotion to a physical column is on-demand and zero-downtime.

---

## 2. Promoting a Hot JSONB Field to a Physical Column
When a custom field is heavily used in sorting, filtering, or SQL JOINs, promote it to a dedicated column:
```http
POST /customization/fields/promote
Content-Type: application/json
Authorization: Bearer <TOKEN>

{
  "entityKey": "items",
  "fieldKey": "cf_fabric_gsm"
}
```
### Execution Steps Performed by Engine:
1. `ALTER TABLE items ADD COLUMN IF NOT EXISTS "cf_fabric_gsm" BIGINT;`
2. Batch backfill from JSONB:
   ```sql
   UPDATE items
   SET "cf_fabric_gsm" = (custom_data->>'cf_fabric_gsm')::BIGINT
   WHERE custom_data ? 'cf_fabric_gsm' AND custom_data->>'cf_fabric_gsm' ~ '^[0-9]+$';
   ```
3. Update metadata: `storage = 'column'` and create index.
4. Record in `schema_change_log`.

---

## 3. Datatype Conversions & Rollback Procedures

### A. Preview / Dry-Run Impact Analysis (Always Run First)
```http
POST /customization/fields/datatype/preview
Content-Type: application/json

{
  "entityKey": "customers",
  "fieldKey": "cf_credit_rating",
  "targetType": "integer"
}
```
Response returns:
- `isLossless`: boolean
- `totalRowCount`: integer
- `incompatibleRowCount`: integer
- `sampleIncompatibleValues`: array of invalid values
- `shadowBackupColumn`: `<field>__bak_v<n>`
- `canApplyDirectly`: boolean

### B. Applying a Narrowing Datatype Change
If approved, the engine executes the **expand -> backfill -> swap -> contract** pattern:
1. Renames current column: `ALTER TABLE ... RENAME COLUMN "cf_field" TO "cf_field__bak_v1";`
2. Creates new column with target type: `ALTER TABLE ... ADD COLUMN "cf_field" <new_type>;`
3. Backfills cast data.
4. If an unexpected error occurs during runtime, restore the shadow column:
   ```sql
   -- Instant One-Click Rollback
   ALTER TABLE <table_name> DROP COLUMN "cf_field";
   ALTER TABLE <table_name> RENAME COLUMN "cf_field__bak_v1" TO "cf_field";
   UPDATE custom_fields SET datatype = 'old_type', version = version - 1 WHERE field_key = 'cf_field';
   ```

---

## 4. Archiving vs. Dropping Custom Tables (`ct_*`)

### A. Safe Archiving (Recommended)
To prevent irreversible data loss, deleting a custom entity archives it:
```http
POST /customization/entities/:entityKey/archive
```
- Renames the physical table: `ALTER TABLE ct_name RENAME TO ct_name__archived_<timestamp>;`
- Sets `custom_entities.status = 'archived'`.
- Hides the entity from navigation, CRUD APIs, and forms.

### B. Permanent Purge (After 30-Day Retention Window)
After the 30-day grace period has elapsed:
```bash
# 1. Export cold storage backup
pg_dump -h localhost -U postgres -d nirvagam_db \
  --table="t_xxxx.ct_name__archived_*" \
  --format=custom \
  --file="ct_name_archive.dump"

# 2. Drop table
psql -d nirvagam_db -c 'DROP TABLE "t_xxxx"."ct_name__archived_1795000000" CASCADE;'
```

---

## 5. Schema Drift Detection Job
A scheduled task compares `information_schema.columns` against the metadata registry:
```sql
SELECT c.table_name, c.column_name, c.data_type, cf.datatype as metadata_type
FROM information_schema.columns c
LEFT JOIN custom_fields cf ON cf.field_key = c.column_name
WHERE c.table_schema = current_schema()
  AND (c.column_name LIKE 'cf_%' OR c.table_name LIKE 'ct_%');
```
Any discrepancy is flagged in `schema_change_log` with status `DRIFT_DETECTED` and notified to the administrator.
