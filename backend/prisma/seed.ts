import { PrismaClient, PlanTier, TenantStatus, BusinessType, IndustryType, AccountGroup } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('--- NIRVAGAM DATABASE SEEDING INITIATED ---');

  // 1. Seed Plans
  const plans = [
    {
      name: 'Starter',
      tier: PlanTier.STARTER,
      monthlyPrice: 199.0,
      yearlyPrice: 1990.0,
      maxUsers: 2,
      maxBranches: 1,
      maxInvoices: 500,
      features: ['GST Billing', 'Customer & Supplier Master', 'Basic Reports'],
    },
    {
      name: 'Business',
      tier: PlanTier.BUSINESS,
      monthlyPrice: 499.0,
      yearlyPrice: 4990.0,
      maxUsers: 5,
      maxBranches: 3,
      maxInvoices: 2500,
      features: ['GST & Non-GST Billing', 'Inventory Tracking', 'Double-Entry Accounting', 'POS Billing'],
    },
    {
      name: 'Professional',
      tier: PlanTier.PROFESSIONAL,
      monthlyPrice: 999.0,
      yearlyPrice: 9990.0,
      maxUsers: 15,
      maxBranches: 10,
      maxInvoices: 10000,
      features: ['All Business Features', 'Multi-Warehouse', 'GSTR Data Preparation', 'Audit Logs', 'Document Storage'],
    },
    {
      name: 'Enterprise',
      tier: PlanTier.ENTERPRISE,
      monthlyPrice: 2999.0,
      yearlyPrice: 29990.0,
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
  console.log('✓ Subscription plans seeded.');

  // 2. Seed Permissions
  const resources = [
    'business',
    'branch',
    'user',
    'role',
    'customer',
    'supplier',
    'product',
    'inventory',
    'sales_invoice',
    'quotation',
    'sales_order',
    'credit_note',
    'purchase_invoice',
    'purchase_order',
    'debit_note',
    'payment',
    'expense',
    'accounting',
    'gst_report',
    'report',
    'settings',
    'subscription',
  ];
  const actions = ['view', 'create', 'edit', 'delete', 'approve', 'cancel', 'export', 'print'];

  const createdPermissions = [];
  for (const resource of resources) {
    for (const action of actions) {
      const perm = await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: {
          resource,
          action,
          description: `Permission to ${action} ${resource}`,
        },
      });
      createdPermissions.push(perm);
    }
  }
  console.log(`✓ ${createdPermissions.length} permissions verified/seeded.`);

  // 3. Seed Roles
  const roles = [
    { name: 'SUPER_ADMIN', description: 'Platform Super Administrator with complete system access', isSystem: true },
    { name: 'BUSINESS_OWNER', description: 'Business Owner with complete commercial and financial control', isSystem: true },
    { name: 'BUSINESS_ADMIN', description: 'Business Administrator managing operations and configuration', isSystem: true },
    { name: 'ACCOUNTANT', description: 'Accountant with full ledger, voucher, and financial reporting access', isSystem: true },
    { name: 'MANAGER', description: 'Store / Operations Manager managing billing, inventory and procurement', isSystem: true },
    { name: 'SALES_EXECUTIVE', description: 'Sales staff managing customer invoices and quotes', isSystem: true },
    { name: 'CASHIER', description: 'POS Cashier focused on high-speed checkout and shift reconciliation', isSystem: true },
    { name: 'PURCHASE_MANAGER', description: 'Procurement manager handling vendor POs and GRNs', isSystem: true },
    { name: 'INVENTORY_MANAGER', description: 'Warehouse and stock manager tracking inventory movements', isSystem: true },
    { name: 'AUDITOR', description: 'Read-only access to all financial, statutory, and audit trail records', isSystem: true },
  ];

  for (const roleDef of roles) {
    const existingRole = await prisma.role.findFirst({
      where: { name: roleDef.name, businessId: null },
    });
    const role = existingRole
      ? await prisma.role.update({
          where: { id: existingRole.id },
          data: { description: roleDef.description, isSystem: true },
        })
      : await prisma.role.create({
          data: {
            name: roleDef.name,
            description: roleDef.description,
            isSystem: true,
          },
        });

    // Grant all permissions to SUPER_ADMIN and BUSINESS_OWNER
    if (roleDef.name === 'SUPER_ADMIN' || roleDef.name === 'BUSINESS_OWNER') {
      for (const perm of createdPermissions) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    } else if (roleDef.name === 'AUDITOR') {
      // Auditor gets view, export, print on everything
      for (const perm of createdPermissions.filter((p) => ['view', 'export', 'print'].includes(p.action))) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId: perm.id } },
          update: {},
          create: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }
  console.log('✓ System roles and permissions mapped.');

  // 4. Seed Demo Tenant & Business
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'durozen' },
    update: {},
    create: {
      slug: 'durozen',
      name: 'Durozen Technologies Pvt. Ltd.',
      status: TenantStatus.ACTIVE,
    },
  });

  const businessPlan = await prisma.plan.findUnique({ where: { tier: PlanTier.PROFESSIONAL } });
  if (businessPlan) {
    const existingSubscription = await prisma.subscription.findFirst({
      where: { tenantId: tenant.id, planId: businessPlan.id },
    });
    if (!existingSubscription) {
      await prisma.subscription.create({
        data: {
          tenantId: tenant.id,
          planId: businessPlan.id,
          status: TenantStatus.ACTIVE,
          startDate: new Date(),
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  const existingBusiness = await prisma.business.findFirst({
    where: {
      tenantId: tenant.id,
      legalName: 'Durozen Technologies Private Limited',
    },
  });
  const business = existingBusiness ?? await prisma.business.create({
    data: {
      tenantId: tenant.id,
      legalName: 'Durozen Technologies Private Limited',
      tradeName: 'Nirvagam Business Suite',
      businessType: BusinessType.PRIVATE_LIMITED,
      industry: IndustryType.RETAIL,
      pan: 'ABCDE1234F',
      cin: 'U62090TZ2026PTC038755',
      email: 'contact@durozen.com',
      phone: '+91 9876543210',
      addressLine1: 'Su. Masan Complex, Second Floor, N. Pudhupatti',
      addressLine2: 'Near Pudhupatti Bus Stop, Trichy Highways',
      city: 'Namakkal',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '637020',
      country: 'India',
    },
  });

  // Seed GST Registration
  await prisma.gstRegistration.upsert({
    where: { gstin: '33AAAAA0000A1Z5' },
    update: {},
    create: {
      businessId: business.id,
      gstin: '33AAAAA0000A1Z5',
      legalName: 'Durozen Technologies Private Limited',
      state: 'Tamil Nadu',
      stateCode: '33',
      isDefault: true,
    },
  });

  // Seed Branches
  const hqBranch = await prisma.branch.upsert({
    where: { businessId_code: { businessId: business.id, code: 'HQ' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'Namakkal Head Office',
      code: 'HQ',
      isHeadOffice: true,
      gstin: '33AAAAA0000A1Z5',
      phone: '+91 9876543210',
      email: 'hq@durozen.com',
      addressLine1: 'Su. Masan Complex, Second Floor',
      city: 'Namakkal',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '637020',
    },
  });

  const chennaiBranch = await prisma.branch.upsert({
    where: { businessId_code: { businessId: business.id, code: 'CHN' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'Chennai Retail Branch',
      code: 'CHN',
      isHeadOffice: false,
      gstin: '33AAAAA0000A1Z5',
      phone: '+91 9876543211',
      email: 'chennai@durozen.com',
      addressLine1: 'Anna Salai, T. Nagar',
      city: 'Chennai',
      state: 'Tamil Nadu',
      stateCode: '33',
      pincode: '600017',
    },
  });

  // Default Warehouses
  await prisma.warehouse.upsert({
    where: { branchId_code: { branchId: hqBranch.id, code: 'WH-HQ' } },
    update: {},
    create: {
      branchId: hqBranch.id,
      name: 'Namakkal Central Warehouse',
      code: 'WH-HQ',
      isDefault: true,
    },
  });

  await prisma.warehouse.upsert({
    where: { branchId_code: { branchId: chennaiBranch.id, code: 'WH-CHN' } },
    update: {},
    create: {
      branchId: chennaiBranch.id,
      name: 'Chennai Storefront Stockroom',
      code: 'WH-CHN',
      isDefault: true,
    },
  });

  // Seed Fiscal Period
  await prisma.fiscalPeriod.upsert({
    where: { businessId_name: { businessId: business.id, name: 'FY 2026-2027' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'FY 2026-2027',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isLocked: false,
      isActive: true,
    },
  });

  // Seed Document Sequences
  const seqs = [
    { type: 'TAX_INVOICE', prefix: 'INV-26/', nextNumber: 1001, padding: 4 },
    { type: 'POS_RECEIPT', prefix: 'POS-26/', nextNumber: 5001, padding: 4 },
    { type: 'PURCHASE_INVOICE', prefix: 'PUR-26/', nextNumber: 2001, padding: 4 },
    { type: 'QUOTATION', prefix: 'QUO-26/', nextNumber: 101, padding: 3 },
  ];
  for (const s of seqs) {
    await prisma.documentSequence.upsert({
      where: { businessId_branchId_documentType: { businessId: business.id, branchId: hqBranch.id, documentType: s.type } },
      update: {},
      create: {
        businessId: business.id,
        branchId: hqBranch.id,
        documentType: s.type,
        prefix: s.prefix,
        nextNumber: s.nextNumber,
        padding: s.padding,
      },
    });
  }

  // Seed Tax Rates
  const taxRates = [
    { name: 'GST 0% (Nil Rated)', rate: 0, cgst: 0, sgst: 0, igst: 0 },
    { name: 'GST 5%', rate: 5, cgst: 2.5, sgst: 2.5, igst: 5 },
    { name: 'GST 12%', rate: 12, cgst: 6, sgst: 6, igst: 12 },
    { name: 'GST 18%', rate: 18, cgst: 9, sgst: 9, igst: 18, isDefault: true },
    { name: 'GST 28%', rate: 28, cgst: 14, sgst: 14, igst: 28 },
  ];
  for (const tr of taxRates) {
    await prisma.taxRate.create({
      data: {
        businessId: business.id,
        name: tr.name,
        rate: tr.rate,
        cgstRate: tr.cgst,
        sgstRate: tr.sgst,
        igstRate: tr.igst,
        isDefault: !!tr.isDefault,
      },
    });
  }

  // Seed Units
  const units = [
    { name: 'Pieces', symbol: 'PCS', decimalPlaces: 0, isDefault: true },
    { name: 'Box', symbol: 'BOX', decimalPlaces: 0 },
    { name: 'Kilogram', symbol: 'KG', decimalPlaces: 3 },
    { name: 'Liter', symbol: 'LTR', decimalPlaces: 2 },
    { name: 'Meter', symbol: 'MTR', decimalPlaces: 2 },
  ];
  for (const u of units) {
    await prisma.unit.upsert({
      where: { businessId_symbol: { businessId: business.id, symbol: u.symbol } },
      update: {},
      create: {
        businessId: business.id,
        name: u.name,
        symbol: u.symbol,
        decimalPlaces: u.decimalPlaces,
        isDefault: u.isDefault || false,
      },
    });
  }

  // Seed Chart of Accounts
  const coaAccounts = [
    { code: '1010', name: 'Cash in Hand', group: AccountGroup.ASSET, subGroup: 'Cash' },
    { code: '1020', name: 'HDFC Current Account', group: AccountGroup.ASSET, subGroup: 'Bank' },
    { code: '1030', name: 'Accounts Receivable (Debtors)', group: AccountGroup.ASSET, subGroup: 'Accounts Receivable' },
    { code: '1040', name: 'Merchandise Inventory', group: AccountGroup.ASSET, subGroup: 'Inventory' },
    { code: '1051', name: 'Input CGST', group: AccountGroup.ASSET, subGroup: 'Tax Receivable' },
    { code: '1052', name: 'Input SGST', group: AccountGroup.ASSET, subGroup: 'Tax Receivable' },
    { code: '1053', name: 'Input IGST', group: AccountGroup.ASSET, subGroup: 'Tax Receivable' },
    { code: '2010', name: 'Accounts Payable (Creditors)', group: AccountGroup.LIABILITY, subGroup: 'Accounts Payable' },
    { code: '2021', name: 'Output CGST', group: AccountGroup.LIABILITY, subGroup: 'Tax Payable' },
    { code: '2022', name: 'Output SGST', group: AccountGroup.LIABILITY, subGroup: 'Tax Payable' },
    { code: '2023', name: 'Output IGST', group: AccountGroup.LIABILITY, subGroup: 'Tax Payable' },
    { code: '3010', name: 'Capital Account', group: AccountGroup.EQUITY, subGroup: 'Equity' },
    { code: '3020', name: 'Retained Earnings', group: AccountGroup.EQUITY, subGroup: 'Equity' },
    { code: '4010', name: 'Sales Revenue', group: AccountGroup.INCOME, subGroup: 'Operating Revenue' },
    { code: '4020', name: 'Service Income', group: AccountGroup.INCOME, subGroup: 'Operating Revenue' },
    { code: '5010', name: 'Cost of Goods Sold (COGS)', group: AccountGroup.EXPENSE, subGroup: 'Direct Expense' },
    { code: '5020', name: 'Purchase Expenses', group: AccountGroup.EXPENSE, subGroup: 'Direct Expense' },
    { code: '5030', name: 'Office Rent Expense', group: AccountGroup.EXPENSE, subGroup: 'Indirect Expense' },
    { code: '5040', name: 'Staff Salaries', group: AccountGroup.EXPENSE, subGroup: 'Indirect Expense' },
    { code: '5050', name: 'Electricity Charges', group: AccountGroup.EXPENSE, subGroup: 'Indirect Expense' },
    { code: '5090', name: 'Round-off Account', group: AccountGroup.EXPENSE, subGroup: 'Adjustment' },
  ];

  for (const acc of coaAccounts) {
    await prisma.chartOfAccount.upsert({
      where: { businessId_code: { businessId: business.id, code: acc.code } },
      update: {},
      create: {
        businessId: business.id,
        code: acc.code,
        name: acc.name,
        group: acc.group,
        subGroup: acc.subGroup,
        isSystem: true,
      },
    });
  }
  console.log(`✓ ${coaAccounts.length} standard Chart of Accounts seeded.`);

  // 5. Seed Admin User
  const passwordHash = await bcrypt.hash('Password@123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@nirvagam.com' },
    update: { passwordHash },
    create: {
      tenantId: tenant.id,
      email: 'admin@nirvagam.com',
      passwordHash,
      firstName: 'Jeeva',
      lastName: 'Admin',
      phone: '+91 9876543210',
    },
  });

  // Assign Business Owner Role
  const ownerRole = await prisma.role.findFirst({ where: { name: 'BUSINESS_OWNER' } });
  if (ownerRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: adminUser.id, roleId: ownerRole.id } },
      update: {},
      create: { userId: adminUser.id, roleId: ownerRole.id },
    });
  }

  // Assign Branch
  await prisma.userBranchAssignment.upsert({
    where: { userId_branchId: { userId: adminUser.id, branchId: hqBranch.id } },
    update: {},
    create: {
      userId: adminUser.id,
      branchId: hqBranch.id,
      isDefault: true,
    },
  });

  console.log('✓ Admin user seeded (Email: admin@nirvagam.com, Password: Password@123)');
  console.log('--- NIRVAGAM DATABASE SEEDING COMPLETED SUCCESSFULLY ---');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
