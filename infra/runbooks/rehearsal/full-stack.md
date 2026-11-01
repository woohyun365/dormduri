# Full-stack local infrastructure rehearsal

이 runbook은 2CPU/4608MiB로 제한한 동일 Docker Engine에서 Web/BFF, API/nginx, disposable
PostgreSQL 18, Prometheus/Loki/Alloy/Alertmanager/Grafana의 연결과 장애 격리를 확인한다. 이 중
4096MiB는 production App host와 같은 제품 envelope이고 PostgreSQL 512MiB는 실제 배포의 외부
RDS 경계를 흉내 내기 위한 로컬 전용 allowance다. 로컬
결과는 회귀와 배포 준비도를 높이지만 실제 hosting target, RDS, DNS/TLS, provider 계정의
release evidence를 대체하지 않는다.

## 기본 실행

실행 전 [환경 selector](./local-environments.md)에서 runner 제약과 profile을 확인한다.
이 runbook의 4608MiB full-stack과 auth-capacity의 strict 4096MiB는 다른 실험이다.

```bash
pnpm infra:rehearsal:full-stack
```

기본 경로는 OrbStack Docker context가 2CPU와 4608MiB(허용 오차 ±256MiB)로 제한되어 있어야
한다.

다음 명령은 승인된 전역 설정 변경 예시다. 현재 설정을 먼저 확인하고 기존 workload를 임의로 재시작하지 않는다.

```bash
orbctl config set cpu 2
orbctl config set memory_mib 4608
orbctl stop
orbctl start
```

실행기는 빈 volume에 PostgreSQL 18을 시작하고 다음 순서로 검증한다.

1. Prisma migration baseline을 `migrate deploy`로 적용한다.
2. migration/runtime/retention/disclosure credential과 DB grant 경계를 검사한다.
3. API/nginx와 Web/BFF의 readiness 및 Web→API 요청을 검사한다.
4. metrics 인증, Prometheus scrape, API stdout의 Alloy→Loki 수집을 검사한다.
5. Alloy, Loki, Prometheus, Grafana를 하나씩 중단해도 제품 요청이 유지되는지 확인한다.
6. 게시 port가 loopback 전용인지, API/Web filesystem에 실행 중 생성한 secret이 없는지 확인한다.
7. Compose project를 `down --volumes --remove-orphans`로 두 번 정리하고, 그 실행이 build한 두 image
   (`dormduri-api:full-stack-<run-id>`, `dormduri-web:full-stack-<run-id>`)만 지운다. Image 삭제 결과는 evidence
   `cleanup.images`에 남고, 삭제 실패는 실행 결과를 바꾸지 않는다.

## Resource budget

| 구분                       | Limit 합계 | 계산 책임                                                                                             |
| -------------------------- | ---------: | ----------------------------------------------------------------------------------------------------- |
| 현재 제품 container        |    2976MiB | nginx 96 + Web 320 + API 1408 + Prometheus 256 + Loki 320 + Alloy 160 + Alertmanager 96 + Grafana 320 |
| Local PostgreSQL allowance |     512MiB | RDS-like local fixture; 제품 4GiB budget에서 제외                                                     |
| Docker engine target       |    4608MiB | 제품 4096MiB + local DB 512MiB                                                                        |

제품 limit 합계와 local DB limit을 제외한 나머지는 OS/Docker/filesystem cache와 순간적인 process
증가를 위한 engine headroom이다. Standalone Web용 `web-upstream` fixture는 full-stack profile에서
제외하고 실제 nginx/API 연결을 사용한다. 미래 BackOffice는 별도 2GiB host가 목표이므로 이
4GiB User App rehearsal에 합성하지 않는다.

결과는 `.artifacts/tools/infra/full-stack-rehearsal/<run-id>.{json,md}`에 저장한다. evidence에는
secret과 DB URL을 기록하지 않는다. 임시 password, HMAC key, metrics token은 OS 임시
디렉터리에 mode `0600`으로 생성하고 종료 시 제거한다.

## 실패 해석

- `engine-resource-envelope`: 로컬 Docker resource envelope가 기준과 다르다.
- `product-resource-budget`: 제품 limit 또는 RDS-like local DB allowance가 기준과 다르다.
- `full-stack-fixture-exclusion`: standalone Web upstream fixture가 full-stack에 섞였다.
- `fresh-migration-deploy`: fresh PostgreSQL 18에서 migration baseline을 적용하지 못했다.
- `database-credential-boundary`: DB role/grant 또는 credential 분리가 맞지 않는다.
- `web-api-bridge`: Web BFF가 nginx를 통해 API에 도달하지 못했다.
- `prometheus-api-target`, `api-log-loki-ingest`: metric 또는 log 수집 경로가 끊겼다.
- `observability-*-fail-open`: 관측 component 장애가 제품 요청에 영향을 주거나 복구되지 않았다.
- `runtime-artifact-secret-scan`: 실행 중 생성한 secret이 container filesystem에 포함됐다.
- `cleanup-idempotency`: 두 번째 cleanup 후에도 project container 또는 volume이 남았다.
- `rehearsal-blocker`의 `FULL_STACK_REHEARSAL_SKIP_BUILD=1 reuses only …`: 재사용할 image가 없다(아래 종료 확인).

실패해도 실행기는 가능한 범위에서 cleanup과 secret-free evidence 작성을 시도한다. 실패 원인은
evidence의 `blocker`와 scenario result를 기준으로 수정하고 같은 명령을 다시 실행한다.

## External disposable DB opt-in

Local PostgreSQL 18이 기본이며 권장 경로다. 별도 disposable test DB가 필요한 경우에만 다음을
모두 제공한다.

- `FULL_STACK_REHEARSAL_DB_MODE=external`
- `FULL_STACK_REHEARSAL_EXTERNAL_DB_CLASSIFICATION=disposable-test`
- `FULL_STACK_REHEARSAL_EXTERNAL_DB_APPROVAL=I_ACKNOWLEDGE_DESTRUCTIVE_TEST_DB`
- migration/runtime/retention/disclosure용 `FULL_STACK_REHEARSAL_EXTERNAL_*_DATABASE_URL`

URL에 `prod` 또는 `production`이 포함되면 실행을 거부한다. 이 opt-in은 disposable test DB에
대해서만 migration과 grant를 실행하며 실제 production/RDS 대상으로 사용하지 않는다.

## 종료 확인

정상 실행은 container와 disposable volume, 그 실행의 두 image를 자동 제거한다. 진단 목적으로 resource를
유지하려면 `FULL_STACK_REHEARSAL_KEEP=1`을 사용할 수 있지만, 확인 뒤 동일 run id의 Compose project와 image를
정리해야 한다. 이때 image 이름은 evidence `cleanup.images.kept`에 남는다. 같은 image로 다시 확인하려면 같은
`FULL_STACK_REHEARSAL_RUN_ID`와 `FULL_STACK_REHEARSAL_SKIP_BUILD=1`로 실행한다. 그 실행이 keep-running이 아니면 끝날 때
project와 image를 정리한다. 앞 실행이 keep-running이 아니어서 image가 없으면 build 없이 실패하고 다른 image를 지우지
않는다. 남은 자원 확인은 [로컬 환경 runbook](./local-environments.md#로컬-docker-자원-label과-확인)을 따른다. 일반 완료
evidence는 자동 cleanup 두 번이 모두 통과한 실행만 인정한다.
