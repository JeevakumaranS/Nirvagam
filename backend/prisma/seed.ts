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
    'journal_entry',
    'financial_period',
    'stock_adjustment',
    'warehouse',
    'pos',
    'gst_report',
    'report',
    'settings',
    'subscription',
  ];
  const actions = ['view', 'create', 'edit', 'delete', 'approve', 'cancel', 'export', 'print', 'access_reports'];

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
    { name: 'BUSINESS_OWNER', description: 'Complete business access', isSystem: true },
    { name: 'BUSINESS_ADMIN', description: 'Business configuration and management', isSystem: true },
    { name: 'ACCOUNTANT', description: 'Accounting and financial reports', isSystem: true },
    { name: 'MANAGER', description: 'Sales, purchase and inventory', isSystem: true },
    { name: 'SALES_EXECUTIVE', description: 'Billing and customer management', isSystem: true },
    { name: 'CASHIER', description: 'POS and sales billing', isSystem: true },
    { name: 'PURCHASE_MANAGER', description: 'Purchase and suppliers', isSystem: true },
    { name: 'INVENTORY_MANAGER', description: 'Stock and warehouses', isSystem: true },
    { name: 'AUDITOR', description: 'Read-only financial access', isSystem: true },
    { name: 'CUSTOM_USER', description: 'Permission-based access', isSystem: true },
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

  }

  const permissionKeys = (resourceNames: string[], actionNames: string[]) =>
    resourceNames.flatMap((resource) => actionNames.map((action) => `${resource}:${action}`));
  const allPermissionKeys = new Set(createdPermissions.map((p) => `${p.resource}:${p.action}`));
  const defaultRolePermissions: Record<string, Set<string>> = {
    SUPER_ADMIN: allPermissionKeys,
    BUSINESS_OWNER: allPermissionKeys,
    BUSINESS_ADMIN: new Set([
      ...permissionKeys(
        [
          'business', 'branch', 'user', 'role', 'customer', 'supplier', 'product', 'inventory',
          'sales_invoice', 'quotation', 'sales_order', 'purchase_invoice', 'purchase_order',
          'accounting', 'report', 'gst_report', 'settings', 'subscription', 'warehouse', 'pos',
        ],
        ['view', 'create', 'edit', 'export', 'print', 'access_reports']
      ),
      ...permissionKeys(['sales_invoice', 'purchase_invoice', 'purchase_order', 'accounting'], ['approve']),
    ]),
    ACCOUNTANT: new Set(permissionKeys(
      ['accounting', 'journal_entry', 'financial_period', 'payment', 'sales_invoice', 'purchase_invoice', 'report', 'gst_report'],
      ['view', 'create', 'edit', 'approve', 'export', 'print', 'access_reports']
    )),
    MANAGER: new Set(permissionKeys(
      ['sales_invoice', 'purchase_invoice', 'purchase_order', 'product', 'inventory', 'stock_adjustment', 'warehouse', 'customer', 'supplier', 'report'],
      ['view', 'create', 'edit', 'export', 'print', 'access_reports']
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
    AUDITOR: new Set(permissionKeys(
      resources,
      ['view', 'export', 'print', 'access_reports']
    )),
    CUSTOM_USER: new Set(),
  };

  for (const [roleName, grants] of Object.entries(defaultRolePermissions)) {
    const role = await prisma.role.findFirst({
      where: { name: roleName, businessId: null },
      select: { id: true },
    });
    if (!role) continue;

    const permissionIds = createdPermissions
      .filter((permission) => grants.has(`${permission.resource}:${permission.action}`))
      .map((permission) => permission.id);
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    if (permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
      });
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

  // 6. Seed Demo Customers
  const customer1 = (await prisma.customer.findFirst({ where: { phone: '+91 9842109876' } })) ||
    (await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Kavitha Silks & Textiles',
        companyName: 'Kavitha Silks Pvt Ltd',
        phone: '+91 9842109876',
        email: 'orders@kavithasilks.com',
        gstin: '33AABCK1234F1Z9',
        billingStreet: '104 Cross Cut Road',
        billingCity: 'Coimbatore',
        billingState: 'Tamil Nadu',
        billingStateCode: '33',
        billingPincode: '641012',
        creditLimit: 150000.0,
        creditPeriodDays: 30,
        openingBalance: 12500.0,
      },
    }));

  const customer2 = (await prisma.customer.findFirst({ where: { phone: '+91 9443212345' } })) ||
    (await prisma.customer.create({
      data: {
        businessId: business.id,
        name: 'Trichy Engineering Works',
        companyName: 'Trichy Engg LLP',
        phone: '+91 9443212345',
        email: 'trichyeng@gmail.com',
        gstin: '33AACCT9876H1Z4',
        billingStreet: '52 Thillai Nagar',
        billingCity: 'Tiruchirappalli',
        billingState: 'Tamil Nadu',
        billingStateCode: '33',
        billingPincode: '620018',
        creditLimit: 75000.0,
        creditPeriodDays: 15,
        openingBalance: 0,
      },
    }));
  console.log('✓ Demo customers seeded.');

  // 7. Seed Demo Suppliers
  const supplier1 = (await prisma.supplier.findFirst({ where: { phone: '+91 9789012345' } })) ||
    (await prisma.supplier.create({
      data: {
        businessId: business.id,
        name: 'Sree Textiles Mills',
        companyName: 'Sree Mills India Ltd',
        phone: '+91 9789012345',
        email: 'sales@sreemills.com',
        gstin: '33AABCS5432G1Z1',
        addressStreet: 'Ring Road, Avinashi Bypass',
        city: 'Tirupur',
        state: 'Tamil Nadu',
        stateCode: '33',
        pincode: '641604',
        creditPeriodDays: 45,
        openingBalance: 24000.0,
      },
    }));
  console.log('✓ Demo suppliers seeded.');

  // 8. Seed Demo Products & Stock Balances
  const unitPcs = await prisma.unit.findFirst({ where: { businessId: business.id, symbol: 'PCS' } });
  const tax18 = await prisma.taxRate.findFirst({ where: { businessId: business.id, rate: 18 } });
  const tax5 = await prisma.taxRate.findFirst({ where: { businessId: business.id, rate: 5 } });
  const centralWh = await prisma.warehouse.findFirst({ where: { branchId: hqBranch.id } });

  const demoProducts = [
    {
      name: 'Premium Oxford Cotton Shirt',
      sku: 'SHIRT-OXF-01',
      barcode: '890100100001',
      hsnCode: '6205',
      purchasePrice: 480.0,
      salesPrice: 950.0,
      mrp: 1199.0,
      minStockLevel: 20,
      taxRateId: tax5?.id || tax18?.id || '',
      stockQty: 85,
    },
    {
      name: 'Stretch Chino Trousers',
      sku: 'CHINO-STR-02',
      barcode: '890100100002',
      hsnCode: '6203',
      purchasePrice: 650.0,
      salesPrice: 1299.0,
      mrp: 1499.0,
      minStockLevel: 15,
      taxRateId: tax18?.id || '',
      stockQty: 60,
    },
    {
      name: 'Pure Linen Formal Kurta',
      sku: 'KURTA-LIN-03',
      barcode: '890100100003',
      hsnCode: '6211',
      purchasePrice: 750.0,
      salesPrice: 1599.0,
      mrp: 1899.0,
      minStockLevel: 10,
      taxRateId: tax5?.id || tax18?.id || '',
      stockQty: 35,
    },
    {
      name: 'Classic Pique Polo T-Shirt',
      sku: 'POLO-PIQ-04',
      barcode: '890100100004',
      hsnCode: '6105',
      purchasePrice: 280.0,
      salesPrice: 599.0,
      mrp: 799.0,
      minStockLevel: 25,
      taxRateId: tax5?.id || tax18?.id || '',
      stockQty: 110,
    },
  ];

  for (const p of demoProducts) {
    if (!p.taxRateId || !unitPcs) continue;

    const existingProduct = await prisma.product.findFirst({
      where: { businessId: business.id, sku: p.sku },
    });

    const createdProd = existingProduct || (await prisma.product.create({
      data: {
        businessId: business.id,
        unitId: unitPcs.id,
        taxRateId: p.taxRateId,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        hsnCode: p.hsnCode,
        purchasePrice: p.purchasePrice,
        salesPrice: p.salesPrice,
        mrp: p.mrp,
        minStockLevel: p.minStockLevel,
      },
    }));

    const variant = (await prisma.productVariant.findUnique({ where: { sku: p.sku } })) ||
      (await prisma.productVariant.create({
        data: {
          productId: createdProd.id,
          name: 'Standard',
          sku: p.sku,
          barcode: p.barcode,
          purchasePrice: p.purchasePrice,
          salesPrice: p.salesPrice,
          mrp: p.mrp,
        },
      }));

    if (centralWh) {
      await prisma.stockBalance.upsert({
        where: { warehouseId_variantId: { warehouseId: centralWh.id, variantId: variant.id } },
        update: { quantity: p.stockQty },
        create: {
          warehouseId: centralWh.id,
          variantId: variant.id,
          quantity: p.stockQty,
          averageCost: p.purchasePrice,
        },
      });
    }
  }
  console.log('✓ Demo catalog products & stock balances seeded.');

  // 9. Seed Initial Sales Invoice
  const existingInv = await prisma.salesInvoice.findFirst({ where: { branchId: hqBranch.id } });
  if (!existingInv) {
    const prod1 = await prisma.productVariant.findFirst({ where: { sku: 'SHIRT-OXF-01' } });
    if (prod1) {
      const inv = await prisma.salesInvoice.create({
        data: {
          branchId: hqBranch.id,
          customerId: customer1.id,
          invoiceNumber: 'INV-26/1001',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: 'PAID',
          taxableAmount: 9500.0,
          cgstAmount: 237.5,
          sgstAmount: 237.5,
          igstAmount: 0,
          totalTax: 475.0,
          roundOff: 0,
          grandTotal: 9975.0,
          paidAmount: 9975.0,
          notes: 'Commercial wholesale sales order',
          terms: 'Standard terms',
        },
      });

      await prisma.salesInvoiceItem.create({
        data: {
          salesInvoiceId: inv.id,
          variantId: prod1.id,
          quantity: 10,
          unitPrice: 950.0,
          taxableValue: 9500.0,
          gstRate: 5.0,
          cgstAmount: 237.5,
          sgstAmount: 237.5,
          totalAmount: 9975.0,
        },
      });
      console.log('✓ Demo sales invoice seeded.');
    }
  }

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
