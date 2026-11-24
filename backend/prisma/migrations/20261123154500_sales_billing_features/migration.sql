ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'QUOTATION';
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'ESTIMATE';
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'SALES_ORDER';
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'DELIVERY_CHALLAN';
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'CREDIT_NOTE';
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'DEBIT_NOTE';
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'SALES_RETURN';
ALTER TYPE "InvoiceType" ADD VALUE IF NOT EXISTS 'RECURRING_INVOICE';

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'UNPAID';

CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');

ALTER TABLE "sales_invoices"
ADD COLUMN "additional_charges" DECIMAL(15, 2) NOT NULL DEFAULT 0,
ADD COLUMN "prices_include_tax" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "related_invoice_id" UUID,
ADD COLUMN "recurrence_frequency" "RecurrenceFrequency";

ALTER TABLE "sales_invoices"
ADD CONSTRAINT "sales_invoices_related_invoice_id_fkey"
FOREIGN KEY ("related_invoice_id") REFERENCES "sales_invoices"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "sales_invoices_related_invoice_id_idx" ON "sales_invoices"("related_invoice_id");

ALTER TABLE "sales_invoice_items"
ADD COLUMN "unit_name" TEXT;

INSERT INTO "permissions" ("id", "resource", "action", "description")
VALUES (uuidv7(), 'sales_invoice', 'manual_number', 'Can assign manual sales invoice numbers')
ON CONFLICT ("resource", "action") DO NOTHING;

INSERT INTO "role_permissions" ("id", "role_id", "permission_id")
SELECT uuidv7(), roles."id", permissions."id"
FROM "roles" AS roles
CROSS JOIN "permissions" AS permissions
WHERE roles."name" IN ('BUSINESS_OWNER', 'BUSINESS_ADMIN')
  AND permissions."resource" = 'sales_invoice'
  AND permissions."action" = 'manual_number'
ON CONFLICT DO NOTHING;
