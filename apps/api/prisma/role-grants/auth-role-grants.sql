-- Auth operation role/privilege baseline.
--
-- Optional session settings before running:
--   SELECT set_config('knu_roommate.auth_schema', 'public', false);
--   SELECT set_config('knu_roommate.app_runtime_role', 'app_runtime', false);
--   SELECT set_config('knu_roommate.retention_worker_role', 'retention_worker', false);
--   SELECT set_config('knu_roommate.auth_cleanup_worker_role', 'auth_cleanup_worker', false);
--   SELECT set_config('knu_roommate.app_readonly_role', 'app_readonly', false);
--   SELECT set_config('knu_roommate.migration_role', 'migration_owner', false);
--
-- Application RBAC remains the canonical user/action authorization layer. These
-- database roles are defense-in-depth boundaries for operational credentials:
-- runtime handles user traffic, cleanup worker handles TTL delete batches,
-- read-only handles operations/debugging reads, and migration owns DDL via the
-- separate MIGRATION_DATABASE_URL/DIRECT_URL path.
--
-- Runtime note: PrismaModule executes auth cleanup and bounded alert signal reads through
-- RetentionWorkerPrismaService to avoid adding another RDS pool. The
-- auth_cleanup_worker role below is a future infra split candidate after RDS
-- connection/IOPS budget is confirmed.

DO $$
DECLARE
  target_schema text := COALESCE(NULLIF(current_setting('knu_roommate.auth_schema', true), ''), 'public');
  app_runtime_role text := COALESCE(NULLIF(current_setting('knu_roommate.app_runtime_role', true), ''), 'app_runtime');
  retention_worker_role text := COALESCE(NULLIF(current_setting('knu_roommate.retention_worker_role', true), ''), 'retention_worker');
  auth_cleanup_worker_role text := COALESCE(NULLIF(current_setting('knu_roommate.auth_cleanup_worker_role', true), ''), 'auth_cleanup_worker');
  app_readonly_role text := COALESCE(NULLIF(current_setting('knu_roommate.app_readonly_role', true), ''), 'app_readonly');
  migration_role text := COALESCE(NULLIF(current_setting('knu_roommate.migration_role', true), ''), 'migration_owner');
  auth_cleanup_tables text[] := ARRAY[
    'LoginAttempt',
    'VerificationCode',
    'VerificationCodeRequestLog',
    'AuthSession',
    'AuthSecurityEvent'
  ];
  auth_signal_tables text[] := ARRAY['AuthMailOutboxEvent'];
  table_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = target_schema) THEN
    RAISE EXCEPTION 'Auth grant target schema % does not exist', target_schema;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_runtime_role) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', app_runtime_role);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = auth_cleanup_worker_role) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', auth_cleanup_worker_role);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = retention_worker_role) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', retention_worker_role);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_readonly_role) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', app_readonly_role);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = migration_role) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', migration_role);
  END IF;

  EXECUTE format(
    'GRANT USAGE ON SCHEMA %I TO %I, %I, %I, %I, %I',
    target_schema,
    app_runtime_role,
    retention_worker_role,
    auth_cleanup_worker_role,
    app_readonly_role,
    migration_role
  );

  FOREACH table_name IN ARRAY auth_cleanup_tables
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', target_schema, table_name);
    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM %I, %I, %I, %I',
      target_schema,
      table_name,
      app_runtime_role,
      retention_worker_role,
      auth_cleanup_worker_role,
      app_readonly_role
    );

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, app_runtime_role);
    EXECUTE format('GRANT SELECT, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, retention_worker_role);
    EXECUTE format('GRANT SELECT, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, auth_cleanup_worker_role);
    EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, table_name, app_readonly_role);
  END LOOP;

  FOREACH table_name IN ARRAY auth_signal_tables
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', target_schema, table_name);
    EXECUTE format(
      'REVOKE ALL ON TABLE %I.%I FROM %I, %I, %I, %I',
      target_schema,
      table_name,
      app_runtime_role,
      retention_worker_role,
      auth_cleanup_worker_role,
      app_readonly_role
    );

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, app_runtime_role);
    EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, table_name, retention_worker_role);
    EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, table_name, auth_cleanup_worker_role);
    EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, table_name, app_readonly_role);
  END LOOP;

  -- Migration credentials are intentionally not granted to runtime/worker/read-only.
  -- Run Prisma migration/admin operations through MIGRATION_DATABASE_URL/DIRECT_URL
  -- as a separately rotated credential with schema ownership managed by infra.
END $$;
