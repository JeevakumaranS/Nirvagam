import { PlanTier, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const plans = [
    {
      name: 'Starter',
      tier: PlanTier.STARTER,
      monthlyPrice: 199,
      yearlyPrice: 1990,
      maxUsers: 2,
      maxBranches: 1,
      maxInvoices: 500,
      features: ['GST Billing', 'Customer & Supplier Master', 'Basic Reports'],
    },
    {
      name: 'Business',
      tier: PlanTier.BUSINESS,
      monthlyPrice: 499,
      yearlyPrice: 4990,
      maxUsers: 5,
      maxBranches: 3,
      maxInvoices: 2500,
      features: ['GST & Non-GST Billing', 'Inventory Tracking', 'Double-Entry Accounting', 'POS Billing'],
    },
    {
      name: 'Professional',
      tier: PlanTier.PROFESSIONAL,
      monthlyPrice: 999,
      yearlyPrice: 9990,
      maxUsers: 15,
      maxBranches: 10,
      maxInvoices: 10000,
      features: ['All Business Features', 'Multi-Warehouse', 'GSTR Data Preparation', 'Audit Logs', 'Document Storage'],
    },
    {
      name: 'Enterprise',
      tier: PlanTier.ENTERPRISE,
      monthlyPrice: 2999,
      yearlyPrice: 29990,
      maxUsers: 999,
      maxBranches: 999,
      maxInvoices: 999999,
      features: ['Unlimited Everything', 'Dedicated Support', 'Custom Integrations', 'AI Analytics Ready'],
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { tier: plan.tier },
      update: plan,
      create: plan,
    });
  }

  const resources = [
    'business', 'branch', 'user', 'role', 'customer', 'supplier', 'product', 'inventory',
    'sales_invoice', 'quotation', 'sales_order', 'credit_note', 'purchase_invoice',
    'purchase_order', 'debit_note', 'payment', 'expense', 'accounting', 'journal_entry',
    'financial_period', 'stock_adjustment', 'warehouse', 'pos', 'gst_report', 'report',
    'settings', 'subscription',
  ];
  const actions = ['view', 'create', 'edit', 'delete', 'approve', 'cancel', 'export', 'print', 'access_reports'];
  const permissions = [];

  for (const resource of resources) {
    for (const action of actions) {
      permissions.push(await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action, description: `Permission to ${action} ${resource}` },
      }));
    }
  }

  const roleDefinitions = [
    ['SUPER_ADMIN', 'Platform Super Administrator with complete system access'],
    ['BUSINESS_OWNER', 'Complete business access'],
    ['BUSINESS_ADMIN', 'Business configuration and management'],
    ['ACCOUNTANT', 'Accounting and financial reports'],
    ['MANAGER', 'Sales, purchase and inventory'],
    ['SALES_EXECUTIVE', 'Billing and customer management'],
    ['CASHIER', 'POS and sales billing'],
    ['PURCHASE_MANAGER', 'Purchase and suppliers'],
    ['INVENTORY_MANAGER', 'Stock and warehouses'],
    ['AUDITOR', 'Read-only financial access'],
    ['CUSTOM_USER', 'Permission-based access'],
  ] as const;
  const roles = new Map<string, string>();

  for (const [name, description] of roleDefinitions) {
    const existing = await prisma.role.findFirst({
      where: { name, businessId: null },
      select: { id: true },
    });
    const role = existing
      ? await prisma.role.update({
          where: { id: existing.id },
          data: { description, isSystem: true },
          select: { id: true },
        })
      : await prisma.role.create({
          data: { name, description, isSystem: true },
          select: { id: true },
        });
    roles.set(name, role.id);
  }

  const permissionKeys = (roleResources: string[], roleActions: string[]) =>
    roleResources.flatMap((resource) => roleActions.map((action) => `${resource}:${action}`));
  const allPermissions = new Set(permissions.map(({ resource, action }) => `${resource}:${action}`));
  const rolePermissions: Record<string, Set<string>> = {
    SUPER_ADMIN: allPermissions,
    BUSINESS_OWNER: allPermissions,
    BUSINESS_ADMIN: new Set([
      ...permissionKeys([
        'business', 'branch', 'user', 'role', 'customer', 'supplier', 'product', 'inventory',
        'sales_invoice', 'quotation', 'sales_order', 'purchase_invoice', 'purchase_order',
        'accounting', 'report', 'gst_report', 'settings', 'subscription', 'warehouse', 'pos',
      ], ['view', 'create', 'edit', 'export', 'print', 'access_reports']),
      ...permissionKeys(['sales_invoice', 'purchase_invoice', 'purchase_order', 'accounting'], ['approve']),
    ]),
    ACCOUNTANT: new Set(permissionKeys(
      ['accounting', 'journal_entry', 'financial_period', 'payment', 'sales_invoice', 'purchase_invoice', 'report', 'gst_report'],
      ['view', 'create', 'edit', 'approve', 'export', 'print', 'access_reports'],
    )),
    MANAGER: new Set(permissionKeys(
      ['sales_invoice', 'purchase_invoice', 'purchase_order', 'product', 'inventory', 'stock_adjustment', 'warehouse', 'customer', 'supplier', 'report'],
      ['view', 'create', 'edit', 'export', 'print', 'access_reports'],
    )),
    SALES_EXECUTIVE: new Set([
      ...permissionKeys(['sales_invoice', 'customer', 'quotation', 'sales_order'], ['view', 'create', 'edit']),
      ...permissionKeys(['product', 'inventory', 'report'], ['view', 'access_reports']),
    ]),
    CASHIER: new Set([
      ...permissionKeys(['pos', 'sales_invoice'], ['view', 'create']),
      ...permissionKeys(['customer', 'product', 'inventory'], ['view']),
    ]),
    PURCHASE_MANAGER: new Set([
      ...permissionKeys(['purchase_invoice', 'purchase_order'], ['view', 'create', 'edit', 'approve']),
      ...permissionKeys(['supplier'], ['view', 'create', 'edit']),
      ...permissionKeys(['inventory', 'product', 'report'], ['view', 'edit', 'access_reports']),
    ]),
    INVENTORY_MANAGER: new Set([
      ...permissionKeys(['inventory', 'stock_adjustment'], ['view', 'create', 'edit', 'approve']),
      ...permissionKeys(['product', 'warehouse'], ['view', 'create', 'edit']),
      ...permissionKeys(['branch', 'report'], ['view', 'access_reports']),
    ]),
    AUDITOR: new Set(permissionKeys(resources, ['view', 'export', 'print', 'access_reports'])),
    CUSTOM_USER: new Set(),
  };

  for (const [name, grants] of Object.entries(rolePermissions)) {
    const roleId = roles.get(name);
    if (!roleId) continue;

    await prisma.rolePermission.deleteMany({ where: { roleId } });
    const permissionIds = permissions
      .filter(({ resource, action }) => grants.has(`${resource}:${action}`))
      .map(({ id }) => id);
    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      });
    }
  }

  console.log('System plans, permissions, and roles are ready.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
