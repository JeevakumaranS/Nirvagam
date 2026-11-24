ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "tax_settings" JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF to_regclass('platform.business_profiles') IS NOT NULL THEN
    UPDATE "businesses" AS business
    SET "tax_settings" = profile.tax_settings
    FROM platform.business_profiles AS profile
    WHERE profile.id = business.id
      AND profile.tax_settings IS NOT NULL;
  END IF;
END $$;
