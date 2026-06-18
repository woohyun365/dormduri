# Slack alert payload policy

Slack alert는 운영자가 바로 triage할 수 있는 최소 정보만 담는다. 로그/DB 원문을 Slack으로 복제하지 않는다.

## Allowed

- `alertname`
- `service`
- `env`
- `severity`
- bounded summary
- runbook path/link
- dashboard 확인 안내
- KST display window 안내

## Forbidden

- userId / actorId / participantId
- email / phone / nickname 원문
- threadId / messageId
- request body / response body
- token / cookie / authorization header
- raw path / raw query
- RRPD payload / disclosure payload
- stack trace 전문

## Default template

현재 Alertmanager template은 다음처럼 제한된 label만 출력한다.

```txt
[STATUS] SEVERITY service/alertname
env: local
summary: ...
runbook: ...
labels: alertname=..., service=..., severity=...
window: check Grafana/Loki in KST display timezone; raw API log ts remains UTC ISO.
```

더 자세한 조사는 Slack 메시지에 원문을 붙이지 않고 Grafana/Loki/Prometheus에서 권한 있는 운영자가 확인한다.
