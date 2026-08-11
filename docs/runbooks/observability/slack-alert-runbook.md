# Slack alert troubleshooting runbook

## 목적

Prometheus alert가 Alertmanager를 거쳐 Slack channel로 도착하지 않을 때의 점검 순서다. Slack webhook URL은 secret이며 이 문서나 이슈/PR에 붙이지 않는다.

## 빠른 점검 순서

1. `infra/observability/.env.observability`에 다음 값이 있는지 확인한다.
   - `SLACK_ALERTMANAGER_ENABLED=true`
   - `SLACK_ALERT_WEBHOOK_URL` set
   - `SLACK_ALERT_CHANNEL` set
2. Alertmanager가 떠 있는지 확인한다.

```bash
cd infra/observability
docker compose --env-file .env.observability -f compose.base.yml ps alertmanager
```

3. Alertmanager log를 확인한다.

```bash
docker compose --env-file .env.observability -f compose.base.yml logs --tail=100 alertmanager
```

4. smoke alert를 1회 재전송한다. Prometheus의 `SlackAlertSmokeNonFiring` non-firing guard가 firing되면 `expr: vector(0) == 1` 유지 여부와 Prometheus reload 상태를 확인한다.

```bash
./slack/send-alertmanager-smoke.sh
```

5. Prometheus가 Alertmanager target을 알고 있는지 확인한다.

```bash
curl -fsS http://127.0.0.1:9090/api/v1/alertmanagers
```

## Slack 쪽 점검

- Incoming Webhook이 target channel에 설치되어 있는지 확인한다.
- Slack app의 Incoming Webhooks가 enabled인지 확인한다.
- channel rename이 있었으면 webhook channel binding을 다시 확인한다.
- test channel과 운영 channel을 혼동하지 않았는지 확인한다.

## Payload privacy

Slack 메시지에는 userId, email, threadId, raw request body, RRPD payload를 넣지 않는다. 자세한 분석은 Grafana/Loki/Prometheus에서 수행한다.
