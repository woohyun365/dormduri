-- Session-local inputs shared by apply-role-grants.sql and smoke-role-grants.sql.
--
-- After this file, the loader fills the two tables from role-grant-matrix.csv and
-- column-classes.csv (psql \copy in infra/db/*.sh, parameterized INSERT in the API
-- integration harness). Both files then read the same expansion, so apply and smoke
-- can never disagree about what the grant table means.
--
-- role-grant-matrix.csv: table,role,privileges,columns
--   role        app_runtime | retention_worker | retention_disclosure | app_readonly |
--               backoffice_runtime | none (listed table, no grant)
--   privileges  space-separated SELECT INSERT UPDATE DELETE
--   columns     empty = table-level grant; column names = column-level grant;
--               -<class> tokens = every classified column except those classes
-- column-classes.csv: table,column,class (class: secret identifier pseudonymous quasi
--   content reference operational). Every column of every schema table except
--   _prisma_migrations is classified.

CREATE TEMP TABLE role_grant_matrix (
  table_name text NOT NULL,
  role_name text NOT NULL,
  privileges text,
  columns text
);

CREATE TEMP TABLE role_grant_columns (
  table_name text NOT NULL,
  column_name text NOT NULL,
  column_class text NOT NULL,
  PRIMARY KEY (table_name, column_name)
);

CREATE FUNCTION pg_temp.role_grant_managed_roles()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT ARRAY['app_runtime', 'retention_worker', 'retention_disclosure', 'app_readonly', 'backoffice_runtime']
$fn$;

-- Relations that must appear in the grant table: tables, partitioned tables, views,
-- materialized views and foreign tables in the target schema. Extension members
-- (pg_stat_statements views, pgaudit functions) belong to the extension, not to us.
CREATE FUNCTION pg_temp.role_grant_relations(target_schema text)
RETURNS TABLE (relation_oid oid, relation_name text)
LANGUAGE sql
STABLE
AS $fn$
  SELECT c.oid, c.relname::text
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = target_schema
    AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
    )
$fn$;

-- (table, role, privilege, column). column_name NULL means a table-level grant.
CREATE FUNCTION pg_temp.role_grant_expected(target_schema text)
RETURNS TABLE (table_name text, role_name text, privilege_type text, column_name text)
LANGUAGE sql
STABLE
AS $fn$
  WITH grant_rows AS (
    SELECT
      m.table_name,
      m.role_name,
      p.privilege_type,
      btrim(COALESCE(m.columns, '')) AS columns
    FROM pg_temp.role_grant_matrix m
    CROSS JOIN LATERAL regexp_split_to_table(btrim(COALESCE(m.privileges, '')), '\s+') AS p(privilege_type)
    WHERE m.role_name <> 'none'
      AND btrim(COALESCE(m.privileges, '')) <> ''
  )
  SELECT g.table_name, g.role_name, g.privilege_type, NULL::text
  FROM grant_rows g
  WHERE g.columns = ''
  UNION
  SELECT g.table_name, g.role_name, g.privilege_type, token
  FROM grant_rows g
  CROSS JOIN LATERAL regexp_split_to_table(g.columns, '\s+') AS t(token)
  WHERE g.columns <> ''
    AND g.columns NOT LIKE '-%'
  UNION
  SELECT g.table_name, g.role_name, g.privilege_type, c.column_name
  FROM grant_rows g
  JOIN pg_temp.role_grant_columns c ON c.table_name = g.table_name
  WHERE g.columns LIKE '-%'
    AND c.column_class <> ALL (
      SELECT substr(token, 2) FROM regexp_split_to_table(g.columns, '\s+') AS t(token)
    )
$fn$;

-- Every reason the inputs or the schema cannot be applied as is. Empty means ok.
CREATE FUNCTION pg_temp.role_grant_input_problems(target_schema text)
RETURNS SETOF text
LANGUAGE sql
STABLE
AS $fn$
  WITH
  roles AS (SELECT unnest(pg_temp.role_grant_managed_roles()) AS role_name),
  rels AS (SELECT * FROM pg_temp.role_grant_relations(target_schema)),
  cols AS (
    SELECT r.relation_name AS table_name, a.attname::text AS column_name
    FROM rels r
    JOIN pg_attribute a ON a.attrelid = r.relation_oid AND a.attnum > 0 AND NOT a.attisdropped
  ),
  tokens AS (
    SELECT m.table_name, m.role_name, t.token
    FROM pg_temp.role_grant_matrix m
    CROSS JOIN LATERAL regexp_split_to_table(btrim(COALESCE(m.columns, '')), '\s+') AS t(token)
    WHERE btrim(COALESCE(m.columns, '')) <> ''
  )
  SELECT format('schema %s does not exist', target_schema)
  WHERE NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = target_schema)
  UNION ALL
  SELECT format('role %s does not exist (run bootstrap-roles.sql first)', role_name)
  FROM roles
  WHERE NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = roles.role_name)
  UNION ALL
  SELECT DISTINCT format('unknown role %s on %s', m.role_name, m.table_name)
  FROM pg_temp.role_grant_matrix m
  WHERE m.role_name NOT IN (SELECT role_name FROM roles UNION SELECT 'none')
  UNION ALL
  SELECT DISTINCT format('unknown privilege %s on %s for %s', p, m.table_name, m.role_name)
  FROM pg_temp.role_grant_matrix m
  CROSS JOIN LATERAL regexp_split_to_table(btrim(COALESCE(m.privileges, '')), '\s+') AS p
  WHERE m.role_name <> 'none'
    AND p NOT IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
  UNION ALL
  SELECT format('role none on %s must not list privileges or columns', m.table_name)
  FROM pg_temp.role_grant_matrix m
  WHERE m.role_name = 'none'
    AND (btrim(COALESCE(m.privileges, '')) <> '' OR btrim(COALESCE(m.columns, '')) <> '')
  UNION ALL
  SELECT format('relation %s is not in role-grant-matrix.csv', r.relation_name)
  FROM rels r
  WHERE NOT EXISTS (SELECT 1 FROM pg_temp.role_grant_matrix m WHERE m.table_name = r.relation_name)
  UNION ALL
  SELECT DISTINCT format('role-grant-matrix.csv lists %s, which is not in schema %s', m.table_name, target_schema)
  FROM pg_temp.role_grant_matrix m
  WHERE NOT EXISTS (SELECT 1 FROM rels r WHERE r.relation_name = m.table_name)
  UNION ALL
  SELECT format('column %s.%s is not in column-classes.csv', c.table_name, c.column_name)
  FROM cols c
  WHERE c.table_name <> '_prisma_migrations'
    AND NOT EXISTS (
      SELECT 1 FROM pg_temp.role_grant_columns k
      WHERE k.table_name = c.table_name AND k.column_name = c.column_name
    )
  UNION ALL
  SELECT format('column-classes.csv lists %s.%s, which is not in schema %s', k.table_name, k.column_name, target_schema)
  FROM pg_temp.role_grant_columns k
  WHERE NOT EXISTS (SELECT 1 FROM cols c WHERE c.table_name = k.table_name AND c.column_name = k.column_name)
  UNION ALL
  SELECT format('unknown column class %s for %s.%s', k.column_class, k.table_name, k.column_name)
  FROM pg_temp.role_grant_columns k
  WHERE k.column_class NOT IN ('secret', 'identifier', 'pseudonymous', 'quasi', 'content', 'reference', 'operational')
  UNION ALL
  SELECT DISTINCT format('columns on %s for %s mix column names and -class exclusions', t.table_name, t.role_name)
  FROM tokens t
  GROUP BY t.table_name, t.role_name
  HAVING bool_or(t.token LIKE '-%') AND bool_or(t.token NOT LIKE '-%')
  UNION ALL
  SELECT format('column %s.%s in role-grant-matrix.csv does not exist', t.table_name, t.token)
  FROM tokens t
  WHERE t.token NOT LIKE '-%'
    AND NOT EXISTS (SELECT 1 FROM cols c WHERE c.table_name = t.table_name AND c.column_name = t.token)
  UNION ALL
  SELECT format('exclusion %s on %s.%s is not a column class', t.token, t.table_name, t.role_name)
  FROM tokens t
  WHERE t.token LIKE '-%'
    AND substr(t.token, 2) NOT IN ('secret', 'identifier', 'pseudonymous', 'quasi', 'content', 'reference', 'operational')
  UNION ALL
  SELECT DISTINCT format('exclusion rule on %s needs classified columns', t.table_name)
  FROM tokens t
  WHERE t.token LIKE '-%'
    AND NOT EXISTS (SELECT 1 FROM pg_temp.role_grant_columns k WHERE k.table_name = t.table_name)
  UNION ALL
  -- No sequence or routine exists today (ids are app-generated strings). A new one
  -- needs a rule in this pipeline before it can ship (infra/db/README.md, Grant 표).
  SELECT format('sequence %s needs a grant rule', c.relname)
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = target_schema
    AND c.relkind = 'S'
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_class'::regclass AND d.objid = c.oid AND d.deptype = 'e'
    )
  UNION ALL
  SELECT format('routine %s needs a grant rule', p.proname)
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = target_schema
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_proc'::regclass AND d.objid = p.oid AND d.deptype = 'e'
    )
$fn$;

-- Enum and domain types created by migrations (extension types excluded).
CREATE FUNCTION pg_temp.role_grant_types(target_schema text)
RETURNS TABLE (type_oid oid, type_name text)
LANGUAGE sql
STABLE
AS $fn$
  SELECT t.oid, t.typname::text
  FROM pg_type t
  JOIN pg_namespace n ON n.oid = t.typnamespace
  WHERE n.nspname = target_schema
    AND t.typtype IN ('e', 'd')
    AND NOT EXISTS (
      SELECT 1 FROM pg_depend d
      WHERE d.classid = 'pg_type'::regclass AND d.objid = t.oid AND d.deptype = 'e'
    )
$fn$;

-- Smoke subjects: PUBLIC (no grant), every managed role, and LOGIN users given as
-- space-separated role=user pairs; a LOGIN user must have exactly its role's grants.
CREATE FUNCTION pg_temp.role_grant_smoke_subjects(login_users text)
RETURNS TABLE (subject text, role_name text, is_login boolean)
LANGUAGE sql
STABLE
AS $fn$
  SELECT 'public', 'none', false
  UNION ALL
  SELECT role_name, role_name, false
  FROM unnest(pg_temp.role_grant_managed_roles()) AS role_name
  UNION ALL
  SELECT split_part(pair, '=', 2), split_part(pair, '=', 1), true
  FROM regexp_split_to_table(btrim(COALESCE(login_users, '')), '\s+') AS pair
  WHERE btrim(COALESCE(login_users, '')) <> ''
$fn$;
