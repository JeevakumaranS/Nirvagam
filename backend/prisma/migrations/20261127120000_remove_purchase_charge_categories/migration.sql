DO $$
BEGIN
  IF to_regclass('purchase_additional_charges') IS NULL
     AND to_regclass('purchase_additional_charge_types') IS NOT NULL THEN
    ALTER TABLE purchase_additional_charge_types RENAME TO purchase_additional_charges;
  END IF;
END $$;

ALTER TABLE IF EXISTS purchase_additional_charges
  DROP COLUMN IF EXISTS charge_type;

ALTER TABLE IF EXISTS purchase_order_charges
  DROP COLUMN IF EXISTS charge_type;

ALTER TABLE IF EXISTS purchase_invoice_charges
  DROP COLUMN IF EXISTS charge_type;

ALTER TABLE IF EXISTS purchase_orders
  DROP COLUMN IF EXISTS freight_amount;

ALTER TABLE IF EXISTS purchase_invoices
  DROP COLUMN IF EXISTS freight_amount;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'FreightAllocationMethod'
      AND n.nspname = current_schema()
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'PurchaseChargeAllocationMethod'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TYPE "FreightAllocationMethod" RENAME TO "PurchaseChargeAllocationMethod";
  END IF;
END $$;

DROP TYPE IF EXISTS "PurchaseChargeType";
