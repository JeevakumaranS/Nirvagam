import { getTenantSchemaMigrations } from './tenant-schema-migrations';

describe('tenant schema migrations', () => {
  it('includes member profile fields required by tenant user provisioning', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261125120000_user_member_profile_fields'
    );

    expect(migration).toBeDefined();
    expect(migration?.sql).toContain('ADD COLUMN "member_type"');
    expect(migration?.sql).toContain('ADD COLUMN "status"');
    expect(migration?.sql).toContain('ADD COLUMN "joining_date"');
    expect(migration?.sql).toContain('ADD COLUMN "reports_to_id"');
  });

  it('includes registration fields for newly provisioned tenant business profiles', () => {
    const migrations = getTenantSchemaMigrations();
    const memberFieldsIndex = migrations.findIndex(
      (item) => item.name === '20261125120000_user_member_profile_fields'
    );
    const registrationFieldsIndex = migrations.findIndex(
      (item) => item.name === '20261125124000_business_registration_profile_fields'
    );
    const registrationFields = migrations[registrationFieldsIndex];

    expect(registrationFieldsIndex).toBeGreaterThan(memberFieldsIndex);
    expect(registrationFields?.sql).toContain('ADD COLUMN "district"');
    expect(registrationFields?.sql).toContain('ADD COLUMN "jurisdiction"');
  });

  it('removes the product reorder level from existing tenant schemas', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126100000_remove_product_reorder_level'
    );

    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "reorder_level"');
  });

  it('moves inventory balances and history to branches before dropping warehouses', () => {
    const migrations = getTenantSchemaMigrations();
    const reorderLevelIndex = migrations.findIndex(
      (item) => item.name === '20261126100000_remove_product_reorder_level'
    );
    const inventoryMigrationIndex = migrations.findIndex(
      (item) => item.name === '20261126104500_replace_warehouses_with_branch_inventory'
    );
    const migration = migrations[inventoryMigrationIndex];

    expect(inventoryMigrationIndex).toBeGreaterThan(reorderLevelIndex);
    expect(migration?.sql).toContain('SUM("quantity")');
    expect(migration?.sql).toContain('UPDATE "stock_movements"');
    expect(migration?.sql).toContain('DROP TABLE "warehouses"');
  });

  it('converts adjustment movement history before removing adjustment types', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126110200_remove_inventory_adjustment_operations'
    );

    expect(migration?.sql).toContain("SET \"type\" = 'MANUAL_IN'");
    expect(migration?.sql).toContain("SET \"type\" = 'MANUAL_OUT'");
    expect(migration?.sql).toContain('DROP TYPE "StockMovementType"');
    expect(migration?.sql).toContain("WHERE \"resource\" = 'stock_adjustment'");
  });

  it('removes product category and brand fields and tables', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126113200_remove_product_categories_and_brands'
    );

    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "category_id"');
    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "brand_id"');
    expect(migration?.sql).toContain('DROP TABLE IF EXISTS "categories"');
    expect(migration?.sql).toContain('DROP TABLE IF EXISTS "brands"');
  });

  it('drops sales price columns from products and variants', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126113500_remove_sales_price_columns'
    );

    expect(migration?.sql).toContain('ALTER TABLE "products"\n  DROP COLUMN IF EXISTS "sales_price"');
    expect(migration?.sql).toContain('ALTER TABLE "product_variants"\n  DROP COLUMN IF EXISTS "sales_price"');
  });

  it('removes batch and expiry fields from tenant inventory data', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126120500_remove_batch_expiry_tracking'
    );

    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "batch_number"');
    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "expiry_date"');
    expect(migration?.sql).toContain("WHERE \"tracking_mode\" IN ('BATCH', 'EXPIRY')");
    expect(migration?.sql).toContain("DELETE FROM \"custom_fields\"");
  });

  it('removes serial tracking fields from inventory and purchasing tables', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126135200_remove_serial_tracking'
    );

    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "tracking_mode"');
    expect(migration?.sql.match(/DROP COLUMN IF EXISTS "serial_number"/g)).toHaveLength(3);
  });

  it('adds standard units, variant metadata and tracked stock balances', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126142200_add_dynamic_inventory_variants_and_units'
    );

    expect(migration?.sql).toContain("'Tablets', 'TBZ'");
    expect(migration?.sql).toContain('ADD COLUMN IF NOT EXISTS "has_variants"');
    expect(migration?.sql).toContain('CREATE TABLE IF NOT EXISTS "stock_tracking_balances"');
    expect(migration?.sql).toContain('"tracking_key"');
  });

  it('removes adjustment movement types and tracking data from tenant schemas', () => {
    const migrations = getTenantSchemaMigrations();
    const variantsIndex = migrations.findIndex(
      (item) => item.name === '20261126142200_add_dynamic_inventory_variants_and_units'
    );
    const removalIndex = migrations.findIndex(
      (item) => item.name === '20261126150900_remove_adjustments_and_tracking'
    );
    const migration = migrations[removalIndex];

    expect(removalIndex).toBeGreaterThan(variantsIndex);
    expect(migration?.sql).toContain("WHERE \"type\"::TEXT LIKE 'ADJUSTMENT_%'");
    expect(migration?.sql).toContain('DROP TABLE IF EXISTS "stock_tracking_balances"');
    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "tracking_mode"');
    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "batch_number"');
    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "expiry_date"');
    expect(migration?.sql).toContain('DROP COLUMN IF EXISTS "serial_number"');
    expect(migration?.sql).toContain("e.enumlabel NOT LIKE 'ADJUSTMENT_%'");
  });

  it('marks commonly used units for the product quick-select list', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126153500_add_unit_quick_select'
    );

    expect(migration?.sql).toContain('ADD COLUMN IF NOT EXISTS "is_quick_select"');
    expect(migration?.sql).toContain("IN ('BDL', 'DOZ', 'MTR', 'KGS', 'LTR', 'PCS', 'UNT')");
  });

  it('protects legacy built-in units from deletion', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126154000_reclassify_legacy_default_units'
    );

    expect(migration?.sql).toContain('SET "is_standard" = TRUE');
    expect(migration?.sql).toContain("('Gram', 'GRAM')");
    expect(migration?.sql).toContain("('Kilogram', 'KG')");
  });

  it('keeps only product quick-select units classified as standard', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126154500_set_only_quick_units_as_standard'
    );

    expect(migration?.sql).toContain('SET "is_standard" = "is_quick_select"');
  });

  it('moves kilograms from the default units to the custom units list', () => {
    const migration = getTenantSchemaMigrations().find(
      (item) => item.name === '20261126155000_remove_kilograms_from_quick_select'
    );

    expect(migration?.sql).toContain('SET "is_quick_select" = FALSE');
    expect(migration?.sql).toContain('"is_standard" = FALSE');
    expect(migration?.sql).toContain('WHERE "symbol" = \'KGS\'');
  });
});
