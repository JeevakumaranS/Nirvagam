# Centralized Import / Export

Adapters register an operation with `ImportExportRegistry` and provide a stable field definition list. The engine owns Excel (`.xlsx`) parsing and generation, formula-safe output, validation job persistence, preview/error reporting, confirmation, progress, cancellation, tenant/business ownership checks and history. CSV is not supported by the inventory import/export contract. A module adapter owns reference resolution and business transactions.

Inventory currently registers `catalog`, `movements` and `transfers`. Catalog v2 workbooks use separate Products, Variants, Reference Data, Examples and Instructions sheets; dynamic variant attributes are entered as name/value pairs and normalized to the existing JSON structure. v1 flat rows and JSON attributes remain accepted. Catalog rows are grouped by parent SKU; product creation/update is delegated to `ProductsService`, and stock rows are delegated to its transactional operation/transfer methods. Stock movements use `import:{jobId}:{row}` idempotency keys.

For a future module:

1. Register its fields and operation in a module-owned provider.
2. Add a module adapter that maps normalized rows to the module service inside the existing tenant context.
3. Add operation-specific permissions and, if a future module needs it, its own export adapter.
4. Reuse `ImportExportJob` for progress, results, retries and history; do not create a second job table.

The current worker is an application-process background handoff (`setImmediate`) and persists every boundary. Production deployments should connect the same `process` operation to the existing durable worker/queue when one is provisioned; no Redis queue was present in this repository.
