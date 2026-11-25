ALTER TABLE "branches" ADD COLUMN "owner_id" UUID;

CREATE INDEX "branches_owner_id_idx" ON "branches"("owner_id");

ALTER TABLE "branches"
ADD CONSTRAINT "branches_owner_id_fkey"
FOREIGN KEY ("owner_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
