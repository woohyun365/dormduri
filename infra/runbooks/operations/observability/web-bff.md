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

- Sentry SDK·privacy·sampling·upload-disabled build의 account-free 검사는 Web CI가 Web lane PR마다 돈다(unit gate의 Sentry·
  operational·Web Vitals test, static/build gate의 `pnpm web:sentry:verify-build`). Storybook 산출물의 Sentry 설정은 자동 검사가
  없다([Sentry runbook](./browser-sentry.md#account-free-구현-검증)).
- 관측 component(Alloy·Loki·Prometheus·Grafana) 장애 중 API `/health`와 Web root 응답 유지는 full-stack rehearsal
  (`pnpm infra:rehearsal:full-stack`)이 확인한다.
- BFF log ingest(Web stdout → Alloy → Loki), Loki 검색 결과의 개인정보 부재, Loki 장애 중 BFF 경로 응답 유지는 지금 자동 검사가
  없다. Web 단계 ingress는 `/api`를 열지 않는다. API 단계가 BFF를 열 때 full-stack rehearsal에 이 확인을 더한다. 그 전에는 위
  'Release 전 확인' 2번, 3번의 Loki 부분, 5번을 증거 없는 항목으로 둔다.
- Grafana dashboard `dormduri-web-bff-reliability`는 file과 provisioning 설정의 단언(API `observability-stack.spec.ts`)만 있다. 실제
  Grafana에서 그 UID를 조회하는 검사는 없다(full-stack은 Grafana `/api/health`만 본다).

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
