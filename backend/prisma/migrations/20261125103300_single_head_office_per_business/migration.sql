WITH ranked_head_offices AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY business_id ORDER BY created_at, id) AS position
  FROM branches
  WHERE is_head_office = TRUE
)
UPDATE branches
SET is_head_office = FALSE
FROM ranked_head_offices
WHERE branches.id = ranked_head_offices.id
  AND ranked_head_offices.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS branches_one_head_office_per_business
  ON branches (business_id)
  WHERE is_head_office = TRUE;
