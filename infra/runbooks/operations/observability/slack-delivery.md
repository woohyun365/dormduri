# Slack alert setup runbook

이 runbook은 local/staging observability stack에서 Prometheus alert를 Slack channel로 전달하기 위한 절차다.

## 1. Slack 준비

1. Slack workspace에서 alert channel을 만든다.
   - 추천: `#dormduri-alerts-test`로 smoke를 먼저 검증한다.
   - 운영 channel은 `#dormduri-alerts`처럼 분리한다.
2. https://api.slack.com/apps 에서 `돔두리 Alerts` 앱을 만든다.
3. `Incoming Webhooks`를 활성화한다.
4. `Add New Webhook to Workspace`를 눌러 target channel을 선택한다.
5. 생성된 webhook URL을 복사한다. 이 URL은 secret이다.

## 2. Secret 주입

```bash
cp infra/observability/.env.observability.example infra/observability/.env.observability
```

`.env.observability`에만 실제 값을 넣는다.

```env
SLACK_ALERTMANAGER_ENABLED=true
SLACK_ALERT_WEBHOOK_URL=<SLACK_INCOMING_WEBHOOK_URL>
SLACK_ALERT_CHANNEL=#dormduri-alerts-test
```

`.env.observability`는 git에 커밋하지 않는다.

## 3. Config 검증

```bash
cd infra/observability
docker compose --env-file .env.observability -f compose.base.yml config >/tmp/knu-observability-compose.yml
```

secret이 들어간 render 결과나 compose output을 이슈/PR에 붙이지 않는다.

## 4. Stack 실행

```bash
cd infra/observability
docker compose --env-file .env.observability -f compose.base.yml up -d alertmanager prometheus
```

확인 URL:

- Alertmanager: http://127.0.0.1:9093
- Prometheus alerts: http://127.0.0.1:9090/alerts

## 5. Slack delivery smoke

Alertmanager API에 1회성 smoke alert를 직접 넣는다. Prometheus alert route는 config로 검증하고, Slack receiver delivery는 이 smoke로 확인한다. `slack-alert-smoke.yml`의 `SlackAlertSmokeNonFiring` rule은 `vector(0) == 1`로 고정된 non-firing guard이며 Slack으로 발송되면 안 된다.

```bash
cd infra/observability
./slack/send-alertmanager-smoke.sh
```

성공 기준:

- `SLACK_ALERT_CHANNEL` channel에 `SlackAlertSmoke` 메시지가 도착한다.
- 메시지에 service/env/severity/summary/runbook만 포함된다.
- userId/email/threadId/raw payload 같은 민감 정보가 없다.

## 6. 실패 점검

- `docker compose logs alertmanager`에서 config render 또는 Slack post error를 확인한다.
- `.env.observability`의 `SLACK_ALERTMANAGER_ENABLED=true` 여부를 확인한다.
- webhook URL이 target channel에 연결된 URL인지 확인한다.
- workspace app의 Incoming Webhooks가 enabled인지 확인한다.
- Prometheus route 자체는 `prometheus.yml`의 `alerting.alertmanagers` target이 `alertmanager:9093`인지 확인한다.
