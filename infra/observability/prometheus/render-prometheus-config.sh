#!/bin/sh
set -eu

: "${API_METRICS_SCHEME:=http}"
: "${API_METRICS_TARGET:=host.docker.internal:4000}"
: "${PROMETHEUS_RETENTION:=15d}"
: "${OBSERVABILITY_ENV:=local}"
: "${OBSERVABILITY_STRICT:=false}"

if [ "$OBSERVABILITY_STRICT" = 'true' ]; then
  if [ "$OBSERVABILITY_ENV" != 'production' ]; then
    echo 'Production Prometheus requires OBSERVABILITY_ENV=production.' >&2
    exit 1
  fi
  case "$API_METRICS_TARGET" in
    localhost:*|127.0.0.1:*|host.docker.internal:*)
      echo 'Production Prometheus requires a private container or target-network API address.' >&2
      exit 1
      ;;
  esac
  if [ ! -s /etc/prometheus/secrets/api-metrics-bearer-token ]; then
    echo 'Production Prometheus requires a non-empty metrics bearer token file.' >&2
    exit 1
  fi
fi

sed \
  -e "s|__API_METRICS_SCHEME__|${API_METRICS_SCHEME}|g" \
  -e "s|__API_METRICS_TARGET__|${API_METRICS_TARGET}|g" \
  -e "s|__OBSERVABILITY_ENV__|${OBSERVABILITY_ENV}|g" \
  /etc/prometheus/prometheus.yml.template > /tmp/prometheus.yml

exec /bin/prometheus \
  --config.file=/tmp/prometheus.yml \
  --storage.tsdb.path=/prometheus \
  --storage.tsdb.retention.time="${PROMETHEUS_RETENTION}" \
  --web.enable-lifecycle \
  --web.listen-address=0.0.0.0:9090
