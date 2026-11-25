BEGIN;

-- Existing tenant-owned data is intentionally removed during this one-time transition.
UPDATE platform.tenants
SET status = 'suspended',
    schema_version = 0,
    metadata = COALESCE(metadata, '{}'::jsonb) || '{"requires_reprovisioning": true}'::jsonb,
    updated_at = NOW();

DO $$
DECLARE
  tenant_schema RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM platform.tenants
    WHERE schema_name !~ '^t_[a-f0-9]{8,32}$'
  ) THEN
    RAISE EXCEPTION 'A registered tenant has an invalid schema name';
  END IF;

  FOR tenant_schema IN
    SELECT nspname AS schema_name
    FROM pg_namespace
    WHERE nspname ~ '^t_[a-f0-9]{8,32}$'
  LOOP
    EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', tenant_schema.schema_name);
  END LOOP;
END
$$;

DELETE FROM platform.tenant_memberships;
DELETE FROM platform.identities tenant_identity
WHERE NOT EXISTS (
  SELECT 1
  FROM platform.platform_users platform_user
  WHERE platform_user.identity_id = tenant_identity.id
);

DROP TABLE IF EXISTS platform.business_branches, platform.business_profiles CASCADE;

DROP TABLE IF EXISTS
  public.tenants,
  public.plans,
  public.subscriptions,
  public.businesses,
  public.branches,
  public.gst_registrations,
  public.fiscal_periods,
  public.document_sequences,
  public.users,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.user_roles,
  public.user_branch_assignments,
  public.tax_rates,
  public.units,
  public.categories,
  public.brands,
  public.products,
  public.product_variants,
  public.customers,
  public.suppliers,
  public.warehouses,
  public.stock_balances,
  public.stock_movements,
  public.chart_of_accounts,
  public.journal_entries,
  public.journal_lines,
  public.sales_invoices,
  public.sales_invoice_items,
  public.purchase_invoices,
  public.purchase_invoice_items,
  public.payments,
  public.payment_allocations,
  public.expenses,
  public.audit_logs,
  public.custom_entities,
  public.custom_fields,
  public.custom_entity_relations,
  public.schema_change_log,
  public.schema_migrations,
  public.tenant_audit_log
CASCADE;

DROP TYPE IF EXISTS
  public."TenantStatus",
  public."PlanTier",
  public."BusinessType",
  public."IndustryType",
  public."StockMovementType",
  public."AccountGroup",
  public."InvoiceType",
  public."InvoiceStatus",
  public."PaymentType",
  public."PaymentMode",
  public."RecurrenceFrequency"
CASCADE;

COMMIT;
