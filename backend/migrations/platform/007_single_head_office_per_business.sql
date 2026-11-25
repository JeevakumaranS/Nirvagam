WITH ranked_head_offices AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY created_at, id) AS position
  FROM platform.business_branches
  WHERE is_head_office = TRUE
)
UPDATE platform.business_branches
SET is_head_office = FALSE
FROM ranked_head_offices
WHERE platform.business_branches.id = ranked_head_offices.id
  AND ranked_head_offices.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS business_branches_one_head_office_per_profile
  ON platform.business_branches (profile_id)
  WHERE is_head_office = TRUE;
