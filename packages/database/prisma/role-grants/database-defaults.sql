-- Database-wide default privileges for objects that migration_owner creates.
--
-- Run by the object owner (dormduri_migrator logs in as migration_owner) or a
-- superuser, once per database run; infra/db/apply-role-grants.sh runs it before
-- apply-role-grants.sql. The global form (no IN SCHEMA) is needed because a
-- per-schema REVOKE cannot remove the global PUBLIC EXECUTE default on functions.
-- Tables and sequences have no PUBLIC default; the two lines keep it that way if
-- someone added one. Types keep the PUBLIC USAGE default: enum values are not data.
-- No app role gets an automatic grant; new tables open only through the grant table.

ALTER DEFAULT PRIVILEGES FOR ROLE migration_owner REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE migration_owner REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE migration_owner REVOKE ALL ON SEQUENCES FROM PUBLIC;
