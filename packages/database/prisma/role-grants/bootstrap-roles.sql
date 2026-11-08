-- Group role and LOGIN user bootstrap. The RDS master user runs this file once
-- per database before the first migration, and again whenever a role or LOGIN
-- user is added (infra/db/README.md "새 role 추가").
--
-- Re-runnable: existing roles, LOGIN users and memberships are kept. Role
-- attributes (NOLOGIN/LOGIN, CONNECTION LIMIT) and per-user settings converge
-- to the values below on every run. This file never sets passwords; the Owner
-- sets each LOGIN user password with psql \password after this file runs.
--
-- Optional session settings before running:
--   SELECT set_config('dormduri.bootstrap_schema', 'public', false);
--   SELECT set_config('dormduri.readonly_operator_aliases', 'alias_a,alias_b', false);
--   SELECT set_config('dormduri.bootstrap_pgaudit', 'off', false); -- disposable test DBs only
--
-- Group roles own no LOGIN. migration_owner owns every schema object
-- (dormduri_migrator logs in with role = migration_owner), so grant SQL runs as
-- the object owner and needs no CREATEROLE. migration_owner gets CREATE on the
-- target schema and on the database (the baseline migration needs both).

DO $$
DECLARE
  target_schema text := COALESCE(NULLIF(current_setting('dormduri.bootstrap_schema', true), ''), 'public');
  readonly_aliases text := COALESCE(current_setting('dormduri.readonly_operator_aliases', true), '');
  pgaudit_mode text := COALESCE(NULLIF(current_setting('dormduri.bootstrap_pgaudit', true), ''), 'on');
  group_roles text[] := ARRAY[
    'migration_owner',
    'app_runtime',
    'retention_worker',
    'retention_disclosure',
    'app_readonly',
    'backoffice_runtime'
  ];
  -- LOGIN user, group role, CONNECTION LIMIT, SET option(migrator only).
  -- CONNECTION LIMIT: service user = pool x 2 + 2 (old and new container overlap),
  -- one-off and human user = pool + 1 (infra/db/README.md, Connection budget).
  service_users text[][] := ARRAY[
    ARRAY['dormduri_migrator', 'migration_owner', '3', 'set'],
    ARRAY['dormduri_api', 'app_runtime', '22', 'noset'],
    ARRAY['dormduri_retention_worker', 'retention_worker', '8', 'noset'],
    ARRAY['dormduri_api_disclosure', 'retention_disclosure', '4', 'noset']
  ];
  human_connection_limit integer := 4;
  role_name text;
  user_row text[];
  alias text;
  human_user text;
BEGIN
  IF pgaudit_mode NOT IN ('on', 'off') THEN
    RAISE EXCEPTION 'dormduri.bootstrap_pgaudit must be on or off';
  END IF;
  IF pgaudit_mode = 'on' AND NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgaudit') THEN
    RAISE EXCEPTION 'pgaudit extension is missing: run CREATE EXTENSION pgaudit after the parameter group reboot';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = target_schema) THEN
    RAISE EXCEPTION 'bootstrap target schema % does not exist', target_schema;
  END IF;

  FOREACH role_name IN ARRAY group_roles
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
    END IF;
    EXECUTE format('ALTER ROLE %I NOLOGIN', role_name);
  END LOOP;

  FOREACH user_row SLICE 1 IN ARRAY service_users
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = user_row[1]) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', user_row[1]);
    END IF;
    EXECUTE format('ALTER ROLE %I LOGIN INHERIT CONNECTION LIMIT %s', user_row[1], user_row[3]::integer);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_auth_members m
      WHERE m.roleid = user_row[2]::regrole
        AND m.member = user_row[1]::regrole
    ) THEN
      EXECUTE format(
        'GRANT %I TO %I WITH INHERIT TRUE, SET %s',
        user_row[2],
        user_row[1],
        CASE WHEN user_row[4] = 'set' THEN 'TRUE' ELSE 'FALSE' END
      );
    END IF;
  END LOOP;

  -- Prisma creates objects as the session role; this makes every object owned by
  -- migration_owner instead of the LOGIN user.
  EXECUTE format('ALTER ROLE %I SET role = %L', 'dormduri_migrator', 'migration_owner');

  FOREACH alias IN ARRAY string_to_array(readonly_aliases, ',')
  LOOP
    alias := btrim(alias);
    CONTINUE WHEN alias = '';
    IF alias !~ '^[a-z0-9_]{1,40}$' THEN
      RAISE EXCEPTION 'readonly operator alias must match [a-z0-9_]{1,40}';
    END IF;
    human_user := 'dormduri_ro_' || alias;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = human_user) THEN
      EXECUTE format('CREATE ROLE %I LOGIN', human_user);
    END IF;
    EXECUTE format('ALTER ROLE %I LOGIN INHERIT CONNECTION LIMIT %s', human_user, human_connection_limit);
    IF NOT EXISTS (
      SELECT 1
      FROM pg_auth_members m
      WHERE m.roleid = 'app_readonly'::regrole
        AND m.member = human_user::regrole
    ) THEN
      EXECUTE format('GRANT %I TO %I WITH INHERIT TRUE, SET FALSE', 'app_readonly', human_user);
    END IF;
    IF pgaudit_mode = 'on' THEN
      EXECUTE format('ALTER ROLE %I SET pgaudit.log = %L', human_user, 'all');
    END IF;
  END LOOP;

  -- The master user is a human LOGIN user (break-glass). A session can turn this
  -- off, so connection logs and the break-glass record back it up
  -- (infra/db/README.md, 권한 내역과 break-glass).
  IF pgaudit_mode = 'on' THEN
    EXECUTE format('ALTER ROLE %I SET pgaudit.log = %L', session_user, 'all');
  END IF;

  -- PostgreSQL 15+ gives PUBLIC only USAGE on public; keep CREATE off explicitly.
  EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM PUBLIC', target_schema);
  EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO %I WITH GRANT OPTION', target_schema, 'migration_owner');
  -- The initial baseline starts with CREATE SCHEMA IF NOT EXISTS and CREATE EXTENSION
  -- IF NOT EXISTS; PostgreSQL checks database CREATE before the IF NOT EXISTS test.
  -- App roles get no USAGE on a schema the migration role might add.
  EXECUTE format('GRANT CREATE ON DATABASE %I TO %I', current_database(), 'migration_owner');
END $$;
