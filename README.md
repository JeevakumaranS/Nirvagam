# NIRVAGAM: Universal Business Billing & Management SaaS
**Brand:** NIRVAGAM  
**Developed by:** DUROZEN TECHNOLOGIES PRIVATE LIMITED  
**CIN:** U62090TZ2026PTC038755  
**Target Market:** India MSMEs, Retail & Multi-Branch Enterprises  

---

## 🛠 Technology Stack

- **Monorepo Layout:**
  - `apps/web`: Next.js 14 (App Router, TypeScript, Tailwind CSS, Custom Design System)
  - `apps/api`: NestJS 10 (TypeScript, Modular Architecture, OpenAPI/Swagger, JWT, Passport)
  - `packages/shared`: Shared TypeScript types, Enums, GST calculators, DTOs
- **Database:** PostgreSQL 18+
- **ORM:** Prisma 5
- **Design System:** Strict macOS-inspired, quiet minimalist aesthetic (Inter + DM Mono, CSS variables, Display-P3 colors, light/dark themes via `[data-theme="dark"]`)

---

## 📋 Module Delivery Status Table

| Module ID | Module Name | Scope & Requirement IDs | Status |
|:---|:---|:---|:---:|
| **MOD-01** | **Tenant & Business Configuration** | FR-001 to FR-007 (Tenancy, Businesses, Branches, Sequences, FY, GSTIN) | ✅ **Completed & Verified** |
| **MOD-02** | **Authentication & RBAC** | FR-010 to FR-013 (JWT rotation, bcrypt, 10 system roles, permissions, branch scope) | ✅ **Completed & Verified** |
| **MOD-03** | **Master Data Management** | FR-020 to FR-024 (Catalog, UOMs, Categories, Brands, Tax Rates, Customers/Suppliers) | 🔄 Next in Sequence |
| **MOD-04** | **Inventory & Warehouses** | FR-030 to FR-037 (Stock ledgers, movements, FIFO/WAC valuation, transfers) | ⏳ Queued |
| **MOD-05** | **Double-Entry Accounting Core** | FR-070 to FR-076 (COA, balanced journals, period lock, vouchers, ledger) | ⏳ Queued |
| **MOD-06** | **Sales & Invoicing Engine** | FR-040 to FR-045, FR-048, FR-049 (GST Invoices, Bill of Supply, Credit Notes, PDF) | ⏳ Queued |
| **MOD-07** | **Point of Sale (POS)** | FR-046, FR-047 (High-speed barcode scanner, shift closing, thermal slips) | ⏳ Queued |
| **MOD-08** | **Purchase & Procurement** | FR-050 to FR-054 (POs, GRNs, Vendor Bills, Debit Notes, ITC Tracking) | ⏳ Queued |
| **MOD-09** | **Payments & Settlements** | FR-060 to FR-063 (Receipts, Disbursements, Invoice FIFO Allocations) | ⏳ Queued |
| **MOD-10** | **Expense & Operational Costs** | FR-065 (Categories, Vouchers, Reverse Charge, Attachments) | ⏳ Queued |
| **MOD-11** | **GST Compliance Engine** | FR-081 (CGST/SGST/IGST, Place of Supply, GSTR-1 & GSTR-3B preparation) | ⏳ Queued |
| **MOD-12** | **Banking & Reconciliation** | Bank/Cash Books, Contra Transfers, Statement Reconciliations | ⏳ Queued |
| **MOD-13** | **Multi-Branch & Multi-Company** | Inter-branch Stock Transfers, Distinct GSTINs, Consolidated Views | ⏳ Queued |
| **MOD-14** | **Financial & Business Reports** | FR-080, FR-082 (P&L, Balance Sheet, Trial Balance, Executive KPIs) | ⏳ Queued |
| **MOD-15** | **Document & Template System** | Vector PDF Generation, Storage Drivers, Document Audit | ⏳ Queued |
| **MOD-16** | **Notifications & Audit Trails** | FR-084 (Tamper-evident Audit Logs, Overdue & Stock Alerts) | ⏳ Queued |
| **MOD-17** | **SaaS Subscription Platform** | FR-083 (Plans, Quotas, Usage Metering, Platform Admin) | ⏳ Queued |

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js $\ge 20$
- PostgreSQL 18 or later running locally on port `5432` (UUIDv7 support is required)
- npm $\ge 10$

### 2. Local PostgreSQL Setup
Create a PostgreSQL role and database for the application (the commands prompt for the local PostgreSQL administrator password and the new role password):
```powershell
createuser -h localhost -p 5432 -U postgres --pwprompt nirvagam
createdb -h localhost -p 5432 -U postgres -O nirvagam nirvagam_db
```
Set the `DATABASE_URL` in both `.env` and `backend/.env` to use `localhost:5432` and the password chosen for the `nirvagam` role. If the role or database already exists, update it as needed instead of creating it again.

### 3. Install Dependencies & Build Shared Package
```bash
npm install
npm run build:shared
```

### 4. Database Schema Migration & Seeding
```bash
# If this database already contains Nirvagam data with text IDs, back it up and
# stop the backend, then run this one-time UUIDv7 re-key before prisma:push:
npm run prisma:uuidv7

# Create/update the local PostgreSQL schema
npm run prisma:push

# Seed plans, roles, permissions, standard accounts and the admin user
npm run prisma:seed
```
For a fresh database, skip `prisma:uuidv7` and run `prisma:push` directly. The UUIDv7 migration changes existing primary keys and their references; old IDs (including IDs in existing JWTs) are no longer valid.

### 5. Running the Application
```bash
# Run both API and Web concurrently
npm run dev

# Or run separately:
npm run dev:backend   # Runs on http://localhost:4000
npm run dev:frontend  # Runs on http://localhost:3000
```

---

## 🔑 Default Seed Credentials

- **Workspace Slug:** `durozen`
- **Admin Email:** `admin@nirvagam.com`
- **Password:** `Password@123`
- **Role:** `BUSINESS_OWNER` (Full platform & commercial access)
- **Active Business:** Durozen Technologies Private Limited (Namakkal HQ / Chennai Branch)

---

## 📡 Documented API Endpoints (Module 1 & 2)

- **Interactive OpenAPI/Swagger:** `http://localhost:4000/api/docs`
- **Authentication:**
  - `POST /api/v1/auth/register` — Onboard new tenant, business entity, and administrator.
  - `POST /api/v1/auth/login` — Authenticate and retrieve JWT token pair.
  - `POST /api/v1/auth/refresh` — Exchange refresh token for fresh access token.
  - `GET /api/v1/auth/me` — Retrieve active profile and branch context.
- **Tenants:**
  - `GET /api/v1/tenants/current` — Current tenant subscription, status, and quotas.
  - `PATCH /api/v1/tenants/current` — Update organization information.
- **Businesses & Branches:**
  - `GET /api/v1/businesses` — List legal entities.
  - `POST /api/v1/businesses` — Create additional business entity.
  - `GET /api/v1/businesses/:id` — Detail view with GST registrations and fiscal periods.
  - `PUT /api/v1/businesses/:id` — Update legal/trade name, PAN, contact.
  - `GET /api/v1/businesses/:id/branches` — List operating branches.
  - `POST /api/v1/businesses/:id/branches` — Provision a new branch outlet.
- **Users & RBAC:**
  - `GET /api/v1/users` — Paginated team member directory with search and role filters.
  - `POST /api/v1/users` — Onboard new team member.
  - `GET /api/v1/users/:id` — User details and role assignments.
  - `PUT /api/v1/users/:id` — Update user permissions, roles, or branch assignments.
  - `DELETE /api/v1/users/:id` — Soft-deactivate user account.
  - `GET /api/v1/roles` — List system and custom roles.
  - `GET /api/v1/roles/permissions` — Granular permission catalog grouped by resource.
