-- Import/export is intentionally Excel-only. Keep this constraint NOT VALID so
-- older job history can remain readable without deleting or rewriting it.
ALTER TABLE "import_export_jobs"
  ADD CONSTRAINT "import_export_jobs_excel_only_format"
  CHECK ("format" = 'xlsx')
  NOT VALID;
