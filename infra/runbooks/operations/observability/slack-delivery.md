# Slack alert setup runbook

이 runbook은 Prometheus alert를 Slack channel로 전달하는 절차다. 운영(user host API 묶음)은 [운영 전달](#운영-전달)을, local
stack은 1~6절을 따른다. 본문 형식과 금지 값은 [payload 정책](../../../observability/slack/slack-alert-payload.md)이 소유한다.

## 운영 전달

1. Webhook URL은 Secrets Manager 관측 묶음(`/dormduri/production/observability`)의 `SLACK_ALERT_WEBHOOK_URL`에만 둔다. URL은
   secret이라 저장소·기록·이슈에 쓰지 않는다. 받는 channel은 webhook을 만들 때 고른 channel이다(앱 webhook은 payload의 channel
   값으로 바뀌지 않는다).
2. API 배포 document가 그 값을 Alertmanager UID 소유 0400 파일로 쓰고 Alertmanager가 `api_url_file`로 읽는다. 값을 바꾸면 같은
   API 묶음을 다시 배포한다(관측 단계가 파일을 다시 쓰고 Alertmanager를 다시 띄운다).
3. 시험: Owner가 Alertmanager port forwarding(`portNumber=9093`,
   [operator 접근](./production-stack.md#operator-접근))을 연 뒤 아래 smoke를 보낸다. Channel에 `SlackAlertSmoke`(info, mention
   없음)가 오면 단계 기록의 관측 줄에 받은 날짜만 적는다.

```bash
OBSERVABILITY_ENV=production ./infra/observability/slack/send-alertmanager-smoke.sh
```

4. 전달 실패는 `AlertmanagerNotificationsFailing` 경보와 [alert delivery incident](../../incidents/observability-alert-delivery.md)를
   따른다.

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
docker compose --env-file .env.observability -f compose.base.yml config >/tmp/dormduri-observability-compose.yml
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
