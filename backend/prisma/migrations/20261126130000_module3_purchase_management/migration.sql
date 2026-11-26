-- Module 3: Purchase Management (Idempotent Schema + Data Preservation + Default Seeds)

DO $$ BEGIN
  CREATE TYPE "PurchaseTaxRegime" AS ENUM ('GST', 'VAT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventoryCostingMethod" AS ENUM ('WAC', 'FIFO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseRequestStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CLOSED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "GrnStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseInvoiceMode" AS ENUM ('DIRECT', 'AGAINST_PO_GRN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseReturnStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchasePaymentStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchasePaymentType" AS ENUM ('BILL_PAYMENT', 'ADVANCE', 'RETURN_ADJUSTMENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SENT_BACK', 'DELEGATED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "PurchaseChargeType" AS ENUM ('LOADING', 'PACKING', 'INSURANCE', 'FREIGHT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'AMOUNT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "FreightAllocationMethod" AS ENUM ('VALUE', 'QUANTITY', 'WEIGHT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Support manual purchase items (variant_id optional + item_name + unit)
ALTER TABLE "purchase_request_items" ALTER COLUMN "variant_id" DROP NOT NULL;
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "item_name" TEXT;
ALTER TABLE "purchase_request_items" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'PCS';
ALTER TABLE "purchase_order_items" ALTER COLUMN "variant_id" DROP NOT NULL;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "item_name" TEXT;
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'PCS';
ALTER TABLE "grn_items" ALTER COLUMN "variant_id" DROP NOT NULL;
ALTER TABLE "grn_items" ADD COLUMN IF NOT EXISTS "item_name" TEXT;
ALTER TABLE "grn_items" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'PCS';
ALTER TABLE "purchase_invoice_items" ALTER COLUMN "variant_id" DROP NOT NULL;
ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "item_name" TEXT;
ALTER TABLE "purchase_invoice_items" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'PCS';
ALTER TABLE "purchase_return_items" ALTER COLUMN "variant_id" DROP NOT NULL;
ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "item_name" TEXT;
ALTER TABLE "purchase_return_items" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT 'PCS';

-- Extend units table
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "units" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN NOT NULL DEFAULT false;

-- Extend existing inventory & product tables
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "tracking_mode" TEXT NOT NULL DEFAULT 'NONE';
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "min_stock_level" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_tax_inclusive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "over_receipt_tolerance" DECIMAL(5,2);
ALTER TABLE "stock_balances" ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "warehouse_id" UUID;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "reference_document_type" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "performed_by_id" UUID;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "reason" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "batch_number" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMP(3);
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "serial_number" TEXT;
ALTER TABLE "stock_movements" ADD COLUMN IF NOT EXISTS "remaining_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0;

-- Purchase Settings
CREATE TABLE IF NOT EXISTS "purchase_settings" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "tax_regime" "PurchaseTaxRegime" NOT NULL DEFAULT 'GST',
  "costing_method" "InventoryCostingMethod" NOT NULL DEFAULT 'WAC',
  "enable_grn_accrual" BOOLEAN NOT NULL DEFAULT true,
  "block_return_on_insufficient_stock" BOOLEAN NOT NULL DEFAULT true,
  "default_over_receipt_tolerance" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "max_attachment_size_mb" INTEGER NOT NULL DEFAULT 25,
  "allowed_attachment_mime_types" JSONB NOT NULL DEFAULT '["application/pdf","image/jpeg","image/png","image/webp","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/vnd.ms-excel"]'::jsonb,
  "accounts_payable_account_id" UUID,
  "purchase_account_id" UUID,
  "inventory_account_id" UUID,
  "grn_clearing_account_id" UUID,
  "price_variance_account_id" UUID,
  "discount_received_account_id" UUID,
  "freight_account_id" UUID,
  "other_charges_account_id" UUID,
  "input_cgst_account_id" UUID,
  "input_sgst_account_id" UUID,
  "input_igst_account_id" UUID,
  "input_vat_account_id" UUID,
  "supplier_advance_account_id" UUID,
  "default_bank_account_id" UUID,
  "default_cash_account_id" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_settings_business_id_key" UNIQUE ("business_id")
);

-- Ensure purchase tables exist & have all required columns
CREATE TABLE IF NOT EXISTS "purchase_requests" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID,
  "request_number" TEXT NOT NULL,
  "request_date" TIMESTAMP(3) NOT NULL,
  "department" TEXT,
  "currency_code" TEXT NOT NULL DEFAULT 'INR',
  "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "purchase_requests" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'INR';

CREATE TABLE IF NOT EXISTS "purchase_request_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_request_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(15,3) NOT NULL,
  "required_date" TIMESTAMP(3),
  "preferred_rate" DECIMAL(15,2) NOT NULL DEFAULT 0,
  CONSTRAINT "purchase_request_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_orders" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "purchase_request_id" UUID,
  "order_number" TEXT NOT NULL,
  "order_date" TIMESTAMP(3) NOT NULL,
  "expected_date" TIMESTAMP(3),
  "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
  "currency_code" TEXT NOT NULL DEFAULT 'INR',
  "warehouse_id" UUID NOT NULL,
  "over_receipt_tolerance" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "prices_include_tax" BOOLEAN NOT NULL DEFAULT false,
  "invoice_discount_type" "DiscountType",
  "invoice_discount_value" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "additional_charges" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "calculation_rule" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "tax_summary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "notes" TEXT,
  "terms" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_orders" ADD COLUMN IF NOT EXISTS "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "purchase_order_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_order_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "description" TEXT,
  "quantity" DECIMAL(15,3) NOT NULL,
  "received_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "invoiced_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "over_receipt_tolerance" DECIMAL(5,2),
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
ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "over_receipt_tolerance" DECIMAL(5,2);

CREATE TABLE IF NOT EXISTS "purchase_order_charges" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_order_id" UUID NOT NULL,
  "charge_type" "PurchaseChargeType" NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  "is_taxable" BOOLEAN NOT NULL DEFAULT false,
  "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "allocation_method" "FreightAllocationMethod",
  "account_id" UUID,
  CONSTRAINT "purchase_order_charges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "grn" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "purchase_order_id" UUID,
  "warehouse_id" UUID NOT NULL,
  "journal_entry_id" UUID,
  "grn_number" TEXT NOT NULL,
  "grn_date" TIMESTAMP(3) NOT NULL,
  "currency_code" TEXT NOT NULL DEFAULT 'INR',
  "status" "GrnStatus" NOT NULL DEFAULT 'DRAFT',
  "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "posted_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "cancellation_reason" TEXT,
  "notes" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "grn_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "grn" ADD COLUMN IF NOT EXISTS "journal_entry_id" UUID;
ALTER TABLE "grn" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "grn" ADD COLUMN IF NOT EXISTS "total_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "grn" ADD COLUMN IF NOT EXISTS "posted_at" TIMESTAMP(3);
ALTER TABLE "grn" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "grn" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

CREATE TABLE IF NOT EXISTS "grn_items" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "grn_id" UUID NOT NULL,
  "variant_id" UUID NOT NULL,
  "purchase_order_item_id" UUID,
  "quantity" DECIMAL(15,3) NOT NULL,
  "rejected_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "invoiced_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0,
  "unit_cost" DECIMAL(15,4) NOT NULL,
  "landed_cost" DECIMAL(15,4) NOT NULL DEFAULT 0,
  "batch_number" TEXT,
  "serial_number" TEXT,
  "expiry_date" TIMESTAMP(3),
  CONSTRAINT "grn_items_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "grn_items" ADD COLUMN IF NOT EXISTS "invoiced_quantity" DECIMAL(15,3) NOT NULL DEFAULT 0;

ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_invoices" ADD COLUMN IF NOT EXISTS "freight_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "purchase_invoice_grns" (
  "purchase_invoice_id" UUID NOT NULL,
  "grn_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_invoice_grns_pkey" PRIMARY KEY ("purchase_invoice_id", "grn_id")
);

CREATE TABLE IF NOT EXISTS "purchase_invoice_charges" (
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

CREATE TABLE IF NOT EXISTS "purchase_returns" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "journal_entry_id" UUID,
  "return_number" TEXT NOT NULL,
  "return_date" TIMESTAMP(3) NOT NULL,
  "currency_code" TEXT NOT NULL DEFAULT 'INR',
  "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'DRAFT',
  "warehouse_id" UUID NOT NULL,
  "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
  "calculation_rule" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "tax_summary" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "posted_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "cancellation_reason" TEXT,
  "reason" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "posted_at" TIMESTAMP(3);
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "purchase_returns" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

CREATE TABLE IF NOT EXISTS "purchase_return_items" (
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

CREATE TABLE IF NOT EXISTS "purchase_payments" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "payment_number" TEXT NOT NULL,
  "payment_date" TIMESTAMP(3) NOT NULL,
  "currency_code" TEXT NOT NULL DEFAULT 'INR',
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
  "cancelled_at" TIMESTAMP(3),
  "cancellation_reason" TEXT,
  "idempotency_key" TEXT,
  "created_by" UUID NOT NULL,
  "updated_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "is_deleted" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_payments_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "purchase_payments" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE "purchase_payments" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "purchase_payments" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT;

CREATE TABLE IF NOT EXISTS "purchase_payment_allocations" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "purchase_payment_id" UUID NOT NULL,
  "purchase_invoice_id" UUID NOT NULL,
  "amount" DECIMAL(15,2) NOT NULL,
  CONSTRAINT "purchase_payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "approval_rules" (
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
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "approval_requests" (
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
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "approval_history" (
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

CREATE TABLE IF NOT EXISTS "purchase_attachments" (
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

CREATE TABLE IF NOT EXISTS "document_number_series" (
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
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_number_series_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "in_app_notifications" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "branch_id" UUID,
  "user_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "document_type" TEXT,
  "document_id" UUID,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "in_app_notifications_pkey" PRIMARY KEY ("id")
);

-- Seed missing COA accounts per business
INSERT INTO "chart_of_accounts" ("id", "business_id", "code", "name", "group", "is_system", "is_active", "created_at", "updated_at")
SELECT uuidv7(), b.id, a.code, a.name, a.grp::"AccountGroup", true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "businesses" b
CROSS JOIN (
  VALUES
    ('1054', 'Input VAT', 'ASSET'),
    ('2015', 'GRN Clearing / Accrual', 'LIABILITY'),
    ('5025', 'Purchase Price Variance', 'EXPENSE'),
    ('5040', 'Freight Inward', 'EXPENSE'),
    ('5045', 'Purchase Additional Charges', 'EXPENSE')
) AS a(code, name, grp)
WHERE NOT EXISTS (
  SELECT 1 FROM "chart_of_accounts" c WHERE c.business_id = b.id AND c.code = a.code
);

-- Seed default PurchaseSettings per business
INSERT INTO "purchase_settings" ("id", "business_id", "tax_regime", "costing_method", "enable_grn_accrual", "block_return_on_insufficient_stock", "default_over_receipt_tolerance")
SELECT uuidv7(), b.id, 'GST'::"PurchaseTaxRegime", 'WAC'::"InventoryCostingMethod", true, true, 5
FROM "businesses" b
WHERE NOT EXISTS (
  SELECT 1 FROM "purchase_settings" ps WHERE ps.business_id = b.id
);

-- Seed default DocumentNumberSeries per branch
INSERT INTO "document_number_series" ("id", "business_id", "branch_id", "document_type", "prefix", "current_number", "padding", "reset_period", "reset_year", "updated_at")
SELECT uuidv7(), br.business_id, br.id, d.doc_type, d.prefix, 1, 4, 'YEAR', EXTRACT(YEAR FROM CURRENT_DATE)::int, CURRENT_TIMESTAMP
FROM "branches" br
CROSS JOIN (
  VALUES
    ('PR', 'PR-'),
    ('PO', 'PO-'),
    ('GRN', 'GRN-'),
    ('PI', 'PI-'),
    ('PRN', 'PRN-'),
    ('PAY', 'PAY-')
) AS d(doc_type, prefix)
WHERE NOT EXISTS (
  SELECT 1 FROM "document_number_series" s
  WHERE s.business_id = br.business_id AND s.branch_id = br.id AND s.document_type = d.doc_type
);

-- Seed granular purchase permissions
INSERT INTO "permissions" ("id", "resource", "action", "description")
SELECT uuidv7(), r.res, a.act, 'Permission to ' || a.act || ' ' || replace(r.res, '_', ' ')
FROM (
  VALUES
    ('purchase_request'),
    ('purchase_order'),
    ('grn'),
    ('purchase_invoice'),
    ('purchase_return'),
    ('purchase_payment'),
    ('purchase_attachment'),
    ('purchase_approval'),
    ('purchase_report'),
    ('purchase_settings')
) AS r(res)
CROSS JOIN (
  VALUES ('view'), ('create'), ('edit'), ('delete'), ('approve'), ('post'), ('cancel'), ('print'), ('export')
) AS a(act)
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" p WHERE p.resource = r.res AND p.action = a.act
);

-- Grant all purchase permissions to Owner / Admin roles
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT ro.id, p.id
FROM "roles" ro
CROSS JOIN "permissions" p
WHERE (p.resource LIKE 'purchase_%' OR p.resource = 'grn')
  AND (UPPER(ro.name) LIKE '%OWNER%' OR UPPER(ro.name) LIKE '%ADMIN%')
ON CONFLICT DO NOTHING;

