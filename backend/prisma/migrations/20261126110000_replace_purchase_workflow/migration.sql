ALTER TABLE "purchase_invoices" RENAME TO "_legacy_purchase_invoices";
ALTER TABLE "purchase_invoice_items" RENAME TO "_legacy_purchase_invoice_items";
ALTER TABLE "_legacy_purchase_invoices" RENAME CONSTRAINT "purchase_invoices_pkey" TO "_legacy_purchase_invoices_pkey";
ALTER TABLE "_legacy_purchase_invoice_items" RENAME CONSTRAINT "purchase_invoice_items_pkey" TO "_legacy_purchase_invoice_items_pkey";

ALTER TABLE "suppliers"
  ADD COLUMN IF NOT EXISTS "credit_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rating" DECIMAL(3,2) NOT NULL DEFAULT 0;

CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','REJECTED','CONVERTED','CANCELLED');
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','FULLY_RECEIVED','CLOSED','CANCELLED');
CREATE TYPE "GrnStatus" AS ENUM ('DRAFT','POSTED','CANCELLED');
CREATE TYPE "PurchaseInvoiceMode" AS ENUM ('DIRECT','AGAINST_PO_GRN');
CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_PAID','PAID','CANCELLED');
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('DRAFT','APPROVED','POSTED','CANCELLED');
CREATE TYPE "PurchasePaymentStatus" AS ENUM ('DRAFT','POSTED','CANCELLED');
CREATE TYPE "PurchasePaymentType" AS ENUM ('BILL_PAYMENT','ADVANCE','RETURN_ADJUSTMENT');
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING','APPROVED','REJECTED','SENT_BACK','DELEGATED','CANCELLED');
CREATE TYPE "PurchaseChargeType" AS ENUM ('LOADING','PACKING','INSURANCE','FREIGHT','OTHER');
CREATE TYPE "DiscountType" AS ENUM ('PERCENT','AMOUNT');
CREATE TYPE "FreightAllocationMethod" AS ENUM ('VALUE','QUANTITY','WEIGHT');

CREATE TABLE "purchase_requests" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID,
  "request_number" TEXT NOT NULL,
  "request_date" TIMESTAMP(3) NOT NULL,
  "department" TEXT,
  "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_request_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_request_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(15,3) NOT NULL,
  "required_date" TIMESTAMP(3),
  "preferred_rate" DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_orders" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "purchase_request_id" UUID,
  "order_number" TEXT NOT NULL,
  "order_date" TIMESTAMP(3) NOT NULL,
  "expected_date" TIMESTAMP(3),
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "warehouse_id" UUID NOT NULL,
  "over_receipt_tolerance" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "prices_include_tax" BOOLEAN NOT NULL DEFAULT false,
  "invoice_discount_type" "DiscountType",
  "invoice_discount_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "additional_charges" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "calculation_rule" JSONB NOT NULL DEFAULT '{}',
  "tax_summary" JSONB NOT NULL DEFAULT '{}',
  "notes" TEXT,
  "terms" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_order_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_order_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(15,3) NOT NULL,
  "received_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "invoiced_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "unit_rate" DECIMAL(15,4) NOT NULL,
  "discount_type" "DiscountType" NOT NULL DEFAULT 'AMOUNT',
  "discount_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "taxable_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grn" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "purchase_order_id" UUID,
  "warehouse_id" UUID NOT NULL,
  "grn_number" TEXT NOT NULL,
  "grn_date" TIMESTAMP(3) NOT NULL,
  "status" "GrnStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "grn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grn_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "grn_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "purchase_order_item_id" UUID,
  "quantity" DECIMAL(15,3) NOT NULL,
  "rejected_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(15,4) NOT NULL,
  "landed_cost" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "batch_number" TEXT,
  "serial_number" TEXT,
  "expiry_date" TIMESTAMP(3),
  CONSTRAINT "grn_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_invoices" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "purchase_order_id" UUID,
  "journal_entry_id" UUID,
  "invoice_number" TEXT NOT NULL,
  "supplier_bill_number" TEXT NOT NULL,
  "invoice_date" TIMESTAMP(3) NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "mode" "PurchaseInvoiceMode" NOT NULL DEFAULT 'DIRECT',
  "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "warehouse_id" UUID,
  "prices_include_tax" BOOLEAN NOT NULL DEFAULT false,
  "invoice_discount_type" "DiscountType",
  "invoice_discount_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "additional_charges" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "balance_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "calculation_rule" JSONB NOT NULL DEFAULT '{}',
  "tax_summary" JSONB NOT NULL DEFAULT '{}',
  "idempotency_key" TEXT,
  "posted_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "cancellation_reason" TEXT,
  "notes" TEXT,
  "terms" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_invoice_grns" (
  "purchase_invoice_id" UUID NOT NULL,
  "grn_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoice_grns_pkey" PRIMARY KEY ("purchase_invoice_id","grn_id")
);

CREATE TABLE "purchase_invoice_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_invoice_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "grn_item_id" UUID,
  "purchase_order_item_id" UUID,
  "description" TEXT,
  "quantity" DECIMAL(15,3) NOT NULL,
  "unit_rate" DECIMAL(15,4) NOT NULL,
  "discount_type" "DiscountType" NOT NULL DEFAULT 'AMOUNT',
  "discount_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "taxable_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "landed_cost" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "batch_number" TEXT,
  "serial_number" TEXT,
  "expiry_date" TIMESTAMP(3),
  CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_invoice_charges" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_invoice_id" UUID NOT NULL,
  "charge_type" "PurchaseChargeType" NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "is_taxable" BOOLEAN NOT NULL DEFAULT false,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "allocation_method" "FreightAllocationMethod",
  "account_id" UUID,
  CONSTRAINT "purchase_invoice_charges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_returns" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "journal_entry_id" UUID,
  "return_number" TEXT NOT NULL,
  "return_date" TIMESTAMP(3) NOT NULL,
  "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'DRAFT',
  "warehouse_id" UUID NOT NULL,
  "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "calculation_rule" JSONB NOT NULL DEFAULT '{}',
  "tax_summary" JSONB NOT NULL DEFAULT '{}',
  "reason" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_return_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_return_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "invoice_item_id" UUID,
  "quantity" DECIMAL(15,3) NOT NULL,
  "unit_rate" DECIMAL(15,4) NOT NULL,
  "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "taxable_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT "purchase_return_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_payments" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "payment_number" TEXT NOT NULL,
  "payment_date" TIMESTAMP(3) NOT NULL,
  "payment_type" "PurchasePaymentType" NOT NULL DEFAULT 'BILL_PAYMENT',
  "mode" "PaymentMode" NOT NULL DEFAULT 'BANK_TRANSFER',
  "amount" DECIMAL(15,2) NOT NULL,
  "allocated_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "unallocated_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "status" "PurchasePaymentStatus" NOT NULL DEFAULT 'DRAFT',
  "bank_account_id" UUID,
  "journal_entry_id" UUID,
  "reference" TEXT,
  "notes" TEXT,
  "idempotency_key" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_payment_allocations" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_payment_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  CONSTRAINT "purchase_payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_payment_allocations_unique" UNIQUE ("purchase_payment_id","purchase_invoice_id")
);

CREATE TABLE "approval_rules" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID,
  "department" TEXT,
  "document_type" TEXT NOT NULL,
  "min_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "max_amount" DECIMAL(15,2),
  "levels" JSONB NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_requests" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "document_type" TEXT NOT NULL,
  "document_id" UUID NOT NULL,
  "rule_id" UUID,
  "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "current_level" INTEGER NOT NULL DEFAULT 1,
  "requested_by" UUID NOT NULL,
  "reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "approval_history" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "approval_request_id" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "level" INTEGER NOT NULL,
  "reason" TEXT,
  "delegated_to" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "purchase_attachments" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "document_type" TEXT NOT NULL,
  "document_id" UUID NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_path" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "size" INTEGER NOT NULL,
  "checksum" TEXT,
  "uploaded_by" UUID NOT NULL,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_number_series" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID,
  "document_type" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "current_number" INTEGER NOT NULL DEFAULT 1,
  "padding" INTEGER NOT NULL DEFAULT 4,
  "suffix" TEXT,
  "reset_period" TEXT NOT NULL DEFAULT 'YEAR',
  "reset_year" INTEGER,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "document_number_series_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_number_series_unique" UNIQUE ("business_id","branch_id","document_type")
);

CREATE UNIQUE INDEX "purchase_requests_branch_request_number_key" ON "purchase_requests"("branch_id","request_number");
CREATE INDEX "purchase_requests_lookup_idx" ON "purchase_requests"("business_id","branch_id","status");
CREATE UNIQUE INDEX "purchase_orders_branch_order_number_key" ON "purchase_orders"("branch_id","order_number");
CREATE INDEX "purchase_orders_lookup_idx" ON "purchase_orders"("business_id","branch_id","status","supplier_id");
CREATE UNIQUE INDEX "grn_branch_number_key" ON "grn"("branch_id","grn_number");
CREATE INDEX "grn_lookup_idx" ON "grn"("business_id","branch_id","status","supplier_id");
CREATE UNIQUE INDEX "purchase_invoices_supplier_bill_key" ON "purchase_invoices"("branch_id","supplier_bill_number");
CREATE UNIQUE INDEX "purchase_invoices_number_key" ON "purchase_invoices"("branch_id","invoice_number");
CREATE UNIQUE INDEX "purchase_invoices_idempotency_key" ON "purchase_invoices"("idempotency_key");
CREATE INDEX "purchase_invoices_lookup_idx" ON "purchase_invoices"("business_id","branch_id","status","supplier_id");
CREATE UNIQUE INDEX "purchase_returns_number_key" ON "purchase_returns"("branch_id","return_number");
CREATE UNIQUE INDEX "purchase_payments_number_key" ON "purchase_payments"("branch_id","payment_number");
CREATE UNIQUE INDEX "purchase_payments_idempotency_key" ON "purchase_payments"("idempotency_key");
CREATE INDEX "approval_rules_lookup_idx" ON "approval_rules"("business_id","branch_id","document_type","is_active");
CREATE INDEX "approval_requests_lookup_idx" ON "approval_requests"("business_id","branch_id","document_type","status");
CREATE INDEX "purchase_attachments_lookup_idx" ON "purchase_attachments"("business_id","branch_id","document_type","document_id");

ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_branch_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requests" ADD CONSTRAINT "purchase_requests_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_request_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_request_items" ADD CONSTRAINT "purchase_request_items_variant_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_order_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_variant_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grn" ADD CONSTRAINT "grn_branch_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grn" ADD CONSTRAINT "grn_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "grn" ADD CONSTRAINT "grn_order_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_grn_fkey" FOREIGN KEY ("grn_id") REFERENCES "grn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grn_items" ADD CONSTRAINT "grn_items_variant_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_branch_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_order_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_invoice_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_variant_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_grns" ADD CONSTRAINT "purchase_invoice_grns_invoice_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_grns" ADD CONSTRAINT "purchase_invoice_grns_grn_fkey" FOREIGN KEY ("grn_id") REFERENCES "grn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_invoice_charges" ADD CONSTRAINT "purchase_invoice_charges_invoice_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_branch_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_invoice_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_return_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_return_items" ADD CONSTRAINT "purchase_return_items_variant_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_branch_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_payments" ADD CONSTRAINT "purchase_payments_supplier_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_payment_allocations" ADD CONSTRAINT "purchase_payment_allocations_payment_fkey" FOREIGN KEY ("purchase_payment_id") REFERENCES "purchase_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_payment_allocations" ADD CONSTRAINT "purchase_payment_allocations_invoice_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_request_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stock_movements"
  ADD COLUMN IF NOT EXISTS "reference_document_type" TEXT,
  ADD COLUMN IF NOT EXISTS "batch_number" TEXT,
  ADD COLUMN IF NOT EXISTS "serial_number" TEXT,
  ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "stock_movements_idempotency_key" ON "stock_movements"("idempotency_key");

-- Default purchase account mappings for existing businesses.
INSERT INTO "chart_of_accounts" ("id","business_id","code","name","group","sub_group","description","is_system","is_active","created_at","updated_at")
SELECT uuidv7(), b."id", v.code, v.name, v."group"::"AccountGroup", v.sub_group, v.description, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "businesses" b
CROSS JOIN (VALUES
  ('1000','Business Bank','ASSET','Bank','Default bank account'),
  ('1010','Cash on Hand','ASSET','Cash','Default cash account'),
  ('1020','Inventory','ASSET','Inventory','Purchase inventory'),
  ('1051','Input CGST','ASSET','Tax','Input CGST credit'),
  ('1052','Input SGST','ASSET','Tax','Input SGST credit'),
  ('1053','Input IGST','ASSET','Tax','Input IGST credit'),
  ('2010','Accounts Payable','LIABILITY','AP','Supplier payables'),
  ('2020','Supplier Advances','ASSET','Advance','Supplier advance payments'),
  ('5020','Purchase / Cost of Goods','EXPENSE','Purchase','Purchase expense'),
  ('5030','Purchase Discounts','INCOME','Discount','Discount received')
) AS v(code,name,"group",sub_group,description)
ON CONFLICT ("business_id","code") DO NOTHING;

-- Default branch-wise purchase document number series.
INSERT INTO "document_number_series" ("id","business_id","branch_id","document_type","prefix","current_number","padding","reset_period","is_active","created_at","updated_at")
SELECT uuidv7(), br."business_id", br."id", v.document_type, v.prefix, 1, 4, 'YEAR', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "branches" br
CROSS JOIN (VALUES
  ('PR','PR-'),
  ('PO','PO-'),
  ('GRN','GRN-'),
  ('PI','PI-'),
  ('PRN','DN-'),
  ('PAY','PP-')
) AS v(document_type,prefix)
ON CONFLICT ("business_id","branch_id","document_type") DO NOTHING;

-- Granular purchase module permissions.
INSERT INTO "permissions" ("id","resource","action","description")
SELECT uuidv7(), v.resource, v.action, v.description
FROM (VALUES
  ('purchase_request','view','View purchase requests'),('purchase_request','create','Create purchase requests'),('purchase_request','edit','Edit purchase requests'),('purchase_request','approve','Approve purchase requests'),('purchase_request','cancel','Cancel purchase requests'),
  ('purchase_order','view','View purchase orders'),('purchase_order','create','Create purchase orders'),('purchase_order','edit','Edit purchase orders'),('purchase_order','approve','Approve purchase orders'),('purchase_order','cancel','Cancel purchase orders'),
  ('grn','view','View GRNs'),('grn','create','Create GRNs'),('grn','edit','Edit GRNs'),('grn','post','Post GRNs'),('grn','cancel','Cancel GRNs'),
  ('purchase_invoice','view','View purchase invoices'),('purchase_invoice','create','Create purchase invoices'),('purchase_invoice','edit','Edit purchase invoices'),('purchase_invoice','approve','Approve purchase invoices'),('purchase_invoice','post','Post purchase invoices'),('purchase_invoice','cancel','Cancel purchase invoices'),('purchase_invoice','print','Print purchase invoices'),('purchase_invoice','export','Export purchase invoices'),
  ('purchase_return','view','View purchase returns'),('purchase_return','create','Create purchase returns'),('purchase_return','approve','Approve purchase returns'),('purchase_return','post','Post purchase returns'),('purchase_return','cancel','Cancel purchase returns'),
  ('purchase_payment','view','View purchase payments'),('purchase_payment','create','Create purchase payments'),('purchase_payment','cancel','Cancel purchase payments'),
  ('purchase_attachment','view','View purchase attachments'),('purchase_attachment','create','Upload purchase attachments'),('purchase_attachment','delete','Delete purchase attachments')
) AS v(resource,action,description)
ON CONFLICT ("resource","action") DO NOTHING;

INSERT INTO "role_permissions" ("id","role_id","permission_id")
SELECT uuidv7(), r."id", p."id"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('BUSINESS_OWNER','BUSINESS_ADMIN','PURCHASE_MANAGER','ACCOUNTANT')
  AND (p."resource" LIKE 'purchase_%' OR p."resource" = 'grn')
ON CONFLICT DO NOTHING;

-- Preserve direct invoice data from the legacy workflow.
INSERT INTO "purchase_invoices" (
  "id","business_id","branch_id","supplier_id","journal_entry_id","invoice_number","supplier_bill_number",
  "invoice_date","due_date","mode","status","taxable_amount","cgst_amount","sgst_amount","igst_amount",
  "total_tax","grand_total","paid_amount","balance_amount","calculation_rule","tax_summary","posted_at",
  "created_by","version","created_at","updated_at"
)
SELECT
  l."id",
  b."business_id",
  l."branch_id",
  l."supplier_id",
  l."journal_entry_id",
  l."bill_number",
  l."bill_number",
  l."bill_date",
  l."due_date",
  'DIRECT',
  CASE WHEN l."status"::text IN ('CANCELLED') THEN 'CANCELLED'::"PurchaseInvoiceStatus" ELSE 'APPROVED'::"PurchaseInvoiceStatus" END,
  l."taxable_amount",
  l."cgst_amount",
  l."sgst_amount",
  l."igst_amount",
  l."total_tax",
  l."grand_total",
  l."paid_amount",
  l."grand_total" - l."paid_amount",
  '{"legacy":true,"migration":"20261126110000","engine":"direct_invoice"}',
  '{}',
  l."created_at",
  '00000000-0000-0000-0000-000000000000',
  1,
  l."created_at",
  l."updated_at"
FROM "_legacy_purchase_invoices" l
JOIN "branches" b ON b."id" = l."branch_id";

INSERT INTO "purchase_invoice_items" (
  "id","purchase_invoice_id","variant_id","quantity","unit_rate","discount_type","discount_value",
  "discount_amount","taxable_value","tax_rate","cgst_amount","sgst_amount","igst_amount","total_amount"
)
SELECT
  l."id",
  l."purchase_invoice_id",
  l."variant_id",
  l."quantity",
  l."unit_price",
  'AMOUNT',
  0,
  0,
  l."taxable_value",
  l."gst_rate",
  l."cgst_amount",
  l."sgst_amount",
  l."igst_amount",
  l."total_amount"
FROM "_legacy_purchase_invoice_items" l;

INSERT INTO "purchase_payments" (
  "id","business_id","branch_id","supplier_id","payment_number","payment_date","payment_type","mode",
  "amount","allocated_amount","unallocated_amount","status","reference","notes","created_by","created_at","updated_at"
)
SELECT
  p."id",
  b."business_id",
  p."branch_id",
  p."supplier_id",
  COALESCE(p."reference", 'PMT-' || substr(p."id"::text, 1, 8)),
  p."payment_date",
  'BILL_PAYMENT',
  p."mode",
  p."amount",
  COALESCE((SELECT SUM(a."amount") FROM "payment_allocations" a WHERE a."payment_id" = p."id" AND a."purchase_invoice_id" IS NOT NULL),0),
  p."amount" - COALESCE((SELECT SUM(a."amount") FROM "payment_allocations" a WHERE a."payment_id" = p."id" AND a."purchase_invoice_id" IS NOT NULL),0),
  'POSTED',
  p."reference",
  p."notes",
  '00000000-0000-0000-0000-000000000000',
  p."created_at",
  p."created_at"
FROM "payments" p
JOIN "branches" b ON b."id" = p."branch_id"
WHERE p."type" = 'SUPPLIER_DISBURSEMENT' AND p."supplier_id" IS NOT NULL;

INSERT INTO "purchase_payment_allocations" ("purchase_payment_id","purchase_invoice_id","amount")
SELECT a."payment_id", a."purchase_invoice_id", a."amount"
FROM "payment_allocations" a
WHERE a."purchase_invoice_id" IS NOT NULL;

ALTER TABLE "payment_allocations" DROP CONSTRAINT IF EXISTS "payment_allocations_purchase_invoice_id_fkey";
ALTER TABLE "payment_allocations" DROP COLUMN IF EXISTS "purchase_invoice_id";

DROP TABLE "_legacy_purchase_invoice_items";
DROP TABLE "_legacy_purchase_invoices";
