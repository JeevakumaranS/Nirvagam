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
| **Commercial** | **Sales & Billing** | `/sales` | Tax invoices, GST calculations (CGST/SGST/IGST), cancellations |
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

Run `npm run prisma:seed` to create the predefined roles and their default
permissions. Seeding also restores predefined role grants to those defaults.
Predefined role permission changes made in `/settings/roles` are global and
affect every tenant using that role; custom roles are scoped to the current
business. A role cannot be deleted while it is assigned to users.

The permission catalog is stored in the database and includes view, create,
edit, delete, approve, cancel, export, print, and access-reports actions.
Implemented sensitive actions, including invoice cancellation, manual journal
posting, and opening-stock entry, are checked by the API.

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

### Create a Platform Super Admin

Apply the platform migrations in filename order before creating a super admin or
using platform registration:

```text
backend/migrations/platform/001_platform_init.sql
backend/migrations/platform/002_business_registration.sql
```

Then run:

```bash
npm run super-admin:create -- --email=admin@example.com --first-name=Platform --last-name=Admin
```

The CLI prompts for a new identity's password without echoing it. Existing active
identities are promoted without changing their password. For non-interactive use,
provide `SUPER_ADMIN_PASSWORD` through the environment.

### Default Demo Credentials
- **Email:** `admin@nirvagam.com`
- **Password:** `Password@123`
