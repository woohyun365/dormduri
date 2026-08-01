#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: infra/deploy/scripts/api-release-smoke.sh [--dry-run]

Checks API/nginx release health and metrics guard without printing secrets.
Required env for a real smoke:
  API_BASE_URL
  METRICS_BEARER_TOKEN
USAGE
}

fail() {
  echo "$1" >&2
  exit "${2:-1}"
}

require_env() {
  name="$1"
  eval "value=\${$name:-}"
  if [ -z "$value" ]; then
    fail "missing required env: $name" 64
  fi
}

http_status() {
  output_file="$1"
  shift
  curl -sS -o "$output_file" -w '%{http_code}' "$@"
}

dry_run=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      shift
      continue
      ;;
    --dry-run)
      dry_run=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 64
      ;;
  esac
  shift
done

if [ "$dry_run" = true ]; then
  echo 'dry-run: would check /health, /health/live, /health/ready'
  echo 'dry-run: would verify /internal/metrics rejects anonymous scrape and accepts bearer token'
  echo 'dry-run: would verify auth verification, credential, mail dispatch, outbox lag and security alert metrics'
  exit 0
fi

require_env API_BASE_URL
require_env METRICS_BEARER_TOKEN

if ! command -v curl >/dev/null 2>&1; then
  fail 'missing required command: curl' 69
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

for path in /health /health/live /health/ready; do
  status="$(http_status "$tmp_dir/health.txt" "${API_BASE_URL}${path}")"
  case "$status" in
    2*) echo "ok: ${path} returned ${status}" ;;
    *) fail "failed smoke: ${path} returned ${status}" 1 ;;
  esac
done

unauthorized_status="$(http_status "$tmp_dir/metrics-unauthorized.txt" "${API_BASE_URL}/internal/metrics")"
case "$unauthorized_status" in
  401|403) echo "ok: anonymous metrics scrape rejected with ${unauthorized_status}" ;;
  *) fail "failed smoke: anonymous metrics scrape returned ${unauthorized_status}" 1 ;;
esac

authorized_status="$(http_status "$tmp_dir/metrics-authorized.txt" \
  -H "Authorization: Bearer ${METRICS_BEARER_TOKEN}" \
  "${API_BASE_URL}/internal/metrics")"
case "$authorized_status" in
  2*) echo "ok: authorized metrics scrape returned ${authorized_status}" ;;
  *) fail "failed smoke: authorized metrics scrape returned ${authorized_status}" 1 ;;
esac

if ! grep -q '^# HELP\|^api_' "$tmp_dir/metrics-authorized.txt"; then
  fail 'failed smoke: authorized metrics scrape did not look like Prometheus text format' 1
fi

for metric in \
  api_auth_verification_operations_total \
  api_auth_credential_transitions_total \
  api_auth_mail_dispatch_total \
  api_auth_mail_outbox_lag_seconds \
  api_auth_security_alert_active
do
  if ! grep -q "^# HELP ${metric}\\|^${metric}" "$tmp_dir/metrics-authorized.txt"; then
    fail "failed smoke: required auth metric is missing: ${metric}" 1
  fi
done

echo 'API release smoke complete'
