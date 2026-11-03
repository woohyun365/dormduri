# Web 운영 관측 runbook

## 범위

Web 운영 관측은 두 개의 독립 owner로 운영한다.

- Browser/Next unexpected exception과 performance: managed Sentry
- BFF reliability: Next.js server structured stdout → `web` Docker service log → Alloy → Loki → Grafana

제품 사용 분석과 Session Replay는 다루지 않는다. 현재 Sentry 설정·privacy·source-map 경계는 [web-sentry-managed-observability.md](./browser-sentry.md)를 따르고, 미래 배포 준비는 [web-sentry-managed-release-readiness.md](../../release/components/web-sentry/readiness.md)에서 시작한다.

## BFF production 설정

| 설정                                        | 의미                         |                     기본 |
| ------------------------------------------- | ---------------------------- | -----------------------: |
| `WEB_BFF_OPERATIONAL_LOGGING_ENABLED`       | BFF structured logging       |           production `1` |
| `WEB_BFF_SUCCESS_SAMPLE_RATE`               | success event sampling       |       `0.25`; error 100% |
| `NEXT_PUBLIC_WEB_RELEASE`                   | immutable release identifier |     commit SHA/image tag |
| `NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT` | bounded environment          | local/preview/production |

Web 단계 host compose(`infra/deploy/user/compose.yml`)의 Web service 이름은 `web`이다. 관측 stack을 붙일 때 Alloy가 이 이름을 `service` label로 받는지 먼저 확인한다(지금 Web 단계에는 관측 stack이 없다).

## Release 전 확인

1. Sentry release readiness 입력이 준비되고 managed release evidence와 Web CI의 account-free Sentry 검사가 통과한다.
2. BFF synthetic timeout이 `outcome=timeout`과 requestId correlation으로 Loki에서 조회된다.
3. email, token, cookie, body, raw URL/query가 Sentry와 Loki 검색 결과에 없다.
4. Sentry runtime/performance kill switch를 각각 끈 뒤 사용자 navigation과 API flow가 정상이다.
5. Loki가 중단되어도 BFF 사용자 응답이 유지된다.

## Local 확인

- Sentry SDK·privacy·sampling·upload-disabled build의 account-free 검사는 Web CI가 PR마다 돈다(unit gate의 Sentry·operational·
  Web Vitals test, static/build gate의 `pnpm web:sentry:verify-build`와 Storybook build).
- BFF log ingest(Web stdout → Alloy → Loki)와 Loki 장애 중 BFF 응답 유지는 지금 자동 검사가 없다. Web 단계 ingress는 `/api`를
  열지 않는다. API 단계가 BFF를 열 때 실제 API와 연결하는 full-stack rehearsal(`pnpm infra:rehearsal:full-stack`)에 이 확인을
  더한다. 그 전에는 위 'Release 전 확인' 2·5번을 증거 없는 항목으로 둔다.

## Grafana 조회

- dashboard UID: `dormduri-web-bff-reliability`

```logql
{service="web"} | json | eventName="web_bff_request_completed" | outcome!="success"
```

```logql
{service="web"} | json | requestId="<support-correlation-id>"
```

requestId는 Loki label로 승격하지 않는다.

## Alert와 incident

- BFF `upstream_error|timeout|network|invalid_response` 비율 증가
- Sentry runtime fatal error가 직전 안정 release 대비 증가
- LCP/INP/CLS p75가 최소 표본 100의 7일 창에서 기준 초과

초기 traffic이 낮으면 pager보다 dashboard warning으로 시작한다. 장애 대응 시 release와 routeGroup/operation 범위를 좁히고, BFF는 requestId correlation을 확인한다. 관측 provider 장애만으로 BFF logging을 끄지 않는다.
