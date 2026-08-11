# Local rehearsal Compose profiles

이 디렉터리는 production 후보에 자동 합성되지 않는 local/constrained rehearsal 설정만 소유한다.

## Profile composition

| Profile                    | Compose order                                                      | Responsibility                                         |
| -------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| `api-base`                 | `infra/deploy/compose.api.yml`                                     | API/nginx production-neutral runtime candidate         |
| `api-rehearsal`            | `api-base` → `compose.api.runtime.yml`                             | 제품 container resource budget와 observability network |
| `api-stress`               | `api-rehearsal` → `apps/api/test/stress/docker/compose.stress.yml` | stress-only throttle와 proxy knobs                     |
| `observability-base`       | `infra/observability/compose.base.yml`                             | private observability topology base                    |
| `observability-rehearsal`  | `observability-base` → shared resources → rehearsal network        | constrained observability와 external local network     |
| `web-rehearsal`            | 관측 stack → `compose.web.yml` → `compose.web.fixture.yml`         | Web/BFF standalone rehearsal + upstream fixture        |
| `full-stack-api-rehearsal` | API base → resource budget → disposable PostgreSQL 18              | Full-stack API/nginx/DB rehearsal only                 |
| `full-stack-web-rehearsal` | 관측 stack → shared resource budget → `compose.web.yml`            | 실제 API에 연결하며 fixture를 제외한 Web rehearsal     |

`infra/compose-profiles.json`이 파일 순서의 source of truth다. 직접 `-f` 순서를 재작성하지 않고 다음 entry를 사용한다.

```bash
pnpm infra:compose -- api-base config
pnpm infra:compose -- api-rehearsal config
pnpm infra:compose -- api-stress config
pnpm infra:compose -- observability-rehearsal config
```

`up`은 profile이 요구하는 external network를 idempotent하게 생성한다. `down`은 Compose resource를 정리한 뒤 더 이상 연결된 container가 없는 managed network만 제거한다. Production/RDS endpoint를 생성·reset하지 않는다.

## 4GiB product + RDS-like local allowance rehearsal

```bash
pnpm infra:rehearsal:full-stack
```

OrbStack은 2CPU / 4608MiB로 설정한다. 4096MiB는 production App host와 같은 제품 envelope이며,
나머지 512MiB는 실제 배포에서 외부 RDS가 소유할 PostgreSQL을 로컬에만 띄우기 위한 별도
allowance다.

```bash
orbctl config set cpu 2
orbctl config set memory_mib 4608
orbctl stop
orbctl start
```

기본 실행은 같은 Docker Engine 안에서 다음 경로를 합성한다.

1. 전용 external observability network를 생성한다.
2. Disposable PostgreSQL 18을 fresh volume으로 시작한다.
3. `prisma migrate deploy`, role grant, runtime/retention/disclosure credential smoke를 실행한다.
4. API/nginx, Web/BFF, Prometheus/Loki/Alloy/Alertmanager/Grafana를 4096MiB 제품 envelope 안에서 시작한다.
5. Health, readiness, metrics guard, Web→API BFF, API log→Loki, Prometheus target을 확인한다.
6. Alloy/Loki/Prometheus/Grafana 중단 중 제품 요청의 fail-open과 recovery를 확인한다.
7. Loopback port, running image의 generated-secret 부재, stress throttle 격리를 확인한다.
8. 모든 container·volume·network를 두 번 정리해 cleanup idempotency를 확인한다.

Standalone Web rehearsal의 `web-upstream` fixture는 full-stack profile에 합성하지 않는다. Full-stack
Web은 실제 nginx/API를 사용하며, evidence의 제품 container limit 합계에는 fixture나 PostgreSQL을
포함하지 않는다.

Secret-free JSON/Markdown 결과는 기본적으로 `artifacts/local/infra/full-stack-rehearsal/`에 생성된다.
실행 중 생성한 DB password, HMAC key, metrics token은 OS 임시 디렉터리에만 두고 종료 시 삭제한다.
실행·실패 해석·cleanup 절차는
[`infra/runbooks/rehearsal/full-stack.md`](../runbooks/rehearsal/full-stack.md)를 따른다.

### External disposable DB opt-in

Local PostgreSQL 18이 필수 기본 경로다. 별도 disposable test DB를 사용하려면 다음을 모두 명시해야 한다.

- `FULL_STACK_REHEARSAL_DB_MODE=external`
- `FULL_STACK_REHEARSAL_EXTERNAL_DB_CLASSIFICATION=disposable-test`
- `FULL_STACK_REHEARSAL_EXTERNAL_DB_APPROVAL=I_ACKNOWLEDGE_DESTRUCTIVE_TEST_DB`
- migration/runtime/retention/disclosure용 `FULL_STACK_REHEARSAL_EXTERNAL_*_DATABASE_URL`

`production` 또는 `prod`로 분류된 URL은 승인 문자열과 무관하게 거부한다. External 결과는 RDS
latency/capacity evidence가 아니며 실제 production DB에 이 명령을 실행하지 않는다.
