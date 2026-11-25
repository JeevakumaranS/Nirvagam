# NIRVAGAM: Universal Business Billing & Management SaaS
**Brand:** NIRVAGAM  
**Developed by:** DUROZEN TECHNOLOGIES PRIVATE LIMITED  
**CIN:** U62090TZ2026PTC038755  
**Target Market:** India MSMEs, Retail & Multi-Branch Enterprises  

---

## 🛠 Architecture & Directory Layout

- **`node_modules/`** — 🌟 **Single root `node_modules` directory** (all dependencies hoisted, no separate/nested node_modules)
- **`backend/`** — NestJS 10 modular REST API & double-entry accounting engine
- **`frontend/`** — Next.js 14 App Router with quiet macOS-inspired minimal design
- **`packages/shared/`** — Shared TypeScript types, Enums, DTOs, and GST calculation engine
- **Database:** PostgreSQL 16 (with Prisma ORM)

---

## 🧭 Navigation & Sidebar Modules

| Group | Module Name | Route | Key Features |
|:---|:---|:---|:---|
| **Commercial** | **Dashboard** | `/dashboard` | Executive KPIs, MTD sales, receivables, cash/bank balance |
| **Commercial** | **Sales & Billing** | `/sales` | Sales document types, GST inclusive/exclusive pricing, payment tracking, returns, audited cancellations |
| **Commercial** | **POS Checkout** | `/pos` | Barcode scanning, instant cart, Cash/Card/UPI tenders, thermal slip |
| **Commercial** | **Purchases & GRN** | `/purchases` | Vendor bills, stock intake, Input Tax Credit (ITC) tracking |
| **Operations** | **Inventory & Stock** | `/inventory` | Stock balances, HSN codes, UOM units, low-stock reorder alerts |
| **Operations** | **Customers & Vendors** | `/partners` | Buyer directory (Debtors), Supplier directory (Creditors), credit limits |
| **Operations** | **Double-Entry Ledger** | `/accounting` | Chart of Accounts, balanced Journal Vouchers ($\sum\text{Dr}=\sum\text{Cr}$), Trial Balance |
| **Operations** | **Reports & Analytics** | `/reports` | Profit & Loss Statement, GSTR-1 & GSTR-3B tax data breakdown |
| **Organization** | **Business Profile** | `/settings/business` | Legal name, PAN, CIN, GSTINs, branch outlets, active FY |
| **Organization** | **Team Members** | `/settings/users` | Staff directory, role permissions, branch assignments, onboarding |
| **Organization** | **Roles & Access** | `/settings/roles` | Granular permission matrix inspection (view, create, edit, delete, etc.) |

### Roles & RBAC

Roles, permissions, and user accounts are stored in each tenant's own schema.
Changes to one tenant's roles do not affect any other tenant.

The permission catalog is stored in the database and includes view, create,
edit, delete, approve, cancel, export, print, and access-reports actions.
Manual sales invoice numbering additionally requires
`sales_invoice:manual_number`; the billing migration grants it to business
owners and business administrators. Implemented sensitive actions, including
invoice cancellation, manual journal posting, and opening-stock entry, are
checked by the API.

---

## 🚀 Running the Platform

```bash
# 1. Start backend (http://localhost:4000 & Swagger at /api/docs)
npm run dev:backend

# 2. Start frontend (http://localhost:3000)
npm run dev:frontend

# Or run both concurrently from root:
npm run dev
```

### Database Migrations and Tenant Isolation

Tenant tables are created from `backend/prisma/migrations` inside each tenant's
schema. Run `npm run tenant:migrate` from `backend/` after deploying migration
files; new tenants receive the current schema during registration. Do not run
Prisma `migrate` or `db push` directly against `public`; the `prisma:migrate`
and `prisma:push` scripts are aliases for the tenant migration runner.
`npm run prisma:generate` only regenerates the Prisma client and does not apply
database changes.

Platform migrations must be applied in filename order. Migration
`008_per_tenant_schema_reset.sql` is a one-time, destructive transition: it
deletes legacy shared tenant records and old tenant schemas, preserves platform
administrator accounts, and suspends old workspaces because their tenant users
are removed. Back up the database before applying it. Afterward, run
`npm run tenant:migrate`; old workspaces must be deleted and registered again
before their owners can log in.

### Create a Platform Super Admin

Apply the platform migrations in filename order before creating a super admin or
using platform registration:

```text
backend/migrations/platform/001_platform_init.sql
backend/migrations/platform/002_business_registration.sql
backend/migrations/platform/003_platform_role_permissions.sql
backend/migrations/platform/004_platform_operations.sql
backend/migrations/platform/005_business_profile_location.sql
backend/migrations/platform/006_business_branch_location.sql
backend/migrations/platform/007_single_head_office_per_business.sql
backend/migrations/platform/008_per_tenant_schema_reset.sql
```

The CLI implementation is in `backend/src/account-creation/create-super-admin.ts`.
Then run:

```bash
npm run super-admin:create -- --email=admin@example.com --first-name=Platform --last-name=Admin
```

The CLI prompts for a new identity's password without echoing it. Existing active
identities are promoted without changing their password. For non-interactive use,
provide `SUPER_ADMIN_PASSWORD` through the environment.

### Business Onboarding

Sign in as the platform super admin and register the business from the platform
business-registration page. Registration creates the isolated schema, current
tables, business owner account, and required tenant-local roles atomically. Set
the owner's name, email, and temporary password there. The owner signs in from
`/login` with those credentials and is prompted to change the password on first
sign-in. Public self-registration is disabled.
