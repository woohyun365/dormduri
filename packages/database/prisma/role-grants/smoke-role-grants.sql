-- Read-only smoke for the grant table on the migration connection.
--
-- Run after role-grant-inputs.sql and the loader, with
-- default_transaction_read_only = on (infra/db/smoke-role-grants.sh). It reads the
-- same expansion as apply-role-grants.sql.
--
-- Session settings:
--   dormduri.grant_schema          target schema (default public)
--   dormduri.expected_table_owner  owner of every relation and type (default migration_owner)
--   dormduri.smoke_login_users     space-separated role=LOGIN user pairs, for example
--                                  'app_runtime=dormduri_api retention_worker=dormduri_retention_worker'
--
-- Fails with every mismatch listed (up to 50 lines each):
--   - inputs and schema problems (same as apply)
--   - LOGIN users (the pairs above and every other LOGIN user that is a direct member
--     of exactly one managed role): exist, can log in, inherit exactly their group role
--     (no other managed role, no migration_owner), no superuser/CREATEROLE/CREATEDB/BYPASSRLS
--   - every relation x {PUBLIC, managed roles, LOGIN users} x 7 table privileges (8 with
--     MAINTAIN on PostgreSQL 17+) and every column x 4 column privileges equal the grant table
--   - LOGIN users with two or more group memberships or a direct grant
--   - relation and type owner, schema USAGE/CREATE, migration_owner default privileges

DO $$
DECLARE
  target_schema text := COALESCE(NULLIF(current_setting('dormduri.grant_schema', true), ''), 'public');
  expected_owner text := COALESCE(NULLIF(current_setting('dormduri.expected_table_owner', true), ''), 'migration_owner');
  login_users text := btrim(COALESCE(current_setting('dormduri.smoke_login_users', true), ''));
  problems text;
  table_checks bigint;
  column_checks bigint;
  login_count bigint;
BEGIN
  SELECT string_agg(problem, E'\n' ORDER BY problem)
  INTO problems
  FROM pg_temp.role_grant_input_problems(target_schema) AS problem;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'role grant smoke: inputs rejected for schema %:\n%', target_schema, problems;
  END IF;

  WITH login AS (
    SELECT subject, role_name FROM pg_temp.role_grant_smoke_subjects(login_users) WHERE is_login
  ),
  login_problems AS (
    SELECT format('LOGIN pair %s=%s has an unknown role', l.role_name, l.subject) AS problem
    FROM login l
    WHERE l.role_name <> ALL (pg_temp.role_grant_managed_roles())
    UNION ALL
    SELECT format('LOGIN user %s does not exist or cannot log in', l.subject)
    FROM login l
    WHERE NOT EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = l.subject AND r.rolcanlogin)
  )
  SELECT string_agg(problem, E'\n' ORDER BY problem) INTO problems FROM login_problems;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'role grant smoke: LOGIN users rejected:\n%', problems;
  END IF;

  WITH login AS (
    SELECT subject, role_name FROM pg_temp.role_grant_smoke_subjects(login_users) WHERE is_login
  ),
  others AS (
    SELECT o.other_role
    FROM unnest(pg_temp.role_grant_managed_roles() || ARRAY['migration_owner']) AS o(other_role)
    WHERE EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname = o.other_role)
  ),
  login_problems AS (
    SELECT format('LOGIN user %s has superuser, CREATEROLE, CREATEDB or BYPASSRLS', l.subject) AS problem
    FROM login l
    JOIN pg_roles r ON r.rolname = l.subject
    WHERE r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolbypassrls
    UNION ALL
    SELECT format('LOGIN user %s does not inherit %s', l.subject, l.role_name)
    FROM login l
    WHERE NOT pg_has_role(l.subject, l.role_name, 'USAGE')
    UNION ALL
    SELECT format('LOGIN user %s is also a member of %s', l.subject, o.other_role)
    FROM login l
    CROSS JOIN others o
    WHERE o.other_role <> l.role_name
      AND pg_has_role(l.subject, o.other_role, 'MEMBER')
  )
  SELECT string_agg(problem, E'\n' ORDER BY problem), (SELECT count(*) FROM login)
  INTO problems, login_count
  FROM login_problems;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'role grant smoke: LOGIN user membership mismatch:\n%', problems;
  END IF;

  WITH subjects AS (SELECT * FROM pg_temp.role_grant_smoke_subjects(login_users)),
  rels AS (SELECT * FROM pg_temp.role_grant_relations(target_schema)),
  expected AS (SELECT * FROM pg_temp.role_grant_expected(target_schema)),
  table_privileges AS (
    -- MAINTAIN (VACUUM, ANALYZE, REINDEX, LOCK) exists from PostgreSQL 17; the table never grants it.
    SELECT unnest(
      ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']
      || CASE WHEN current_setting('server_version_num')::int >= 170000 THEN ARRAY['MAINTAIN'] ELSE ARRAY[]::text[] END
    ) AS privilege_type
  ),
  compared AS (
    SELECT
      s.subject,
      r.relation_name,
      p.privilege_type,
      has_table_privilege(s.subject, r.relation_oid, p.privilege_type) AS actual,
      EXISTS (
        SELECT 1 FROM expected e
        WHERE e.table_name = r.relation_name
          AND e.role_name = s.role_name
          AND e.privilege_type = p.privilege_type
          AND e.column_name IS NULL
      ) AS wanted
    FROM subjects s
    CROSS JOIN rels r
    CROSS JOIN table_privileges p
  ),
  mismatched AS (
    SELECT format(
      '%s %s on %s: expected %s, actual %s',
      subject, privilege_type, relation_name,
      CASE WHEN wanted THEN 'granted' ELSE 'denied' END,
      CASE WHEN actual THEN 'granted' ELSE 'denied' END
    ) AS problem
    FROM compared
    WHERE actual <> wanted
    ORDER BY 1
    LIMIT 50
  )
  SELECT (SELECT count(*) FROM compared), (SELECT string_agg(problem, E'\n') FROM mismatched)
  INTO table_checks, problems;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'role grant smoke: table privilege mismatch:\n%', problems;
  END IF;

  WITH subjects AS (SELECT * FROM pg_temp.role_grant_smoke_subjects(login_users)),
  rels AS (SELECT * FROM pg_temp.role_grant_relations(target_schema)),
  expected AS (SELECT * FROM pg_temp.role_grant_expected(target_schema)),
  column_privileges AS (
    SELECT unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'REFERENCES']) AS privilege_type
  ),
  compared AS (
    SELECT
      s.subject,
      r.relation_name,
      a.attname::text AS column_name,
      p.privilege_type,
      has_column_privilege(s.subject, r.relation_oid, a.attnum, p.privilege_type) AS actual,
      EXISTS (
        SELECT 1 FROM expected e
        WHERE e.table_name = r.relation_name
          AND e.role_name = s.role_name
          AND e.privilege_type = p.privilege_type
          AND (e.column_name IS NULL OR e.column_name = a.attname::text)
      ) AS wanted
    FROM subjects s
    CROSS JOIN rels r
    JOIN pg_attribute a ON a.attrelid = r.relation_oid AND a.attnum > 0 AND NOT a.attisdropped
    CROSS JOIN column_privileges p
  ),
  mismatched AS (
    SELECT format(
      '%s %s on %s.%s: expected %s, actual %s',
      subject, privilege_type, relation_name, column_name,
      CASE WHEN wanted THEN 'granted' ELSE 'denied' END,
      CASE WHEN actual THEN 'granted' ELSE 'denied' END
    ) AS problem
    FROM compared
    WHERE actual <> wanted
    ORDER BY 1
    LIMIT 50
  )
  SELECT (SELECT count(*) FROM compared), (SELECT string_agg(problem, E'\n') FROM mismatched)
  INTO column_checks, problems;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'role grant smoke: column privilege mismatch:\n%', problems;
  END IF;

  WITH subjects AS (SELECT * FROM pg_temp.role_grant_smoke_subjects(login_users)),
  managed AS (
    SELECT r.oid, r.rolname
    FROM pg_roles r
    WHERE r.rolname = ANY (pg_temp.role_grant_managed_roles() || ARRAY['migration_owner'])
  ),
  -- Memberships that give privileges (PostgreSQL 16+ keeps ADMIN-only grants for role creators).
  usable_memberships AS (
    SELECT m.member, m.roleid
    FROM pg_auth_members m
    JOIN managed g ON g.oid = m.roleid
    WHERE m.inherit_option OR m.set_option
  ),
  structure_problems AS (
    SELECT format('relation %s is owned by %s, expected %s', r.relation_name, pg_get_userbyid(c.relowner), expected_owner) AS problem
    FROM pg_temp.role_grant_relations(target_schema) r
    JOIN pg_class c ON c.oid = r.relation_oid
    WHERE pg_get_userbyid(c.relowner) <> expected_owner
    UNION ALL
    SELECT format('type %s is owned by %s, expected %s', t.type_name, pg_get_userbyid(y.typowner), expected_owner)
    FROM pg_temp.role_grant_types(target_schema) t
    JOIN pg_type y ON y.oid = t.type_oid
    WHERE pg_get_userbyid(y.typowner) <> expected_owner
    UNION ALL
    SELECT format('%s can CREATE in schema %s', s.subject, target_schema)
    FROM subjects s
    WHERE has_schema_privilege(s.subject, target_schema, 'CREATE')
    UNION ALL
    SELECT format('%s can CREATE in database %s', s.subject, current_database())
    FROM subjects s
    WHERE has_database_privilege(s.subject, current_database(), 'CREATE')
    UNION ALL
    SELECT format('%s cannot use schema %s', s.subject, target_schema)
    FROM subjects s
    WHERE s.role_name <> 'none'
      AND NOT has_schema_privilege(s.subject, target_schema, 'USAGE')
    UNION ALL
    -- Every LOGIN member of a group, including human read-only users that have no URL here.
    SELECT format('LOGIN user %s is a member of %s', pg_get_userbyid(u.member), string_agg(pg_get_userbyid(u.roleid), ', ' ORDER BY pg_get_userbyid(u.roleid)))
    FROM usable_memberships u
    JOIN pg_roles r ON r.oid = u.member AND r.rolcanlogin
    GROUP BY u.member
    HAVING count(*) > 1
    UNION ALL
    SELECT DISTINCT format('LOGIN user %s has superuser, CREATEROLE, CREATEDB or BYPASSRLS', r.rolname)
    FROM usable_memberships u
    JOIN pg_roles r ON r.oid = u.member AND r.rolcanlogin
    WHERE r.rolsuper OR r.rolcreaterole OR r.rolcreatedb OR r.rolbypassrls
    UNION ALL
    -- Privileges reach roles only through the groups in the grant table.
    SELECT DISTINCT format('%s has a direct grant on %s', pg_get_userbyid(x.grantee), r.relation_name)
    FROM pg_temp.role_grant_relations(target_schema) r
    JOIN pg_class c ON c.oid = r.relation_oid
    CROSS JOIN LATERAL aclexplode(c.relacl) x
    WHERE x.grantee <> 0 AND x.grantee <> c.relowner AND x.grantee NOT IN (SELECT oid FROM managed)
    UNION ALL
    SELECT DISTINCT format('%s has a direct column grant on %s.%s', pg_get_userbyid(x.grantee), r.relation_name, a.attname)
    FROM pg_temp.role_grant_relations(target_schema) r
    JOIN pg_attribute a ON a.attrelid = r.relation_oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attacl IS NOT NULL
    CROSS JOIN LATERAL aclexplode(a.attacl) x
    WHERE x.grantee <> 0 AND x.grantee NOT IN (SELECT oid FROM managed)
    UNION ALL
    -- No role gets new objects automatically; types keep the PUBLIC USAGE default.
    SELECT format(
      'migration_owner default privileges grant %s on new %s to %s',
      x.privilege_type,
      CASE d.defaclobjtype WHEN 'r' THEN 'tables' WHEN 'S' THEN 'sequences' WHEN 'f' THEN 'functions' WHEN 'T' THEN 'types' WHEN 'n' THEN 'schemas' ELSE d.defaclobjtype::text END,
      CASE WHEN x.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(x.grantee) END
    )
    FROM pg_default_acl d
    JOIN managed o ON o.oid = d.defaclrole AND o.rolname = 'migration_owner'
    CROSS JOIN LATERAL aclexplode(d.defaclacl) x
    WHERE x.grantee <> d.defaclrole
      AND NOT (d.defaclobjtype = 'T' AND x.grantee = 0)
    UNION ALL
    SELECT 'migration_owner default privileges still give PUBLIC EXECUTE on new functions'
    WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'migration_owner')
      AND NOT EXISTS (
        SELECT 1
        FROM pg_default_acl d
        WHERE d.defaclrole = 'migration_owner'::regrole
          AND d.defaclnamespace = 0
          AND d.defaclobjtype = 'f'
          AND NOT EXISTS (
            SELECT 1 FROM aclexplode(d.defaclacl) x
            WHERE x.grantee = 0 AND x.privilege_type = 'EXECUTE'
          )
      )
  )
  SELECT string_agg(problem, E'\n' ORDER BY problem) INTO problems FROM structure_problems;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'role grant smoke: ownership or schema mismatch:\n%', problems;
  END IF;

  RAISE NOTICE 'role grant smoke ok: schema %, % LOGIN users, % table checks, % column checks',
    target_schema, login_count, table_checks, column_checks;
END $$;
