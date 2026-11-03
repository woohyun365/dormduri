#!/bin/sh
set -eu

ALERTMANAGER_URL=${ALERTMANAGER_URL:-http://127.0.0.1:${ALERTMANAGER_PORT:-9093}}
OBS_ENV=${OBSERVABILITY_ENV:-local}
NOW=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

curl -fsS -X POST "$ALERTMANAGER_URL/api/v2/alerts" \
  -H 'Content-Type: application/json' \
  --data-binary @- <<JSON
[
  {
    "labels": {
      "alertname": "SlackAlertSmoke",
      "service": "api",
      "severity": "info",
      "env": "$OBS_ENV"
    },
    "annotations": {
      "summary": "돔두리 Alertmanager Slack delivery smoke test",
      "runbook": "infra/runbooks/operations/observability/slack-delivery.md"
    },
    "startsAt": "$NOW"
  }
]
JSON
printf '\nSlack smoke alert posted to %s\n' "$ALERTMANAGER_URL"
