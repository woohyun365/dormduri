#!/usr/bin/env sh
set -eu

psql \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set ON_ERROR_STOP=1 \
  --set runtime_user="$REHEARSAL_DB_RUNTIME_USER" \
  --set runtime_password="$REHEARSAL_DB_RUNTIME_PASSWORD" \
  --set retention_user="$REHEARSAL_DB_RETENTION_USER" \
  --set retention_password="$REHEARSAL_DB_RETENTION_PASSWORD" \
  --set disclosure_user="$REHEARSAL_DB_DISCLOSURE_USER" \
  --set disclosure_password="$REHEARSAL_DB_DISCLOSURE_PASSWORD" <<'SQL'
CREATE ROLE app_runtime NOLOGIN;
CREATE ROLE retention_worker NOLOGIN;
CREATE ROLE retention_disclosure NOLOGIN;
CREATE ROLE app_readonly NOLOGIN;
CREATE ROLE migration_owner NOLOGIN;

CREATE ROLE :"runtime_user" LOGIN PASSWORD :'runtime_password';
CREATE ROLE :"retention_user" LOGIN PASSWORD :'retention_password';
CREATE ROLE :"disclosure_user" LOGIN PASSWORD :'disclosure_password';

GRANT app_runtime TO :"runtime_user";
GRANT retention_worker TO :"retention_user";
GRANT retention_disclosure TO :"disclosure_user";
SQL
