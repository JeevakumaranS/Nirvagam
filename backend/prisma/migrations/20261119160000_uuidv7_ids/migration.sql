BEGIN;

SET LOCAL search_path = public, pg_temp;

DO $$
BEGIN
  IF to_regprocedure('uuidv7()') IS NULL THEN
    RAISE EXCEPTION 'This migration requires PostgreSQL with uuidv7() support';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint AS pk
    JOIN pg_attribute AS id_column
      ON id_column.attrelid = pk.conrelid
     AND id_column.attnum = pk.conkey[1]
    WHERE pk.contype = 'p'
      AND pk.connamespace = 'public'::regnamespace
      AND cardinality(pk.conkey) = 1
      AND id_column.attname = 'id'
      AND id_column.atttypid <> 'text'::regtype
  ) THEN
    RAISE EXCEPTION 'Expected all id primary-key columns to have text type before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_attribute AS column_info
    JOIN pg_class AS relation ON relation.oid = column_info.attrelid
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
    WHERE schema_info.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND column_info.attnum > 0
      AND NOT column_info.attisdropped
      AND right(column_info.attname, 3) = '_id'
      AND column_info.atttypid <> 'text'::regtype
  ) THEN
    RAISE EXCEPTION 'Expected all *_id columns to have text type before migration';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint AS foreign_key
    JOIN pg_attribute AS referenced_column
      ON referenced_column.attrelid = foreign_key.confrelid
     AND referenced_column.attnum = foreign_key.confkey[1]
    WHERE foreign_key.contype = 'f'
      AND foreign_key.connamespace = 'public'::regnamespace
      AND (
        cardinality(foreign_key.conkey) <> 1
        OR cardinality(foreign_key.confkey) <> 1
        OR referenced_column.attname <> 'id'
      )
  ) THEN
    RAISE EXCEPTION 'Expected single-column foreign keys referencing id primary keys';
  END IF;
END
$$;

DO $$
DECLARE
  table_info record;
BEGIN
  FOR table_info IN
    SELECT schema_info.nspname, relation.relname
    FROM pg_class AS relation
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
    WHERE schema_info.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
    ORDER BY relation.oid
  LOOP
    EXECUTE format(
      'LOCK TABLE %I.%I IN ACCESS EXCLUSIVE MODE',
      table_info.nspname,
      table_info.relname
    );
  END LOOP;
END
$$;

CREATE TEMP TABLE uuidv7_id_tables (
  table_oid oid PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO pg_temp.uuidv7_id_tables (table_oid)
SELECT relation.oid
FROM pg_class AS relation
JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
JOIN pg_constraint AS primary_key
  ON primary_key.conrelid = relation.oid
 AND primary_key.contype = 'p'
 AND cardinality(primary_key.conkey) = 1
JOIN pg_attribute AS id_column
  ON id_column.attrelid = relation.oid
 AND id_column.attnum = primary_key.conkey[1]
 AND id_column.attname = 'id'
WHERE schema_info.nspname = 'public'
  AND relation.relkind IN ('r', 'p');

CREATE TEMP TABLE uuidv7_id_map (
  table_oid oid NOT NULL,
  old_id text NOT NULL,
  new_id uuid NOT NULL,
  PRIMARY KEY (table_oid, old_id),
  UNIQUE (table_oid, new_id)
) ON COMMIT DROP;

DO $$
DECLARE
  table_info record;
BEGIN
  FOR table_info IN
    SELECT schema_info.nspname, relation.relname, relation.oid
    FROM pg_class AS relation
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
    JOIN pg_constraint AS primary_key
      ON primary_key.conrelid = relation.oid
     AND primary_key.contype = 'p'
     AND cardinality(primary_key.conkey) = 1
    JOIN pg_attribute AS id_column
      ON id_column.attrelid = relation.oid
     AND id_column.attnum = primary_key.conkey[1]
     AND id_column.attname = 'id'
    WHERE schema_info.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
    ORDER BY relation.oid
  LOOP
    EXECUTE format(
      'INSERT INTO pg_temp.uuidv7_id_map (table_oid, old_id, new_id) '
      'SELECT %L::oid, id::text, uuidv7() FROM %I.%I',
      table_info.oid,
      table_info.nspname,
      table_info.relname
    );
  END LOOP;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_temp.uuidv7_id_map) THEN
    RAISE EXCEPTION 'No id primary-key tables were found';
  END IF;

  IF EXISTS (
    SELECT old_id
    FROM pg_temp.uuidv7_id_map
    GROUP BY old_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate primary-key IDs across tables prevent safe reference mapping';
  END IF;
END
$$;

CREATE TEMP TABLE uuidv7_foreign_keys (
  table_oid oid NOT NULL,
  constraint_name name NOT NULL,
  definition text NOT NULL,
  PRIMARY KEY (table_oid, constraint_name)
) ON COMMIT DROP;

INSERT INTO pg_temp.uuidv7_foreign_keys (table_oid, constraint_name, definition)
SELECT foreign_key.conrelid,
       foreign_key.conname,
       pg_get_constraintdef(foreign_key.oid, true)
FROM pg_constraint AS foreign_key
WHERE foreign_key.contype = 'f'
  AND foreign_key.connamespace = 'public'::regnamespace;

CREATE TEMP TABLE uuidv7_foreign_key_columns (
  table_oid oid NOT NULL,
  column_name name NOT NULL,
  referenced_table_oid oid NOT NULL,
  PRIMARY KEY (table_oid, column_name, referenced_table_oid)
) ON COMMIT DROP;

INSERT INTO pg_temp.uuidv7_foreign_key_columns (
  table_oid,
  column_name,
  referenced_table_oid
)
SELECT foreign_key.conrelid,
       child_column.attname,
       foreign_key.confrelid
FROM pg_constraint AS foreign_key
CROSS JOIN LATERAL unnest(foreign_key.conkey) WITH ORDINALITY AS child_key(attnum, position)
CROSS JOIN LATERAL unnest(foreign_key.confkey) WITH ORDINALITY AS parent_key(attnum, position)
JOIN pg_attribute AS child_column
  ON child_column.attrelid = foreign_key.conrelid
 AND child_column.attnum = child_key.attnum
JOIN pg_attribute AS parent_column
  ON parent_column.attrelid = foreign_key.confrelid
 AND parent_column.attnum = parent_key.attnum
WHERE foreign_key.contype = 'f'
  AND foreign_key.connamespace = 'public'::regnamespace
  AND child_key.position = parent_key.position
  AND parent_column.attname = 'id';

DO $$
DECLARE
  foreign_key record;
BEGIN
  FOR foreign_key IN
    SELECT table_oid, constraint_name
    FROM pg_temp.uuidv7_foreign_keys
    ORDER BY table_oid, constraint_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      foreign_key.table_oid::regclass,
      foreign_key.constraint_name
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  id_column record;
BEGIN
  FOR id_column IN
    SELECT table_oid, column_name, referenced_table_oid
    FROM pg_temp.uuidv7_foreign_key_columns
    ORDER BY table_oid, column_name
  LOOP
    EXECUTE format(
      'UPDATE %s AS child '
      'SET %I = id_map.new_id::text '
      'FROM pg_temp.uuidv7_id_map AS id_map '
      'WHERE id_map.table_oid = %L::oid '
      'AND child.%I::text = id_map.old_id',
      id_column.table_oid::regclass,
      id_column.column_name,
      id_column.referenced_table_oid,
      id_column.column_name
    );
  END LOOP;

  FOR id_column IN
    SELECT schema_info.nspname,
           relation.relname,
           relation.oid AS table_oid,
           column_info.attname AS column_name
    FROM pg_attribute AS column_info
    JOIN pg_class AS relation ON relation.oid = column_info.attrelid
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
    WHERE schema_info.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND column_info.attnum > 0
      AND NOT column_info.attisdropped
      AND right(column_info.attname, 3) = '_id'
      AND column_info.atttypid = 'text'::regtype
      AND NOT EXISTS (
        SELECT 1
        FROM pg_temp.uuidv7_foreign_key_columns AS foreign_key_column
        WHERE foreign_key_column.table_oid = relation.oid
          AND foreign_key_column.column_name = column_info.attname
      )
    ORDER BY relation.oid, column_info.attnum
  LOOP
    EXECUTE format(
      'UPDATE %I.%I AS child '
      'SET %I = id_map.new_id::text '
      'FROM pg_temp.uuidv7_id_map AS id_map '
      'WHERE child.%I::text = id_map.old_id',
      id_column.nspname,
      id_column.relname,
      id_column.column_name,
      id_column.column_name
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  table_info record;
BEGIN
  FOR table_info IN
    SELECT DISTINCT schema_info.nspname, relation.relname, relation.oid
    FROM pg_temp.uuidv7_id_map AS id_map
    JOIN pg_class AS relation ON relation.oid = id_map.table_oid
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
    ORDER BY relation.oid
  LOOP
    EXECUTE format(
      'UPDATE %I.%I AS parent '
      'SET id = id_map.new_id::text '
      'FROM pg_temp.uuidv7_id_map AS id_map '
      'WHERE id_map.table_oid = %L::oid '
      'AND parent.id::text = id_map.old_id',
      table_info.nspname,
      table_info.relname,
      table_info.oid
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  id_column record;
BEGIN
  FOR id_column IN
    SELECT schema_info.nspname,
           relation.relname,
           column_info.attname AS column_name
    FROM pg_attribute AS column_info
    JOIN pg_class AS relation ON relation.oid = column_info.attrelid
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
    JOIN pg_temp.uuidv7_id_tables AS id_table ON id_table.table_oid = relation.oid
    WHERE schema_info.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND column_info.attnum > 0
      AND NOT column_info.attisdropped
      AND column_info.attname = 'id'
    ORDER BY relation.oid
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE uuid USING %I::uuid',
      id_column.nspname,
      id_column.relname,
      id_column.column_name,
      id_column.column_name
    );
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT uuidv7()',
      id_column.nspname,
      id_column.relname,
      id_column.column_name
    );
  END LOOP;

  FOR id_column IN
    SELECT schema_info.nspname,
           relation.relname,
           column_info.attname AS column_name
    FROM pg_attribute AS column_info
    JOIN pg_class AS relation ON relation.oid = column_info.attrelid
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
    WHERE schema_info.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND column_info.attnum > 0
      AND NOT column_info.attisdropped
      AND right(column_info.attname, 3) = '_id'
      AND column_info.atttypid = 'text'::regtype
    ORDER BY relation.oid, column_info.attnum
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ALTER COLUMN %I TYPE uuid USING %I::uuid',
      id_column.nspname,
      id_column.relname,
      id_column.column_name,
      id_column.column_name
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  foreign_key record;
BEGIN
  FOR foreign_key IN
    SELECT table_oid, constraint_name, definition
    FROM pg_temp.uuidv7_foreign_keys
    ORDER BY table_oid, constraint_name
  LOOP
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I %s',
      foreign_key.table_oid::regclass,
      foreign_key.constraint_name,
      foreign_key.definition
    );
  END LOOP;
END
$$;

DO $$
DECLARE
  table_info record;
  id_column record;
  invalid_ids bigint;
BEGIN
  FOR table_info IN
    SELECT schema_info.nspname, relation.relname
    FROM pg_temp.uuidv7_id_tables AS id_table
    JOIN pg_class AS relation ON relation.oid = id_table.table_oid
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I WHERE substring(id::text FROM 15 FOR 1) <> ''7''',
      table_info.nspname,
      table_info.relname
    ) INTO invalid_ids;

    IF invalid_ids <> 0 THEN
      RAISE EXCEPTION 'Non-version-7 IDs remain in %.%', table_info.nspname, table_info.relname;
    END IF;
  END LOOP;

  FOR id_column IN
    SELECT schema_info.nspname,
           relation.relname,
           column_info.attname AS column_name
    FROM pg_attribute AS column_info
    JOIN pg_class AS relation ON relation.oid = column_info.attrelid
    JOIN pg_namespace AS schema_info ON schema_info.oid = relation.relnamespace
    WHERE schema_info.nspname = 'public'
      AND relation.relkind IN ('r', 'p')
      AND column_info.attnum > 0
      AND NOT column_info.attisdropped
      AND right(column_info.attname, 3) = '_id'
      AND column_info.atttypid = 'uuid'::regtype
    ORDER BY relation.oid, column_info.attnum
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %I.%I '
      'WHERE %I IS NOT NULL AND substring(%I::text FROM 15 FOR 1) <> ''7''',
      id_column.nspname,
      id_column.relname,
      id_column.column_name,
      id_column.column_name
    ) INTO invalid_ids;

    IF invalid_ids <> 0 THEN
      RAISE EXCEPTION 'Non-version-7 IDs remain in %.%.%',
        id_column.nspname,
        id_column.relname,
        id_column.column_name;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_constraint
      WHERE contype = 'f'
        AND connamespace = 'public'::regnamespace)
     <> (SELECT count(*) FROM pg_temp.uuidv7_foreign_keys) THEN
    RAISE EXCEPTION 'Foreign-key constraint count changed during migration';
  END IF;
END
$$;

COMMIT;
