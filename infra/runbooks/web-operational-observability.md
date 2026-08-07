# Web 운영 관측 runbook

## 범위

이 runbook은 Web runtime error, BFF reliability, Web Vitals의 설정·조회·장애 대응·비활성화 절차를 다룬다. 제품 사용 분석과 session replay는 다루지 않는다.

## Provider 경계

- BFF: Next.js server structured stdout → `web` Docker service log → Alloy → Loki → Grafana

현재 repository에는 실제 Web production hosting compose가 없다. 따라서 host process의 `next start` 로그는 Alloy가 수집하지 않으며, 실제 배포 환경에서는 compose service label을 `web`으로 고정하거나 동등한 Loki label mapping을 먼저 구성한다. Local constrained rehearsal은 `docker-compose.web-rehearsal.yml`의 production standalone image로 동일한 service label과 ingest 경로를 검증한다.

- Browser runtime/RUM: 승인된 managed provider의 HTTPS intake
- Browser provider가 미정이면 production telemetry를 활성화하지 않는다.
- Feature 코드는 provider SDK를 직접 호출하지 않고 operational adapter만 사용한다.

## Production 설정 gate

| 설정                                              | 의미                                        | 필수 조건                                      |
| ------------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `NEXT_PUBLIC_WEB_OPERATIONAL_TELEMETRY_ENABLED=1` | browser operational delivery master switch  | 아래 gate 전부 통과                            |
| `NEXT_PUBLIC_WEB_RUNTIME_ERRORS_ENABLED`          | runtime/error boundary delivery kill switch | 기본 1                                         |
| `NEXT_PUBLIC_WEB_VITALS_ENABLED`                  | Web Vitals delivery kill switch             | 기본 1                                         |
| `NEXT_PUBLIC_WEB_TELEMETRY_ENDPOINT`              | provider HTTPS intake                       | public ingest 값만 허용                        |
| `NEXT_PUBLIC_WEB_TELEMETRY_PRIVACY_APPROVED=1`    | privacy 검토 완료 표시                      | provider/region/subprocessor/access 확인       |
| `NEXT_PUBLIC_WEB_TELEMETRY_RETENTION_DAYS`        | browser event 보존 기간                     | 1~365일                                        |
| `NEXT_PUBLIC_WEB_RELEASE`                         | immutable build/release identifier          | commit SHA 또는 image tag                      |
| `WEB_BFF_OPERATIONAL_LOGGING_ENABLED`             | BFF structured logging                      | production 기본 활성                           |
| `WEB_BFF_SUCCESS_SAMPLE_RATE`                     | success event sampling                      | 기본 0.25, error는 100%                        |
| `WEB_BROWSER_SOURCE_MAPS_ENABLED`                 | browser source map build                    | provider upload·public exposure 검토 후만 사용 |

## Release 전 확인

1. `parseWebServerEnv(..., 'production')`이 설정을 통과한다.
2. telemetry endpoint origin을 배포 환경 CSP `connect-src`에 추가한다.
3. source map은 provider artifact로 업로드하고 public artifact 노출 여부를 확인한다.
4. synthetic route error가 raw message 없이 provider에서 release/routeGroup으로 조회된다.
5. LCP, INP, CLS가 deviceClass와 routeGroup으로 조회된다.
6. BFF synthetic timeout이 `outcome=timeout`과 requestId correlation으로 Loki에서 조회된다.
7. email, token, cookie, body, raw URL/query가 provider와 Loki 검색 결과에 없는지 확인한다.
8. runtime/Web Vitals kill switch를 각각 끈 뒤 사용자 navigation과 API flow가 정상인지 확인한다.

## OrbStack Web local constrained rehearsal

### 범위

- Docker context: `orbstack`
- Docker Engine: 2 CPU / 4096MiB(±256MiB)
- Web: production Next standalone image
- Upstream: success/invalid-response/timeout만 제공하는 local fixture
- 관측: Web stdout → Alloy → Loki → Grafana

Upstream fixture는 API contract나 RDS/API 성능을 대표하지 않는다. Browser runtime/RUM managed provider, source map upload, TLS/domain도 이 rehearsal의 범위가 아니다.

### 실행

Repository root에서 실행한다.

```bash
pnpm web:observability:rehearsal
```

runner는 다음 순서로 fail-closed 검증한다.

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

실패 상태를 확인하기 위해 container를 유지하려면 다음처럼 실행한다.

```bash
WEB_REHEARSAL_KEEP=1 pnpm web:observability:rehearsal
```

성공 evidence를 파일로도 남기려면 ignored 경로를 주입한다.

```bash
WEB_REHEARSAL_EVIDENCE_PATH=.omx/logs/web-observability-rehearsal.json \
  pnpm web:observability:rehearsal
```

## Grafana 조회

- dashboard UID: `knu-web-bff-reliability`
- BFF failure log:

```logql
{service="web"} | json | eventName="web_bff_request_completed" | outcome!="success"
```

- 특정 request correlation:

```logql
{service="web"} | json | requestId="<support-correlation-id>"
```

requestId는 Loki label로 승격하지 않는다.

## Alert 기준

초기 alert는 symptom만 사용한다.

- runtime fatal error rate가 직전 안정 release 대비 유의하게 증가
- BFF `upstream_error|timeout|network|invalid_response` 비율이 5분 창에서 기준 초과
- LCP/INP/CLS p75가 최소 표본 100을 충족한 7일 창에서 기준 초과

초기 traffic이 낮으면 고정 비율 pager보다 dashboard warning으로 시작한다. Provider/Grafana alert rule의 실제 threshold는 rehearsal baseline을 남긴 뒤 확정한다.

Local/staging BFF warning은 Loki ruler의 `WebBffFailureRateHigh`가 5분 오류 비율 10%, 전체 0.1 req/s 이상 상태를 10분간 확인한다. 이 값은 초기 rehearsal 기준이며 실제 traffic baseline 이후 조정한다.

## Incident 대응

1. release와 routeGroup/operation 범위를 좁힌다.
2. BFF failure면 requestId로 Web/API log correlation을 확인한다.
3. provider 자체 장애면 browser kill switch를 적용하고 사용자 기능이 정상인지 확인한다.
4. 새로운 release에서만 증가하면 rollback 기준을 검토한다.
5. raw 개인정보가 발견되면 intake를 즉시 끄고 접근·보존·삭제 절차를 incident로 실행한다.

## Provider 교체·비활성화

- 교체: 새 adapter smoke → privacy/CSP/source map 검증 → endpoint 전환 → 구 provider retention/delete 확인
- 긴급 비활성화: runtime과 Web Vitals switch를 0으로 배포
- BFF logging은 관측 최소 기준이므로 provider 장애만으로 끄지 않는다.
