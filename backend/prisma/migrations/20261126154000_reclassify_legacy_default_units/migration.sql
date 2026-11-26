UPDATE "units"
SET "is_standard" = TRUE
WHERE ("name", "symbol") IN (
  ('Feet', 'FEET'),
  ('Gram', 'GRAM'),
  ('Kilogram', 'KG'),
  ('Millilitres', 'ML'),
  ('Pack', 'PACK'),
  ('Roll', 'ROLL')
);
