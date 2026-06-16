#!/bin/sh
set -eu

: "${API_METRICS_SCHEME:=http}"
: "${API_METRICS_TARGET:=host.docker.internal:4000}"
: "${PROMETHEUS_RETENTION:=15d}"
: "${OBSERVABILITY_ENV:=local}"

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
