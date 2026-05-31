-- RRPD role/privilege baseline for local/dev and production-infra reuse.
--
-- Optional session settings before running:
--   SELECT set_config('knu_roommate.rrpd_schema', 'public', false);
--   SELECT set_config('knu_roommate.app_runtime_role', 'app_runtime', false);
--   SELECT set_config('knu_roommate.retention_worker_role', 'retention_worker', false);
--   SELECT set_config('knu_roommate.retention_disclosure_role', 'retention_disclosure', false);
--
-- The script intentionally starts with GRANT/REVOKE rather than RLS. It prevents
-- user-facing runtime credentials from directly reading RRPD payload/identifier
-- tables while keeping retention worker/disclosure credentials separable.

DO $$
DECLARE
  target_schema text := COALESCE(NULLIF(current_setting('knu_roommate.rrpd_schema', true), ''), 'public');
  app_runtime_role text := COALESCE(NULLIF(current_setting('knu_roommate.app_runtime_role', true), ''), 'app_runtime');
  retention_worker_role text := COALESCE(NULLIF(current_setting('knu_roommate.retention_worker_role', true), ''), 'retention_worker');
  retention_disclosure_role text := COALESCE(NULLIF(current_setting('knu_roommate.retention_disclosure_role', true), ''), 'retention_disclosure');
  table_name text;
  type_name text;
  rrpd_tables text[] := ARRAY[
    'RetainedIdentity',
    'RetainedIdentityHold',
    'RetentionCase',
    'RetainedVaultObject',
    'RetainedVaultObjectHold',
    'RetentionAccessLog',
    'RetentionReviewJob',
    'ArchiveJob'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = target_schema) THEN
    RAISE EXCEPTION 'RRPD grant target schema % does not exist', target_schema;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_runtime_role) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', app_runtime_role);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = retention_worker_role) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', retention_worker_role);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = retention_disclosure_role) THEN
    EXECUTE format('CREATE ROLE %I NOLOGIN', retention_disclosure_role);
  END IF;

  EXECUTE format('GRANT USAGE ON SCHEMA %I TO %I, %I, %I', target_schema, app_runtime_role, retention_worker_role, retention_disclosure_role);

  FOR type_name IN
    SELECT t.typname
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = target_schema
      AND t.typtype IN ('e', 'd')
    ORDER BY t.typname
  LOOP
    EXECUTE format('GRANT USAGE ON TYPE %I.%I TO %I, %I, %I', target_schema, type_name, app_runtime_role, retention_worker_role, retention_disclosure_role);
  END LOOP;

  FOR table_name IN
    SELECT tablename FROM pg_tables WHERE schemaname = target_schema ORDER BY tablename
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM PUBLIC', target_schema, table_name);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM %I, %I, %I', target_schema, table_name, app_runtime_role, retention_worker_role, retention_disclosure_role);

    IF table_name = ANY(rrpd_tables) THEN
      CONTINUE;
    END IF;

    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, app_runtime_role);
  END LOOP;

  FOREACH table_name IN ARRAY rrpd_tables
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO %I', target_schema, table_name, retention_worker_role);
  END LOOP;

  EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, 'RetainedIdentity', retention_disclosure_role);
  EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, 'RetainedIdentityHold', retention_disclosure_role);
  EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, 'RetentionCase', retention_disclosure_role);
  EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, 'RetainedVaultObject', retention_disclosure_role);
  EXECUTE format('GRANT SELECT ON TABLE %I.%I TO %I', target_schema, 'RetainedVaultObjectHold', retention_disclosure_role);
  EXECUTE format('GRANT SELECT, INSERT ON TABLE %I.%I TO %I', target_schema, 'RetentionAccessLog', retention_disclosure_role);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I.%I TO %I', target_schema, 'RetentionReviewJob', retention_disclosure_role);

  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I REVOKE ALL ON TABLES FROM PUBLIC', target_schema);
END $$;
