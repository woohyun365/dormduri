-- Applies role-grant-matrix.csv to every relation in one schema.
--
-- Run as the object owner (dormduri_migrator logs in as migration_owner) after
-- role-grant-inputs.sql and the loader. infra/db/apply-role-grants.sh runs it in one
-- transaction after database-defaults.sql.
--
-- Session setting:
--   SELECT set_config('dormduri.grant_schema', 'public', false);
--
-- Fails closed: a relation, column, sequence or routine the inputs do not cover, a
-- missing group role (bootstrap-roles.sql) or an unknown privilege stops the run.
-- PUBLIC and every managed role first lose all relation privileges (REVOKE on a
-- table also revokes its column privileges), then get exactly the listed ones.

DO $$
DECLARE
  target_schema text := COALESCE(NULLIF(current_setting('dormduri.grant_schema', true), ''), 'public');
  managed_role_list text;
  problems text;
  rec record;
BEGIN
  SELECT string_agg(problem, E'\n' ORDER BY problem)
  INTO problems
  FROM pg_temp.role_grant_input_problems(target_schema) AS problem;
  IF problems IS NOT NULL THEN
    RAISE EXCEPTION E'role grant inputs rejected for schema %:\n%', target_schema, problems;
  END IF;

  SELECT string_agg(quote_ident(role_name), ', ' ORDER BY role_name)
  INTO managed_role_list
  FROM unnest(pg_temp.role_grant_managed_roles()) AS role_name;

  FOR rec IN SELECT relation_name FROM pg_temp.role_grant_relations(target_schema) ORDER BY relation_name
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC, %s', target_schema, rec.relation_name, managed_role_list);
  END LOOP;

  EXECUTE format('GRANT USAGE ON SCHEMA %I TO %s', target_schema, managed_role_list);

  FOR rec IN SELECT type_name FROM pg_temp.role_grant_types(target_schema) ORDER BY type_name
  LOOP
    EXECUTE format('GRANT USAGE ON TYPE %I.%I TO %s', target_schema, rec.type_name, managed_role_list);
  END LOOP;

  FOR rec IN
    SELECT e.table_name, e.role_name, string_agg(e.privilege_type, ', ' ORDER BY e.privilege_type) AS privileges
    FROM pg_temp.role_grant_expected(target_schema) e
    WHERE e.column_name IS NULL
    GROUP BY e.table_name, e.role_name
    ORDER BY e.table_name, e.role_name
  LOOP
    EXECUTE format('GRANT %s ON TABLE %I.%I TO %I', rec.privileges, target_schema, rec.table_name, rec.role_name);
  END LOOP;

  FOR rec IN
    SELECT
      e.table_name,
      e.role_name,
      e.privilege_type,
      string_agg(quote_ident(e.column_name), ', ' ORDER BY e.column_name) AS columns
    FROM pg_temp.role_grant_expected(target_schema) e
    WHERE e.column_name IS NOT NULL
    GROUP BY e.table_name, e.role_name, e.privilege_type
    ORDER BY e.table_name, e.role_name, e.privilege_type
  LOOP
    EXECUTE format(
      'GRANT %s (%s) ON TABLE %I.%I TO %I',
      rec.privilege_type,
      rec.columns,
      target_schema,
      rec.table_name,
      rec.role_name
    );
  END LOOP;

  RAISE NOTICE 'role grants applied to schema %', target_schema;
END $$;
