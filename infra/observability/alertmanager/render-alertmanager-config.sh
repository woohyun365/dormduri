#!/bin/sh
set -eu

CONFIG_DIR=${ALERTMANAGER_CONFIG_DIR:-/etc/alertmanager}
RENDER_DIR=${ALERTMANAGER_RENDER_DIR:-/tmp/alertmanager}
RENDERED_CONFIG=${ALERTMANAGER_RENDERED_CONFIG:-$RENDER_DIR/alertmanager.yml}
ENABLED=${SLACK_ALERTMANAGER_ENABLED:-false}
WEBHOOK_URL=${SLACK_ALERT_WEBHOOK_URL:-}
CHANNEL=${SLACK_ALERT_CHANNEL:-#dormduri-alerts}
OBS_ENV=${OBSERVABILITY_ENV:-local}
STRICT=${OBSERVABILITY_STRICT:-false}
RETENTION=${ALERTMANAGER_RETENTION:-120h}

is_placeholder_url() {
  case "$1" in
    ''|*REPLACE_ME*|*example.invalid*) return 0 ;;
    *) return 1 ;;
  esac
}

escape_sed_replacement() {
  printf '%s' "$1" | sed -e 's/[&|]/\\&/g'
}

mkdir -p "$RENDER_DIR"

if [ "$STRICT" = 'true' ]; then
  if [ "$OBS_ENV" != 'production' ]; then
    echo 'Production Alertmanager requires OBSERVABILITY_ENV=production.' >&2
    exit 1
  fi
  if [ "$ENABLED" = 'true' ] && is_placeholder_url "$WEBHOOK_URL"; then
    echo 'Slack delivery is enabled but the webhook URL is missing or placeholder.' >&2
    exit 1
  fi
fi

if [ "$ENABLED" = "true" ] && ! is_placeholder_url "$WEBHOOK_URL"; then
  TEMPLATE=$CONFIG_DIR/alertmanager.yml.template
else
  TEMPLATE=$CONFIG_DIR/alertmanager.noop.yml.template
fi

sed \
  -e "s|__SLACK_ALERT_WEBHOOK_URL__|$(escape_sed_replacement "$WEBHOOK_URL")|g" \
  -e "s|__SLACK_ALERT_CHANNEL__|$(escape_sed_replacement "$CHANNEL")|g" \
  -e "s|__OBSERVABILITY_ENV__|$(escape_sed_replacement "$OBS_ENV")|g" \
  "$TEMPLATE" > "$RENDERED_CONFIG"

if [ "${ALERTMANAGER_RENDER_ONLY:-false}" = "true" ]; then
  printf '%s\n' "$RENDERED_CONFIG"
  exit 0
fi

exec /bin/alertmanager \
  --config.file="$RENDERED_CONFIG" \
  --storage.path=/alertmanager \
  --data.retention="$RETENTION" \
  --web.listen-address=0.0.0.0:9093
