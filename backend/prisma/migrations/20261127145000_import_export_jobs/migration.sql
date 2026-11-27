CREATE TYPE "ImportExportJobKind" AS ENUM ('IMPORT', 'EXPORT');
CREATE TYPE "ImportExportJobStatus" AS ENUM ('VALIDATING', 'READY', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED');

CREATE TABLE "import_export_jobs" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "business_id" UUID NOT NULL,
  "created_by_id" UUID NOT NULL,
  "kind" "ImportExportJobKind" NOT NULL,
  "operation" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "mode" TEXT,
  "status" "ImportExportJobStatus" NOT NULL DEFAULT 'VALIDATING',
  "file_name" TEXT,
  "storage_key" TEXT,
  "total_rows" INTEGER NOT NULL DEFAULT 0,
  "processed_rows" INTEGER NOT NULL DEFAULT 0,
  "success_rows" INTEGER NOT NULL DEFAULT 0,
  "failed_rows" INTEGER NOT NULL DEFAULT 0,
  "skipped_rows" INTEGER NOT NULL DEFAULT 0,
  "validation" JSONB,
  "result" JSONB,
  "error_message" TEXT,
  "idempotency_key" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "import_export_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "import_export_jobs_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "import_export_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "import_export_jobs_idempotency_key_key" ON "import_export_jobs"("idempotency_key");
CREATE INDEX "import_export_jobs_business_id_created_at_idx" ON "import_export_jobs"("business_id", "created_at");
CREATE INDEX "import_export_jobs_business_id_status_idx" ON "import_export_jobs"("business_id", "status");
