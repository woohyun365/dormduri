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

## Template

`alertmanager/templates/slack.tmpl`이 본문을 만들고 운영 설정(`alertmanager.production.yml`)과 local render 설정이 같은 template을
쓴다.

```txt
[STATUS] severity service/alertname
<!channel>                       ← critical firing에만
• env: production
• summary: <rule의 고정 문구>
• runbook: <저장소 경로>
• labels: alertname=..., service=..., severity=...
• window: Grafana·Loki는 KST로 표시한다. API log `ts`는 UTC ISO다.
```

- label은 닫힌 값만 출력한다. `alertname`은 대문자로 시작하는 영숫자, `severity`는 `critical|warning|info`, `service`는
  `api|web|ingress|host|observability`, `env`는 `production|local|ci|test`이고 그 밖의 값은 `redacted`(env는 `unknown`)다.
- annotation은 `summary`와 `runbook`만 출력한다. rule 파일의 두 값은 template 치환이 없는 고정 문구다(API 경보 contract test).
  `runbook`이 저장소 경로 형식이 아니면 `infra/observability/README.md`로 바꾼다.
- Slack `fallback`(알림 미리보기)은 title과 같고 `title_link`는 비운다. Alertmanager 기본값은 공통 label 값을 모두 출력하기 때문이다.

## 검증

`pnpm infra:check:runtime`이 관측 설정 image에서 꺼낸 운영 설정으로 실제 Alertmanager를 띄워 capture server가 받은 Slack body를
판정한다(`scripts/observability/production/alertmanager-render.mjs`). 입력 alert의 label·annotation 이름은 DB 열 분류
(`packages/database/prisma/role-grants/column-classes.csv`)의 secret·content·identifier 열 이름이고 값은 표지 문자열이다. 닫힌
label 자리에는 email·IP·token 모양의 값을 넣는다. 그 값들이 body 어디에도 없고, critical firing에만 `<!channel>`이 있어야 통과한다.

더 자세한 조사는 Slack 메시지에 원문을 붙이지 않고 Grafana/Loki/Prometheus에서 권한 있는 운영자가 확인한다.
