-- New jobs in this module are imports only. Keep historical export rows
-- readable without deleting or rewriting job history.
ALTER TABLE "import_export_jobs"
  ADD CONSTRAINT "import_export_jobs_import_only_kind"
  CHECK ("kind" = 'IMPORT')
  NOT VALID;
