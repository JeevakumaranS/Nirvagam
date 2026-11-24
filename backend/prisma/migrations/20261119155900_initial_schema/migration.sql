-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('STARTER', 'BUSINESS', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'INDIVIDUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "IndustryType" AS ENUM ('RETAIL', 'WHOLESALE', 'SUPERMARKET', 'TEXTILE', 'GROCERY', 'ELECTRICAL', 'HARDWARE', 'MEDICAL', 'RESTAURANT', 'MANUFACTURING', 'DISTRIBUTOR', 'SERVICE', 'TRADING', 'OTHER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN_PURCHASE', 'OUT_SALE', 'IN_TRANSFER', 'OUT_TRANSFER', 'ADJUSTMENT_ADD', 'ADJUSTMENT_SUB', 'RETURN_IN_CREDIT_NOTE', 'RETURN_OUT_DEBIT_NOTE');

-- CreateEnum
CREATE TYPE "AccountGroup" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('TAX_INVOICE', 'BILL_OF_SUPPLY', 'NON_GST', 'PROFORMA', 'POS_RECEIPT');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('CUSTOMER_RECEIPT', 'SUPPLIER_DISBURSEMENT');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'BANK_TRANSFER', 'UPI', 'CARD', 'CHEQUE', 'CREDIT');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIALING',
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "monthly_price" DECIMAL(10,2) NOT NULL,
    "yearly_price" DECIMAL(10,2) NOT NULL,
    "max_users" INTEGER NOT NULL,
    "max_branches" INTEGER NOT NULL,
    "max_invoices" INTEGER NOT NULL,
    "features" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenant_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "auto_renew" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "businesses" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenant_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "trade_name" TEXT NOT NULL,
    "business_type" "BusinessType" NOT NULL DEFAULT 'PROPRIETORSHIP',
    "industry" "IndustryType" NOT NULL DEFAULT 'RETAIL',
    "pan" TEXT,
    "tan" TEXT,
    "cin" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "logo_url" TEXT,
    "signature_url" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "enabled_modules" JSONB NOT NULL DEFAULT '["sales", "purchase", "inventory", "accounting", "pos", "gst"]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_head_office" BOOLEAN NOT NULL DEFAULT false,
    "gstin" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gst_registrations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "gstin" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gst_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_periods" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_sequences" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "branch_id" UUID,
    "document_type" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "padding" INTEGER NOT NULL DEFAULT 4,
    "suffix" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_branch_assignments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_branch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_rates" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "cgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igst_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "decimal_places" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "category_id" UUID,
    "brand_id" UUID,
    "unit_id" UUID NOT NULL,
    "tax_rate_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "hsn_code" TEXT,
    "description" TEXT,
    "purchase_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sales_price" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "mrp" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "min_stock_level" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_tax_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "purchase_price" DECIMAL(15,2) NOT NULL,
    "sales_price" DECIMAL(15,2) NOT NULL,
    "mrp" DECIMAL(15,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "billing_street" TEXT NOT NULL,
    "billing_city" TEXT NOT NULL,
    "billing_state" TEXT NOT NULL,
    "billing_state_code" TEXT NOT NULL,
    "billing_pincode" TEXT NOT NULL,
    "shipping_street" TEXT,
    "shipping_city" TEXT,
    "shipping_state" TEXT,
    "shipping_state_code" TEXT,
    "shipping_pincode" TEXT,
    "credit_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit_period_days" INTEGER NOT NULL DEFAULT 30,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company_name" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "gstin" TEXT,
    "pan" TEXT,
    "address_street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "state_code" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "credit_period_days" INTEGER NOT NULL DEFAULT 30,
    "opening_balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "branch_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_balances" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "warehouse_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "warehouse_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unit_cost" DECIMAL(15,2) NOT NULL,
    "total_cost" DECIMAL(15,2) NOT NULL,
    "reference_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "group" "AccountGroup" NOT NULL,
    "sub_group" TEXT,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "business_id" UUID NOT NULL,
    "entry_number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "narration" TEXT NOT NULL,
    "reference" TEXT,
    "is_posted" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_lines" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "journal_entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoices" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "branch_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "journal_entry_id" UUID,
    "invoice_type" "InvoiceType" NOT NULL DEFAULT 'TAX_INVOICE',
    "invoice_number" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'POSTED',
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "round_off" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "terms" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_invoice_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "sales_invoice_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "taxable_value" DECIMAL(15,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "sales_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "branch_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "journal_entry_id" UUID,
    "bill_number" TEXT NOT NULL,
    "bill_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'POSTED',
    "taxable_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "purchase_invoice_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" DECIMAL(15,2) NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "taxable_value" DECIMAL(15,2) NOT NULL,
    "gst_rate" DECIMAL(5,2) NOT NULL,
    "cgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "sgst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "igst_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "branch_id" UUID NOT NULL,
    "type" "PaymentType" NOT NULL,
    "customer_id" UUID,
    "supplier_id" UUID,
    "mode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "amount" DECIMAL(15,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "payment_id" UUID NOT NULL,
    "sales_invoice_id" UUID,
    "purchase_invoice_id" UUID,
    "amount" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "branch_id" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "expense_date" TIMESTAMP(3) NOT NULL,
    "payment_mode" "PaymentMode" NOT NULL DEFAULT 'CASH',
    "gstin" TEXT,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "receipt_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "tenant_id" UUID NOT NULL,
    "business_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "diff" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "plans_tier_key" ON "plans"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "branches_business_id_code_key" ON "branches"("business_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "gst_registrations_gstin_key" ON "gst_registrations"("gstin");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_business_id_name_key" ON "fiscal_periods"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "document_sequences_business_id_branch_id_document_type_key" ON "document_sequences"("business_id", "branch_id", "document_type");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_resource_action_key" ON "permissions"("resource", "action");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_user_id_role_id_key" ON "user_roles"("user_id", "role_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_branch_assignments_user_id_branch_id_key" ON "user_branch_assignments"("user_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_business_id_symbol_key" ON "units"("business_id", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "categories_business_id_slug_key" ON "categories"("business_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_business_id_name_key" ON "brands"("business_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "products_business_id_sku_key" ON "products"("business_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_branch_id_code_key" ON "warehouses"("branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "stock_balances_warehouse_id_variant_id_key" ON "stock_balances"("warehouse_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_business_id_code_key" ON "chart_of_accounts"("business_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sales_invoices_branch_id_invoice_number_key" ON "sales_invoices"("branch_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_branch_id_bill_number_key" ON "purchase_invoices"("branch_id", "bill_number");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gst_registrations" ADD CONSTRAINT "gst_registrations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_sequences" ADD CONSTRAINT "document_sequences_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_assignments" ADD CONSTRAINT "user_branch_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_assignments" ADD CONSTRAINT "user_branch_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_rates" ADD CONSTRAINT "tax_rates_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tax_rate_id_fkey" FOREIGN KEY ("tax_rate_id") REFERENCES "tax_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_balances" ADD CONSTRAINT "stock_balances_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chart_of_accounts" ADD CONSTRAINT "chart_of_accounts_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoices" ADD CONSTRAINT "sales_invoices_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_invoice_items" ADD CONSTRAINT "sales_invoice_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_sales_invoice_id_fkey" FOREIGN KEY ("sales_invoice_id") REFERENCES "sales_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_purchase_invoice_id_fkey" FOREIGN KEY ("purchase_invoice_id") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

