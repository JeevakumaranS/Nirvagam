# Module 3: Purchase Management

## Workflow
```
Purchase Request (PR)
  └─> Purchase Order (PO)
        └─> Goods Received Note (GRN) [Stock + WAC/FIFO + GRN Accrual]
              └─> Purchase Invoice (AGAINST_PO_GRN) [Clears GRN Accrual + PPV]
                    ├─> Purchase Return (Debit Note)
                    └─> Supplier Payment / Advance Adjustment

Direct Mode:
  Purchase Invoice (DIRECT) [Stock + Accounting in 1 atomic transaction]
```

## Key Features
- **Tax Engine (`@nirvagam/shared`)**: Fixed-point `bigint` decimal math supporting Indian GST (CGST/SGST/IGST by state code) and configurable VAT, line & invoice discounts (`%` or flat), inclusive/exclusive pricing, taxable/non-taxable charges, freight allocation (`VALUE`, `QUANTITY`, `WEIGHT`), and round-off.
- **Inventory Costing**: Configurable per business (`WAC` default or `FIFO` layers), incorporating landed cost (net rate + allocated freight + allocated charges). Over-receipt tolerance defaults to `5%` (overridable per PO line and item variant).
- **Accounting**:
  - GRN Accrual (`Dr Inventory / Cr GRN Clearing`) enabled by default, cleared on Invoice with differences posted to `Purchase Price Variance`.
  - Balanced double-entry journals enforced inside database transactions; closed fiscal periods block posting.
- **Approvals**: Multi-level configurable rules by document type, amount range, branch, and department (`Approve`, `Reject`, `Send Back`, `Delegate`) with in-app notifications.
- **Supplier Financials & Reports**: Supplier Ledger (CSV export), Bill-wise Ageing (`0-30`, `31-60`, `61-90`, `90+`), Purchase History, and 9 built-in Purchase Reports.

## Configuration
Navigate to **Purchase Management → Settings** (`/purchases`) to configure:
- Tax Regime (`GST` / `VAT`)
- Costing Method (`WAC` / `FIFO`)
- GRN Accrual toggle & Return Stock Policy
- Default Over-Receipt Tolerance %
- Custom Chart of Accounts mappings
