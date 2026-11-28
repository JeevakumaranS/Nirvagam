CREATE TABLE IF NOT EXISTS "purchase_invoice_grn" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_invoice_id" UUID NOT NULL,
  "grn_id" UUID NOT NULL,
  CONSTRAINT "purchase_invoice_grn_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_invoice_grn_purchase_invoice_id_grn_id_key"
    UNIQUE ("purchase_invoice_id", "grn_id"),
  CONSTRAINT "purchase_invoice_grn_purchase_invoice_id_fkey"
    FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE,
  CONSTRAINT "purchase_invoice_grn_grn_id_fkey"
    FOREIGN KEY ("grn_id") REFERENCES "grn"("id") ON DELETE CASCADE
);

DO $$
BEGIN
  IF to_regclass(format('%I.%I', current_schema(), 'purchase_invoice_grns')) IS NOT NULL THEN
    INSERT INTO "purchase_invoice_grn" ("id", "purchase_invoice_id", "grn_id")
    SELECT uuidv7(), "purchase_invoice_id", "grn_id"
    FROM "purchase_invoice_grns"
    ON CONFLICT ("purchase_invoice_id", "grn_id") DO NOTHING;
  END IF;
END $$;
