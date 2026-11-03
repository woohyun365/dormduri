# Local rehearsal Compose profiles

이 디렉터리는 local/constrained rehearsal 설정을 소유한다. Web 단계 host는 운영 compose
`infra/deploy/user/compose.yml`을 그대로 쓰고 `compose.user-host.yml`로 local 값만 덮는다([User host rehearsal](#user-host-rehearsal)).
`compose.web.yml`은 full-stack rehearsal의 Web service다([`compose.web.yml`](#composewebyml)).

OrbStack과 독립 Linux VM의 선택, profile별 자원 및 증거 경계는
[Local environment selector](../runbooks/rehearsal/local-environments.md)를 먼저 확인한다.

Lightsail secret delivery의 AWS-account-free candidate/activation/rollback fault matrix는
[`lightsail-secret-delivery.md`](../runbooks/rehearsal/lightsail-secret-delivery.md)와
`pnpm infra:rehearsal:lightsail-secrets`가 소유한다. Raw bundle은 rehearsal artifact로 보존하지 않는다.

## Profile composition

| Profile                    | 분류                 | Compose order                                                       | Responsibility                                                                                                   |
| -------------------------- | -------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `api-base`                 | production-candidate | `infra/deploy/compose.api.yml`                                      | API/nginx production-neutral runtime candidate                                                                   |
| `api-rehearsal`            | rehearsal-only       | `api-base` → `compose.api.runtime.yml`                              | 제품 container resource budget와 observability network                                                           |
| `api-stress`               | stress-only          | `api-rehearsal` → `apps/api/test/stress/docker/compose.stress.yml`  | stress-only throttle와 proxy knobs                                                                               |
| `api-stress-standalone`    | stress-only          | `api-base` → `apps/api/test/stress/docker/compose.stress.yml`       | 관측 stack과 resource budget 없이 실행하는 production-like stress smoke                                          |
| `observability-base`       | runtime-base         | `infra/observability/compose.base.yml` → shared resources           | private observability topology base                                                                              |
| `observability-production` | production-candidate | `observability-base` → `infra/observability/compose.production.yml` | Production 관측 stack 후보([production stack runbook](../runbooks/operations/observability/production-stack.md)) |
| `observability-rehearsal`  | rehearsal-only       | `observability-base` → rehearsal network                            | constrained observability와 external local network                                                               |
| `full-stack-api-rehearsal` | rehearsal-only       | `api-rehearsal` → `compose.postgres.yml`(disposable PostgreSQL 18)  | Full-stack API/nginx/DB rehearsal only                                                                           |
| `full-stack-web-rehearsal` | rehearsal-only       | `observability-rehearsal` → `compose.web.yml`                       | 실제 API에 연결한 Web rehearsal                                                                                  |
| `user-host`                | production-candidate | `infra/deploy/user/compose.yml`                                     | Web 단계 User App host(ingress·Web) 운영 compose                                                                 |
| `user-host-rehearsal`      | rehearsal-only       | `user-host` → `compose.user-host.yml`                               | 운영 compose에 local build image·시험 인증서·loopback port만 덮은 rehearsal                                      |

`infra/compose-profiles.json`이 파일 순서의 source of truth다. 직접 `-f` 순서를 재작성하지 않고 다음 entry를 사용한다.

```bash
pnpm infra:compose -- api-base config
pnpm infra:compose -- api-rehearsal config
pnpm infra:compose -- api-stress config
pnpm infra:compose -- observability-rehearsal config
```

`up`은 profile이 요구하는 external network를 idempotent하게 생성한다. `down`은 Compose resource를 정리한 뒤 더 이상 연결된 container가 없는 managed network만 제거한다. Production/RDS endpoint를 생성·reset하지 않는다.

### `compose.web.yml`

`compose.web.yml`은 Web service 하나를 정의하고 `full-stack-web-rehearsal`이 `observability-rehearsal` 뒤에 합성해 실제
API에 연결한 local Web/BFF rehearsal을 돌린다. Local 가정(local image 이름, `web.local.invalid` origin, loopback publish, 관측
network)은 rehearsal의 것이다. Web 단계 host의 운영 compose는 `infra/deploy/user/compose.yml`이고, 그 local rehearsal은
이 파일이 아니라 `user-host-rehearsal`이다.

## User host rehearsal

운영 compose를 원본으로 쓰고 다음만 덮는다(`pnpm infra:check:static`이 두 render를 비교해 이 밖의 차이를 거부한다):
image(저장소에서 local build, 이름은 `user-host.rehearsal.env`), host 경로
(`/opt/dormduri/...` 대신 `USER_HOST_REHEARSAL_ROOT` 아래 폴더), publish port(80·443 대신 loopback 8180·8543).

```bash
root="$PWD/.artifacts/tools/infra/user-host-rehearsal"
mkdir -p "$root"/{acme-webroot,tls,mode}
# 시험용 자체 서명 인증서. ingress는 uid 101로 돌므로 시험 key만 0644로 둔다.
openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=dormduri.com \
  -addext subjectAltName=DNS:dormduri.com,DNS:www.dormduri.com \
  -keyout "$root/tls/privkey.pem" -out "$root/tls/fullchain.pem"
chmod 644 "$root/tls/privkey.pem"
export USER_HOST_REHEARSAL_ROOT="$root"
pnpm infra:compose -- user-host-rehearsal up -d --build --wait
curl -sk --resolve dormduri.com:8543:127.0.0.1 -o /dev/null -w '%{http_code}\n' https://dormduri.com:8543/
touch "$root/mode/maintenance"   # 점검 mode: 모든 경로 503 점검 중
rm "$root/mode/maintenance"
pnpm infra:compose -- user-host-rehearsal down
```

경로별 응답 전체는 `node scripts/infra/user-host/ingress-smoke.mjs --web-image=dormduri-web:user-host-rehearsal`이 실제
요청으로 확인한다(경로 표는 [User host 묶음](../deploy/README.md#user-host-묶음)).

## 4GiB product + RDS-like local allowance rehearsal

```bash
pnpm infra:rehearsal:full-stack
```

OrbStack은 2CPU / 4608MiB로 설정한다. 4096MiB는 production App host와 같은 제품 envelope이며,
나머지 512MiB는 실제 배포에서 외부 RDS가 소유할 PostgreSQL을 로컬에만 띄우기 위한 별도
allowance다.

아래 전역 설정·재시작은 승인된 변경에만 사용한다. 현재 값을 먼저 확인하며 매 실행마다 자동 변경하지 않는다.
별도 auth-capacity의 strict 4096MiB profile과 합치거나 미래 BackOffice 자원을 더하지 않는다.

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
8. 모든 container·volume·network를 두 번 정리해 cleanup idempotency를 확인하고, 그 실행이 build한 API·Web image 둘을 지운다.

Full-stack Web은 실제 nginx/API를 사용하며, evidence의 제품 container limit 합계에는 PostgreSQL을 포함하지 않는다.

Secret-free JSON/Markdown 결과는 기본적으로 `.artifacts/tools/infra/full-stack-rehearsal/`에 생성된다.
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

## Forwarded-client identity 검증 경계

기존 DB-backed full-stack은 **no-forwarding-trust functional fixture**다. 생성 runtime 입력은
`HTTP_TRUST_PROXY_HOPS=0`, 빈 `HTTP_TRUST_PROXY_CIDRS`, `CHAT_REALTIME_TRUST_PROXY=false`를 사용한다.
기존 PostgreSQL/DB role, workload, resource budget, direct loopback Web smoke, observability network와
`WEB_REHEARSAL_API_URL=http://nginx`는 이 local functional fixture의 계약으로 유지한다. 여기서 통과한
시나리오는 distinct client IP abuse/capacity나 production ingress trust의 증거가 아니다.

Forwarding trust를 켠 ingress는 API 단계가 user host ingress에 private BFF 경로를 더할 때 그 검사와 함께 만든다
([User public ingress와 BFF trust](../../docs/architecture/platform/production-runtime-topology.md#user-public-ingress와-bff-trust)).
