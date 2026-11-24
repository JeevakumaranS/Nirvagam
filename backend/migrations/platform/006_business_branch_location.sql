ALTER TABLE platform.business_branches
  ADD COLUMN IF NOT EXISTS district VARCHAR(100);
