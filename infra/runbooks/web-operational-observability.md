# Web 운영 관측 runbook

## 범위

Web 운영 관측은 두 개의 독립 owner로 운영한다.

- Browser/Next unexpected exception과 performance: managed Sentry
- BFF reliability: Next.js server structured stdout → `web` Docker service log → Alloy → Loki → Grafana

제품 사용 분석과 Session Replay는 다루지 않는다. 현재 Sentry 설정·privacy·source-map 경계는 [web-sentry-managed-observability.md](./web-sentry-managed-observability.md)를 따르고, 미래 배포 준비는 [web-sentry-managed-release-readiness.md](./web-sentry-managed-release-readiness.md)에서 시작한다.

## BFF production 설정

| 설정                                        | 의미                         |                     기본 |
| ------------------------------------------- | ---------------------------- | -----------------------: |
| `WEB_BFF_OPERATIONAL_LOGGING_ENABLED`       | BFF structured logging       |           production `1` |
| `WEB_BFF_SUCCESS_SAMPLE_RATE`               | success event sampling       |       `0.25`; error 100% |
| `NEXT_PUBLIC_WEB_RELEASE`                   | immutable release identifier |     commit SHA/image tag |
| `NEXT_PUBLIC_WEB_OBSERVABILITY_ENVIRONMENT` | bounded environment          | local/preview/production |

현재 repository에는 실제 Web production hosting compose가 없다. 실제 배포 환경에서는 compose service label을 `web`으로 고정하거나 Alloy의 동등한 label mapping을 먼저 구성한다.

## Release 전 확인

1. Sentry release readiness 입력이 준비되고 managed release evidence와 local rehearsal이 통과한다.
2. BFF synthetic timeout이 `outcome=timeout`과 requestId correlation으로 Loki에서 조회된다.
3. email, token, cookie, body, raw URL/query가 Sentry와 Loki 검색 결과에 없다.
4. Sentry runtime/performance kill switch를 각각 끈 뒤 사용자 navigation과 API flow가 정상이다.
5. Loki가 중단되어도 BFF 사용자 응답이 유지된다.

## OrbStack Web local constrained rehearsal

### 범위

- Docker context: `orbstack`
- Docker Engine: 2 CPU / 4096MiB(±256MiB)
- Web: production Next standalone image
- Upstream: success/invalid-response/timeout만 제공하는 local fixture
- 관측: Web stdout → Alloy → Loki → Grafana

Upstream fixture는 API contract나 RDS/API 성능을 대표하지 않는다. Managed Sentry intake, source-map upload, TLS/domain도 이 rehearsal의 범위가 아니다.

### 실행

```bash
pnpm web:sentry:rehearsal
pnpm web:observability:rehearsal
```

첫 명령은 account-free SDK/privacy/build contract를 검증하고, 두 번째 명령은 BFF log ingest와 Loki 장애 fail-open을 검증한다.

BFF runner는 다음 순서로 fail-closed 검증한다.

1. OrbStack context와 2CPU/4GB resource envelope 확인
2. compose config 검증과 production Web image build
3. Web/Loki/Grafana readiness 확인
4. BFF success, malformed upstream response, 8초 timeout 발생
5. Loki에서 `success`, `invalid_response`, `timeout`, requestId 확인
6. synthetic email/token이 log에 없는지 확인
7. Grafana dashboard UID 확인
8. Loki 중단 중 BFF success 응답 유지
9. container resource snapshot 출력
10. 전용 container/network/volume cleanup

실패 상태를 유지하려면 `WEB_REHEARSAL_KEEP=1`, evidence 파일을 남기려면 `WEB_REHEARSAL_EVIDENCE_PATH=.omx/logs/web-observability-rehearsal.json`을 사용한다.

## Grafana 조회

- dashboard UID: `knu-web-bff-reliability`

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
