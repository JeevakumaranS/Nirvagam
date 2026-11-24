import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  TenantDatabaseService,
  quoteIdent,
  validateSchemaName,
} from './tenant-database.service';
import { TenantCacheService } from './tenant-cache.service';
import {
  ProvisionTenantInput,
  TenantProvisionResult,
  TenantStatus,
} from './tenancy.types';

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(
    private readonly tenantDb: TenantDatabaseService,
    private readonly cache: TenantCacheService
  ) {}

  /**
   * Main Provisioning State Machine
   */
  async provision(input: ProvisionTenantInput): Promise<TenantProvisionResult> {
    const requiredFields = [
      input?.slug,
      input?.displayName,
      input?.ownerEmail,
      input?.ownerPassword,
      input?.ownerFirstName,
      input?.ownerLastName,
      input?.addressLine1,
      input?.city,
      input?.state,
      input?.stateCode,
      input?.pincode,
    ];
    if (requiredFields.some((value) => typeof value !== 'string' || !value.trim())) {
      throw new BadRequestException(
        'Workspace, owner credentials, and business address details are required for tenant provisioning',
      );
    }

    const startTime = Date.now();
    this.logger.log(`Beginning provisioning state machine for tenant slug [${input.slug}]...`);

    // Normalize slug
    const slug = input.slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-');
    if (!slug || slug.length < 3) {
      throw new Error(`Invalid tenant slug "${input.slug}". Must be at least 3 alphanumeric characters.`);
    }

    // Generate deterministic short schema name: t_<short_hex>
    // Security Rule: The schema name is NEVER built from user input.
    // It is derived strictly from a random hex token.
    const randomHex = crypto.randomBytes(6).toString('hex'); // 12 chars hex
    const schemaName = `t_${randomHex}`;
    validateSchemaName(schemaName);

    let tenantId: string | null = null;
    let ownerIdentityId: string | null = null;
    let schemaCreated = false;

    try {
      // STEP 1: Insert platform.tenants with status 'provisioning'
      this.logger.log(`Step 1: Inserting platform.tenants record in status [provisioning]...`);
      tenantId = await this.tenantDb.withPlatform(async (tx) => {
        // Check uniqueness of slug
        const existing = await tx.queryOne(
          `SELECT id FROM platform.tenants WHERE slug = $1 LIMIT 1;`,
          [slug]
        );
        if (existing) {
          throw new Error(`Tenant slug "${slug}" is already taken.`);
        }

        // Get plan id if planCode provided
        let planId: string | null = null;
        if (input.planCode) {
          const plan = await tx.queryOne<{ id: string }>(
            `SELECT id FROM platform.plans WHERE code = $1 LIMIT 1;`,
            [input.planCode]
          );
          if (plan) planId = plan.id;
        }

        const inserted = await tx.queryOne<{ id: string }>(
          `INSERT INTO platform.tenants (
            slug, display_name, schema_name, status, plan_id, region, metadata
          ) VALUES ($1, $2, $3, 'provisioning', $4, $5, $6)
          RETURNING id;`,
          [
            slug,
            input.displayName,
            schemaName,
            planId,
            input.region || 'ap-south-1',
            JSON.stringify(input.metadata || {}),
          ]
        );
        return inserted!.id;
      });

      // Handle Owner Identity (create or link existing)
      ownerIdentityId = await this.ensureOwnerIdentity(input);

      // STEP 2: CREATE SCHEMA & set ownership / roles
      this.logger.log(`Step 2: Creating schema ${schemaName}...`);
      await this.tenantDb.withPlatform(async (tx) => {
        await tx.execute(`CREATE SCHEMA IF NOT EXISTS ${quoteIdent(schemaName)};`);
        schemaCreated = true;

        if (process.env.ENABLE_PER_TENANT_ROLES === 'true') {
          const roleName = `role_${schemaName}`;
          await tx.execute(`DO $$ BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${roleName}') THEN
              CREATE ROLE ${quoteIdent(roleName)};
            END IF;
          END $$;`);
          await tx.execute(`GRANT USAGE ON SCHEMA ${quoteIdent(schemaName)} TO ${quoteIdent(roleName)};`);
          await tx.execute(`GRANT ALL ON ALL TABLES IN SCHEMA ${quoteIdent(schemaName)} TO ${quoteIdent(roleName)};`);
          await tx.execute(`GRANT ALL ON ALL SEQUENCES IN SCHEMA ${quoteIdent(schemaName)} TO ${quoteIdent(roleName)};`);
        }
      });

      // STEP 3: Apply baseline tenant migrations
      this.logger.log(`Step 3: Applying baseline schema migrations into ${schemaName}...`);
      await this.applyTenantBaseline(schemaName);

      // STEP 4: Seed system data (Roles, Permissions, Indian COA, GST settings, Branches)
      this.logger.log(`Step 4: Seeding enterprise system roles, Indian COA, and defaults...`);
      const seedResult = await this.seedTenantSystemData(schemaName, input, ownerIdentityId);

      // STEP 5: Create Owner Membership in platform.tenant_memberships
      this.logger.log(`Step 5: Registering owner membership in platform schema...`);
      await this.tenantDb.withPlatform(async (tx) => {
        await tx.execute(
          `INSERT INTO platform.tenant_memberships (
            identity_id, tenant_id, tenant_role_key, status
          ) VALUES ($1, $2, 'BUSINESS_OWNER', 'ACTIVE')
          ON CONFLICT (identity_id, tenant_id) DO UPDATE SET status = 'ACTIVE';`,
          [ownerIdentityId, tenantId]
        );
      });

      // STEP 6: Mark status = 'active', write platform audit log, invalidate cache
      this.logger.log(`Step 6: Finalizing tenant activation...`);
      await this.tenantDb.withPlatform(async (tx) => {
        await tx.execute(
          `UPDATE platform.tenants SET status = 'active', updated_at = NOW() WHERE id = $1;`,
          [tenantId]
        );
        await tx.execute(
          `INSERT INTO platform.platform_audit_log (
            actor_id, action, target_type, target_id, reason, metadata
          ) VALUES ($1, 'TENANT_PROVISIONED', 'TENANT', $2, 'Onboarding state machine completed', $3);`,
          [
            ownerIdentityId,
            tenantId,
            JSON.stringify({
              slug,
              schemaName,
              durationMs: Date.now() - startTime,
            }),
          ]
        );
      });

      await this.cache.invalidateTenant(tenantId, slug);

      this.logger.log(
        `SUCCESS: Tenant [${slug}] provisioned with schema [${schemaName}] in ${Date.now() - startTime}ms.`
      );

      return {
        tenantId,
        slug,
        schemaName,
        status: 'active',
        ownerIdentityId,
        defaultBranchId: seedResult.branchId,
        rolesSeeded: seedResult.rolesCount,
        permissionsSeeded: seedResult.permissionsCount,
        coaAccountsSeeded: seedResult.coaCount,
      };
    } catch (error: any) {
      this.logger.error(`PROVISIONING FAILED for tenant slug [${slug}]: ${error.message}`, error.stack);

      // COMPENSATING ROLLBACK:
      // Drop schema ONLY if status was 'provisioning'
      if (schemaCreated) {
        try {
          this.logger.warn(`Compensating rollback: Dropping incomplete schema ${schemaName}...`);
          await this.tenantDb.withPlatform(async (tx) => {
            await tx.execute(`DROP SCHEMA IF EXISTS ${quoteIdent(schemaName)} CASCADE;`);
            if (process.env.ENABLE_PER_TENANT_ROLES === 'true') {
              await tx.execute(`DROP ROLE IF EXISTS ${quoteIdent(`role_${schemaName}`)};`);
            }
          });
        } catch (dropErr) {
          this.logger.error(`Failed to drop schema during compensating rollback`, dropErr);
        }
      }

      // Mark tenant as failed in platform registry
      if (tenantId) {
        try {
          await this.tenantDb.withPlatform(async (tx) => {
            await tx.execute(
              `UPDATE platform.tenants SET status = 'failed', updated_at = NOW() WHERE id = $1;`,
              [tenantId]
            );
          });
          await this.cache.invalidateTenant(tenantId, slug);
        } catch (failErr) {
          this.logger.error(`Failed to mark tenant status as failed`, failErr);
        }
      }

      throw error;
    }
  }

  private async ensureOwnerIdentity(input: ProvisionTenantInput): Promise<string> {
    if (input.existingIdentityId) {
      return input.existingIdentityId;
    }

    const email = input.ownerEmail.toLowerCase().trim();
    return await this.tenantDb.withPlatform(async (tx) => {
      const existing = await tx.queryOne<{ id: string }>(
        `SELECT id FROM platform.identities WHERE email = $1 LIMIT 1;`,
        [email]
      );
      if (existing) {
        return existing.id;
      }

      const passwordHash = await bcrypt.hash(input.ownerPassword, 10);
      const inserted = await tx.queryOne<{ id: string }>(
        `INSERT INTO platform.identities (
          email, password_hash, first_name, last_name, phone, status
        ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
        RETURNING id;`,
        [
          email,
          passwordHash,
          input.ownerFirstName || 'Business',
          input.ownerLastName || 'Owner',
          input.ownerPhone || null,
        ]
      );
      return inserted!.id;
    });
  }

  private async applyTenantBaseline(schemaName: string): Promise<void> {
    const baselinePath = path.resolve(
      __dirname,
      '../../migrations/tenant/baseline.sql'
    );
    const sql = fs.readFileSync(baselinePath, 'utf8');

    // Run baseline inside target tenant schema
    const pool = this.tenantDb.getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');
      await client.query(`SET LOCAL search_path TO ${quoteIdent(schemaName)}, public;`);
      await client.query(sql);
      await client.query('COMMIT;');
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }

  private async seedTenantSystemData(
    schemaName: string,
    input: ProvisionTenantInput,
    ownerIdentityId: string
  ): Promise<{ branchId: string | null; rolesCount: number; permissionsCount: number; coaCount: number }> {
    const pool = this.tenantDb.getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN;');
      await client.query(`SET LOCAL search_path TO ${quoteIdent(schemaName)}, public;`);

      // Business Profile
      await client.query(
        `INSERT INTO business_profile (
          legal_name, trade_name, gstin, pan, email, phone, address, city, state, state_code, pincode
        ) VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10);`,
        [
          input.displayName,
          input.gstin || '',
          input.pan || '',
          input.ownerEmail,
          input.ownerPhone || null,
          input.addressLine1,
          input.city,
          input.state,
          input.stateCode,
          input.pincode,
        ]
      );

      // Financial Year (Current Apr-Mar)
      const currentYear = new Date().getFullYear();
      await client.query(
        `INSERT INTO financial_years (
          code, name, start_date, end_date, is_current
        ) VALUES ($1, $2, $3, $4, true)
        ON CONFLICT (code) DO NOTHING;`,
        [
          `FY-${currentYear}-${(currentYear + 1).toString().slice(-2)}`,
          `Financial Year ${currentYear}-${currentYear + 1}`,
          `${currentYear}-04-01`,
          `${currentYear + 1}-03-31`,
        ]
      );

      // Numbering Series
      const series = [
        ['INVOICE', 'INV-'],
        ['QUOTE', 'QT-'],
        ['CREDIT_NOTE', 'CN-'],
        ['PURCHASE_ORDER', 'PO-'],
        ['GRN', 'GRN-'],
        ['JOURNAL', 'JV-'],
      ];
      for (const [entity, prefix] of series) {
        await client.query(
          `INSERT INTO numbering_series (entity_type, prefix, current_number, padding_zeros)
           VALUES ($1, $2, 0, 5)
           ON CONFLICT (entity_type, prefix) DO NOTHING;`,
          [entity, prefix]
        );
      }

      // Tenant User (Owner) soft reference
      const userRes = await client.query(
        `INSERT INTO tenant_users (identity_id, email, first_name, last_name, is_active)
         VALUES ($1, $2, $3, $4, true)
         RETURNING id;`,
        [
          ownerIdentityId,
          input.ownerEmail,
          input.ownerFirstName,
          input.ownerLastName,
        ]
      );
      const tenantUserId = userRes.rows[0].id;

      // Permissions Catalog (Module x Action)
      const modules = [
        'Accounting',
        'Branch',
        'Business',
        'Credit Note',
        'Customer',
        'Inventory',
        'Invoice',
        'Journal',
        'POS',
        'Purchase Order',
        'GRN',
        'Reports',
        'Settings',
        'User',
        'Vendor',
      ];
      const actions = [
        'Approve',
        'Cancel',
        'Create',
        'Delete',
        'Edit',
        'Export',
        'Print',
        'View',
      ];

      const permIdMap = new Map<string, string>();
      for (const mod of modules) {
        for (const act of actions) {
          const res = await client.query(
            `INSERT INTO permissions (module, action, description)
             VALUES ($1, $2, $3)
             ON CONFLICT (module, action) DO UPDATE SET description = EXCLUDED.description
             RETURNING id;`,
            [mod, act, `Can ${act} ${mod}`]
          );
          permIdMap.set(`${mod}:${act}`, res.rows[0].id);
        }
      }

      // System Roles
      const systemRoles = [
        { name: 'BUSINESS_OWNER', desc: 'Complete enterprise ownership and administration' },
        { name: 'BUSINESS_ADMIN', desc: 'Administrative management across commercial modules' },
        { name: 'MANAGER', desc: 'Operational supervisor with approval privileges' },
        { name: 'ACCOUNTANT', desc: 'Double-entry accounting, ledger, invoices, tax filing' },
        { name: 'AUDITOR', desc: 'Read-only audit inspection across all modules' },
        { name: 'CASHIER', desc: 'POS checkout, sales billing, and shift management' },
        { name: 'INVENTORY_MANAGER', desc: 'Item catalog, warehouses, and stock adjustments' },
        { name: 'PURCHASE_MANAGER', desc: 'Vendor management, purchase orders, and goods receipts' },
        { name: 'SALES_EXECUTIVE', desc: 'Customer relationships, sales quotes, and orders' },
      ];

      const roleIdMap = new Map<string, string>();
      for (const r of systemRoles) {
        const res = await client.query(
          `INSERT INTO roles (name, description, is_system)
           VALUES ($1, $2, true)
           ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
           RETURNING id;`,
          [r.name, r.desc]
        );
        roleIdMap.set(r.name, res.rows[0].id);
      }

      // Grant permissions according to role semantics
      for (const [permKey, permId] of permIdMap.entries()) {
        const [mod, act] = permKey.split(':');

        // BUSINESS_OWNER & BUSINESS_ADMIN get all permissions
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2), ($3, $2)
           ON CONFLICT DO NOTHING;`,
          [roleIdMap.get('BUSINESS_OWNER'), permId, roleIdMap.get('BUSINESS_ADMIN')]
        );

        // AUDITOR gets only View, Print, Export across all modules
        if (['View', 'Print', 'Export'].includes(act)) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [roleIdMap.get('AUDITOR'), permId]
          );
        }

        // CASHIER: POS module + Invoice Create/Print/View + Customer View
        if (
          mod === 'POS' ||
          (mod === 'Invoice' && ['Create', 'Print', 'View'].includes(act)) ||
          (mod === 'Customer' && act === 'View')
        ) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [roleIdMap.get('CASHIER'), permId]
          );
        }

        // ACCOUNTANT: Accounting, Journal, Invoice, Credit Note, Reports, Vendor, Customer
        if (['Accounting', 'Journal', 'Invoice', 'Credit Note', 'Reports', 'Customer', 'Vendor'].includes(mod)) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [roleIdMap.get('ACCOUNTANT'), permId]
          );
        }

        // INVENTORY_MANAGER: Inventory, Branch, GRN
        if (['Inventory', 'Branch', 'GRN'].includes(mod)) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [roleIdMap.get('INVENTORY_MANAGER'), permId]
          );
        }

        // PURCHASE_MANAGER: Purchase Order, GRN, Vendor, Inventory View
        if (
          ['Purchase Order', 'GRN', 'Vendor'].includes(mod) ||
          (mod === 'Inventory' && ['View', 'Print'].includes(act))
        ) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [roleIdMap.get('PURCHASE_MANAGER'), permId]
          );
        }

        // SALES_EXECUTIVE: Customer, Invoice, Credit Note, POS, Inventory View
        if (
          ['Customer', 'Invoice', 'Credit Note', 'POS'].includes(mod) ||
          (mod === 'Inventory' && act === 'View')
        ) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
            [roleIdMap.get('SALES_EXECUTIVE'), permId]
          );
        }
      }

      // Assign BUSINESS_OWNER role to the owner tenant user
      await client.query(
        `INSERT INTO user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING;`,
        [tenantUserId, roleIdMap.get('BUSINESS_OWNER')]
      );

      // Indian Chart of Accounts (COA) Template
      const coaAccounts = [
        // Assets
        { code: '1000', name: 'Current Assets', group: 'ASSETS', parent: null },
        { code: '1010', name: 'Cash on Hand', group: 'ASSETS', parent: '1000' },
        { code: '1020', name: 'Bank Accounts (HDFC / SBI)', group: 'ASSETS', parent: '1000' },
        { code: '1030', name: 'Accounts Receivable (Debtors)', group: 'ASSETS', parent: '1000' },
        { code: '1040', name: 'Inventory / Stock in Hand', group: 'ASSETS', parent: '1000' },
        { code: '1050', name: 'Input CGST (Input Tax Credit)', group: 'ASSETS', parent: '1000' },
        { code: '1051', name: 'Input SGST (Input Tax Credit)', group: 'ASSETS', parent: '1000' },
        { code: '1052', name: 'Input IGST (Input Tax Credit)', group: 'ASSETS', parent: '1000' },
        { code: '1100', name: 'Fixed Assets (Plant & Equipment)', group: 'ASSETS', parent: null },

        // Liabilities
        { code: '2000', name: 'Current Liabilities', group: 'LIABILITIES', parent: null },
        { code: '2010', name: 'Accounts Payable (Creditors)', group: 'LIABILITIES', parent: '2000' },
        { code: '2020', name: 'Output CGST Payable', group: 'LIABILITIES', parent: '2000' },
        { code: '2021', name: 'Output SGST Payable', group: 'LIABILITIES', parent: '2000' },
        { code: '2022', name: 'Output IGST Payable', group: 'LIABILITIES', parent: '2000' },

        // Equity
        { code: '3000', name: 'Capital & Reserves', group: 'EQUITY', parent: null },
        { code: '3010', name: "Owner's Capital", group: 'EQUITY', parent: '3000' },
        { code: '3020', name: 'Retained Earnings', group: 'EQUITY', parent: '3000' },

        // Revenue
        { code: '4000', name: 'Direct Revenue', group: 'REVENUE', parent: null },
        { code: '4010', name: 'Sales Revenue - GST 18%', group: 'REVENUE', parent: '4000' },
        { code: '4020', name: 'Sales Revenue - GST 12%', group: 'REVENUE', parent: '4000' },
        { code: '4030', name: 'Sales Revenue - GST 5%', group: 'REVENUE', parent: '4000' },
        { code: '4040', name: 'Sales Revenue - Exempt', group: 'REVENUE', parent: '4000' },

        // Expenses
        { code: '5000', name: 'Direct Expenses (COGS)', group: 'EXPENSES', parent: null },
        { code: '5010', name: 'Cost of Goods Sold (Purchases)', group: 'EXPENSES', parent: '5000' },
        { code: '5100', name: 'Indirect Expenses', group: 'EXPENSES', parent: null },
        { code: '5110', name: 'Salaries & Wages', group: 'EXPENSES', parent: '5100' },
        { code: '5120', name: 'Rent & Utilities', group: 'EXPENSES', parent: '5100' },
      ];

      const coaIdMap = new Map<string, string>();
      for (const acc of coaAccounts) {
        const parentId = acc.parent ? coaIdMap.get(acc.parent) || null : null;
        const res = await client.query(
          `INSERT INTO chart_of_accounts (account_code, account_name, group_type, parent_id, is_system, is_active)
           VALUES ($1, $2, $3, $4, true, true)
           ON CONFLICT (account_code) DO NOTHING
           RETURNING id;`,
          [acc.code, acc.name, acc.group, parentId]
        );
        if (res.rows[0]) {
          coaIdMap.set(acc.code, res.rows[0].id);
        }
      }

      await client.query('COMMIT;');

      return {
        branchId: null,
        rolesCount: systemRoles.length,
        permissionsCount: permIdMap.size,
        coaCount: coaAccounts.length,
      };
    } catch (err) {
      await client.query('ROLLBACK;');
      throw err;
    } finally {
      client.release();
    }
  }
}
