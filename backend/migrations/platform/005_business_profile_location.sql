ALTER TABLE platform.business_profiles
  ADD COLUMN IF NOT EXISTS district VARCHAR(100);
