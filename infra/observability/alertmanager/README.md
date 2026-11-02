# Alertmanager configuration

이 디렉터리는 Prometheus alert를 Alertmanager로 받아 Slack Incoming Webhook으로 전달하는 설정을 소유한다.
API application code는 Slack bot token이나 webhook secret을 직접 보유하지 않는다.

## Files

| File                             | Purpose                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `render-alertmanager-config.sh`  | `.env.observability` 값을 읽어 runtime config를 `/tmp/alertmanager/alertmanager.yml`로 렌더링한 뒤 Alertmanager를 실행한다. |
| `alertmanager.yml.template`      | Slack receiver가 활성화된 실제 delivery template.                                                                           |
| `alertmanager.noop.yml.template` | webhook이 없거나 `SLACK_ALERTMANAGER_ENABLED=false`일 때 쓰는 no-op receiver config.                                        |
| `alertmanager.yml.example`       | secret 없는 committed example. 실제 webhook URL을 넣지 않는다.                                                              |
| `templates/slack.tmpl`           | Slack message title/body template.                                                                                          |

## Secret policy

- 실제 webhook URL은 `infra/observability/.env.observability`에만 둔다.
- `.env.observability`는 git ignore 대상이다.
- `alertmanager.yml.example`과 `.env.observability.example`에는 실제 webhook URL을 넣지 않는다.
- Slack payload에는 userId, email, threadId, messageId, raw request body, RRPD payload를 포함하지 않는다.

## Local delivery enablement

```env
SLACK_ALERTMANAGER_ENABLED=true
SLACK_ALERT_WEBHOOK_URL=<SLACK_INCOMING_WEBHOOK_URL>
SLACK_ALERT_CHANNEL=#dormduri-alerts-test
```

webhook이 없거나 disabled이면 Alertmanager는 no-op receiver로 기동한다. 이 상태에서도 Prometheus → Alertmanager route와 config validation은 가능하지만 Slack delivery evidence는 남길 수 없다.
