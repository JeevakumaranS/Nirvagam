# Purchase Management

## Setup

1. Configure `DATABASE_URL`.
2. Run `npm run prisma:generate`.
3. Apply migrations with `npm run prisma:migrate`.
4. Start backend and frontend with `npm run dev`.
5. Configure supplier, warehouse, tax, chart-of-account, number-series and approval settings through the existing masters and settings screens.

## Workflow

```text
Purchase Request -> Purchase Order -> GRN -> Purchase Invoice -> Supplier Payment
                                         \-> Direct Purchase Invoice
```

- Direct invoices bypass PR, PO and GRN and update stock when posted.
- Against-PO/GRN invoices support partial receiving and invoicing.
- Posted GRNs and invoices are immutable. Use cancellation or purchase return for correction.
- Purchase returns reduce stock and are blocked when stock is insufficient.

## Calculation and configuration

The reusable purchase calculation engine is in [packages/shared/src/index.ts](../packages/shared/src/index.ts). It stores calculation and tax rules with each document.

Defaults:

- Tax: GST/VAT with CGST, SGST, IGST or VAT fields
- Currency: INR
- Costing: existing stock-balance setting
- GRN clearing: enabled by configuration
- Over-receipt tolerance: 5%
- Purchase returns: negative stock is not allowed

## Migration

Migration `20261126110000_replace_purchase_workflow` creates the purchase schema, preserves legacy direct purchase invoices and supplier payment allocations, adds default accounts and number series, adds granular permissions, and removes the old purchase invoice tables after copying data.

## Known limitations

- Legacy migration actors are recorded as a system UUID until the next audit entry.
- VAT and FIFO variants remain configurable but require final accounting settings before production use.
- Mail notifications require an existing configured mail provider.
