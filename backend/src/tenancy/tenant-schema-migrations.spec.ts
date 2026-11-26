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
});
