#!/usr/bin/env sh
# Sourced by the infra/db scripts: `db_psql <database URL> [psql arguments...]` runs psql with the TLS form libpq needs.
#
# The DB secrets keep the URL form each client verifies the server with (infra/db/README.md "RDS SSL / CA bundle"):
# - migration (Prisma CLI form B): sslmode=require&sslcert=<CA file>&sslaccept=strict. Prisma reads sslcert as the
#   CA to trust; libpq would read it as a client certificate and rejects sslaccept.
# - runtime users (libpq form): sslmode=verify-full&sslrootcert=<CA file>.
# db_psql removes the TLS query arguments and gives psql the CA through PGSSLMODE=verify-full and PGSSLROOTCERT
# (form C), so both forms verify the server certificate and host name. Prisma-only query arguments (schema,
# connection_limit, pool_timeout, pgbouncer, statement_cache_size, socket_timeout) are removed too, because libpq
# rejects an unknown URI query parameter. libpq arguments (hostaddr, connect_timeout) stay. A URL without TLS
# arguments (local, CI) keeps the caller's libpq environment.
# A TLS setting that would not verify the certificate and host name (sslmode=require or prefer without a CA,
# sslaccept other than strict, client keys) is refused with exit 64 before psql runs. Values are never printed.

db_psql() {
  _db_url=$1
  shift
  case "$_db_url" in
    *\?*) ;;
    *)
      psql "$_db_url" "$@"
      return
      ;;
  esac
  _db_base=${_db_url%%\?*}
  _db_query=${_db_url#*\?}
  _db_rest=''
  _db_mode=''
  _db_root=''
  _db_cert=''
  _db_accept=''
  _db_tls=false
  _db_other_tls=false
  _db_saved_ifs=$IFS
  IFS='&'
  set -f
  for _db_pair in $_db_query; do
    case "$_db_pair" in
      sslmode=*) _db_mode=${_db_pair#*=} _db_tls=true ;;
      sslrootcert=*) _db_root=${_db_pair#*=} _db_tls=true ;;
      sslcert=*) _db_cert=${_db_pair#*=} _db_tls=true ;;
      sslaccept=*) _db_accept=${_db_pair#*=} _db_tls=true ;;
      ssl*=*) _db_other_tls=true _db_tls=true ;;
      schema=* | connection_limit=* | pool_timeout=* | pgbouncer=* | statement_cache_size=* | socket_timeout=*) ;;
      '') ;;
      *) _db_rest="${_db_rest:+${_db_rest}&}${_db_pair}" ;;
    esac
  done
  set +f
  IFS=$_db_saved_ifs
  _db_target="${_db_base}${_db_rest:+?${_db_rest}}"
  if [ "$_db_tls" = false ]; then
    psql "$_db_target" "$@"
    return
  fi
  if [ "$_db_mode" = disable ] && [ -z "${_db_root}${_db_cert}${_db_accept}" ] && [ "$_db_other_tls" = false ]; then
    PGSSLMODE=disable psql "$_db_target" "$@"
    return
  fi
  _db_ca=''
  if [ "$_db_other_tls" = false ]; then
    if [ -n "$_db_root" ] && [ -z "${_db_cert}${_db_accept}" ]; then
      case "$_db_mode" in verify-full | '') _db_ca=$_db_root ;; esac
    elif [ -n "$_db_cert" ] && [ -z "$_db_root" ] && [ "$_db_accept" = strict ]; then
      case "$_db_mode" in require | '') _db_ca=$_db_cert ;; esac
    fi
  fi
  if [ -z "$_db_ca" ]; then
    echo 'refusing a database URL whose TLS settings do not verify the server certificate and host name' >&2
    exit 64
  fi
  PGSSLMODE=verify-full PGSSLROOTCERT=$_db_ca psql "$_db_target" "$@"
}
