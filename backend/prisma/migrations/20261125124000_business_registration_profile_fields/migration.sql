ALTER TABLE "businesses"
ADD COLUMN "district" TEXT,
ADD COLUMN "jurisdiction" TEXT;

ALTER TABLE "branches"
ADD COLUMN "district" TEXT;
