# Local rehearsal Compose profiles

이 디렉터리는 local/constrained rehearsal 설정을 소유한다. 예외는 `compose.web.yml` 하나다. 이 파일은 rehearsal profile과
production-candidate profile `ingress-trust`에 함께 합성된다([`compose.web.yml`의 두 역할](#composewebyml의-두-역할)).

OrbStack과 독립 Linux VM의 선택, profile별 자원 및 증거 경계는
[Local environment selector](../runbooks/rehearsal/local-environments.md)를 먼저 확인한다.

Lightsail secret delivery의 AWS-account-free candidate/activation/rollback fault matrix는
[`lightsail-secret-delivery.md`](../runbooks/rehearsal/lightsail-secret-delivery.md)와
`pnpm infra:rehearsal:lightsail-secrets`가 소유한다. Raw bundle은 rehearsal artifact로 보존하지 않는다.

## Profile composition

| Profile                    | 분류                 | Compose order                                                             | Responsibility                                                                                                   |
| -------------------------- | -------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `api-base`                 | production-candidate | `infra/deploy/compose.api.yml`                                            | API/nginx production-neutral runtime candidate                                                                   |
| `api-rehearsal`            | rehearsal-only       | `api-base` → `compose.api.runtime.yml`                                    | 제품 container resource budget와 observability network                                                           |
| `api-stress`               | stress-only          | `api-rehearsal` → `apps/api/test/stress/docker/compose.stress.yml`        | stress-only throttle와 proxy knobs                                                                               |
| `api-stress-standalone`    | stress-only          | `api-base` → `apps/api/test/stress/docker/compose.stress.yml`             | 관측 stack과 resource budget 없이 실행하는 production-like stress smoke                                          |
| `observability-base`       | runtime-base         | `infra/observability/compose.base.yml` → shared resources                 | private observability topology base                                                                              |
| `observability-production` | production-candidate | `observability-base` → `infra/observability/compose.production.yml`       | Production 관측 stack 후보([production stack runbook](../runbooks/operations/observability/production-stack.md)) |
| `observability-rehearsal`  | rehearsal-only       | `observability-base` → rehearsal network                                  | constrained observability와 external local network                                                               |
| `web-rehearsal`            | rehearsal-only       | 관측 stack → `compose.web.yml` → `compose.web.fixture.yml`                | Web/BFF standalone rehearsal + upstream fixture                                                                  |
| `full-stack-api-rehearsal` | rehearsal-only       | API base → resource budget → disposable PostgreSQL 18                     | Full-stack API/nginx/DB rehearsal only                                                                           |
| `full-stack-web-rehearsal` | rehearsal-only       | 관측 stack → shared resource budget → `compose.web.yml`                   | 실제 API에 연결하며 fixture를 제외한 Web rehearsal                                                               |
| `ingress-trust`            | production-candidate | `api-base` → `compose.web.yml` → `infra/deploy/compose.ingress-trust.yml` | Single public ingress forwarding trust 검증 대상                                                                 |

`infra/compose-profiles.json`이 파일 순서의 source of truth다. 직접 `-f` 순서를 재작성하지 않고 다음 entry를 사용한다.

```bash
pnpm infra:compose -- api-base config
pnpm infra:compose -- api-rehearsal config
pnpm infra:compose -- api-stress config
pnpm infra:compose -- observability-rehearsal config
```

`up`은 profile이 요구하는 external network를 idempotent하게 생성한다. `down`은 Compose resource를 정리한 뒤 더 이상 연결된 container가 없는 managed network만 제거한다. Production/RDS endpoint를 생성·reset하지 않는다.

### `compose.web.yml`의 두 역할

`compose.web.yml`은 Web service 하나를 정의하고 두 곳에 쓰인다.

- Rehearsal: `web-rehearsal`·`full-stack-web-rehearsal`이 관측 stack 뒤에 합성해 local Web/BFF standalone rehearsal을
  돌린다. Local 가정(local image 이름, `web.local.invalid` origin, loopback publish, 관측 network)은 이 역할의 것이다.
- Production candidate: `ingress-trust`가 `compose.api.yml` 다음에 이 Web service를 그대로 쓰고,
  `infra/deploy/compose.ingress-trust.yml`이 port·network·environment를 reset/replace한다. 파일 순서는
  [ingress-trust target](../deploy/README.md#renderer와-고정-compose-순서)이 고정하고 renderer와 test가 강제한다.

Compose inventory 검사(`scripts/infra/check/inspect.mjs`)는 파일마다 처음 나온 profile의 분류를 쓰므로 이 파일은 rehearsal-only로 분류된다.
`ingress-trust`는 forwarding trust 검증 대상이고, 지금 운영 중인 Web 단계 host의 compose가 아니다. 운영 Web 단계 배포
구성은 [Production environment](../../docs/deploy/production-environment.md)가 설명하고 Web CD 작업이 저장소에 더한다. 그
뒤 이 파일과 운영 compose의 역할 정리는 그 작업이 맡는다.

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
8. 모든 container·volume·network를 두 번 정리해 cleanup idempotency를 확인한다.

Standalone Web rehearsal의 `web-upstream` fixture는 full-stack profile에 합성하지 않는다. Full-stack
Web은 실제 nginx/API를 사용하며, evidence의 제품 container limit 합계에는 fixture나 PostgreSQL을
포함하지 않는다.

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

Forwarding trust는 [별도의 ingress-trust target](../deploy/README.md#single-public-ingress-forwarding-trust-target)을
한 Compose project에 렌더해 검증한다. Public/API/Web/observer explicit IPAM, private listener 원본-peer ACL,
API/Web 비노출과 관측된 Nginx source address를 검증하고, 실제 public IPv6·TLS·WS/BFF 동작의 미실행 항목은
명시적으로 gap으로 남긴다. 단순 renderer 또는 `docker compose config` 성공은 listener/방화벽 증거가 아니다.

Synthetic 기본 allocation은 public `172.30.247.0/28`, API `172.30.248.0/28`, Web `172.30.249.0/28`,
observer `172.30.250.0/28`이며 각 Nginx `.2`, API/Web/collector `.3`를 사용한다. Native IPv6 public
fixture에는 예를 들어 `fd45:448:247::/64`와 명시한 peer 주소를 추가한다. 이것은 실제 production 할당이
아니다. Runtime runner는 실행 직전 host route와 현재 Docker network 충돌을 검사하고, fresh project의
정확히 기록한 resource만 정리한다. 기존 full-stack/user project를 down하거나 network/volume prune하지 않는다.

### Account-free ingress fixture

```bash
docker build --label knu.fixture.kind=chat-ingress-trust \
  --label knu.fixture.source="$(git rev-parse HEAD)" \
  -f scripts/infra/rehearsal/ingress-trust/Dockerfile \
  -t knu-chat-ingress-fixture:local .
node scripts/infra/rehearsal/ingress-trust/index.mjs --image=knu-chat-ingress-fixture:local --mode=fixture-http
node scripts/infra/rehearsal/ingress-trust/index.mjs --image=knu-chat-ingress-fixture:local --mode=production-https
```

두 모드 모두 disposable **로컬 fixture**다. HTTPS 모드도 테스트 전용 자체 서명 인증서만 사용하며
클라이언트는 그 인증서와 hostname을 검증한다. 실제 인증서 발급, provider/DB 연결, host port publish,
Docker daemon/global network 설정 변경은 없다. `netstat`, OpenSSL, Docker Compose와 IPv6 bridge를
지원하는 로컬 runner가 필요하다. 이미지 빌드는 기존 lockfile dependency로 API와 실제 Web production
surface를 빌드한다. 실행 전 image 내부의 source manifest를 현재 API/Web/packages/fixture 입력과
비교하며, 누락·불일치·오래된 image는 거부한다. 가변 tag 대신 확인한 immutable image ID로 실행하고,
image ID/source digest, 실제 `nginx -T` 및 Compose config digest를 결과에 기록한다. source label은
보조 정보일 뿐 검증 근거를 대신하지 않는다.

런타임은 실제 API ticket controller/guard, IP limiter, Socket.IO adapter/gateway와 두 Web BFF forwarding
함수를 실행한다. 사용자/일회용 ticket 저장소는 메모리 합성 provider이고, Web은 실제 Next production
서버 대신 `NextRequest`를 사용하는 테스트 전용 listener다. `/auth/fixture/probe`, readiness와 metrics
응답은 fixture 전용이다. 따라서 production bootstrap, DB, metrics guard 자체나 전체 브라우저 기능의
검증을 대신하지 않는다. Socket.IO namespace ack뿐 아니라 실제 gateway의 인증 후 connection counter를
확인한다. Polling과 WebSocket 직접 연결은 ingress에서, polling→WebSocket upgrade와 gateway-only 제한은
API의 실제 transport regression에서 검증한다.

결과는 `.artifacts/tools/infra/ingress-trust/<project>/result.json`에 저장한다. 동일 client의 위조 prefix
변경, 서로 다른 client, BFF, native IPv6, authority/scheme, private ACL, observer route/token과 forbidden
TCP 경로를 확인한다. TCP 격리 실패도 끝까지 수집하되 skip/PASS로 바꾸지 않는다. 생성한 정확한 project
label을 확인한 뒤 해당 container/network/volume을 정리하며, 모두 제거된 것을 확인하지 않으면
결과가 PASS가 되지 않는다. 실패·남은 volume·타 project label 및 반복 cleanup 회귀를 함께 유지한다.
로그 수집 실패와 cleanup 실패는 별도로 기록하며, 로그 수집이 실패해도 정확한 자원 정리를 시도한다.

#### Routed synthetic egress

위 기본 실행은 inbound baseline이다. `routedEgressVerified: false`인 결과는 outbound acceptance를
완료하지 않는다. 전체 로컬 검증에서는 Docker daemon host 밖의 승인된 peer Linux에 한시적인 endpoint를
준비하고 두 모드 모두 `--egress`를 전달한다. 아래 주소는 fixture 전용 예시이지 production 설정이 아니다.

```bash
# 실행마다 새 nonce를 만들고, 동일 JSON을 peer와 runner에 전달한다.
egress='{"address":"172.31.254.2","sourceAddress":"172.31.254.1","port":18080,"nonce":"<32 lowercase hex characters>"}'
# peer Linux: private interface만 bind; Docker나 product dependency는 필요 없음.
node scripts/infra/rehearsal/ingress-trust/egress.mjs --serve="$egress"
# runner Linux: 같은 daemon/source-bound image에서 두 mode를 각각 실행한다.
node scripts/infra/rehearsal/ingress-trust/index.mjs \
  --image=knu-chat-ingress-fixture:local --mode=production-https --egress="$egress"
```

Peer는 선언한 source, nonce, API/Web GET 경로만 허용하고 실제 수신 주소를 응답·로그에 기록한다.
Privileged port·public/DNS/loopback target·fixture 내부 주소·daemon-host INPUT endpoint는 거부한다.
Runner는 **실제 API/Web 컨테이너**의 기본 route, 외부 peer-facing interface로 향하는 Linux forward route,
`iptables-save -c`의 FORWARD·해당 bridge MASQUERADE counter 증가와 peer 응답을 함께 검증한다.
현재 counter 검증은 Docker iptables backend의 규칙을 요구하며, 미지원 backend를 성공으로 간주하지 않는다.
필터/route를 수정하거나 새 trusted peer를 추가하지 않는다. Host probe·ping 또는 gateway INPUT 성공은
대체 증거가 아니다. IPv4 synthetic outbound 검증과 fixture 내부 native IPv6 검증은 별개다.

Endpoint는 최대 15분 후 종료하지만 이는 안전장치일 뿐 cleanup 증거가 아니다. VM 관리 owner는 실행 전
포트 부재·실제 PID/command/nonce를 기록하고 정상·의도적인 실패·실제 OS SIGTERM 각각의 `finally`에서
정확한 peer 프로세스를 종료한 뒤 socket/PID 부재와 Compose 자원 부재를 확인한다. PID 재사용이나
다른 프로세스의 포트 점유를 kill 권한으로 해석하지 않는다. Runner가 peer VM을 직접 관리하지 않으며,
이미 승인된 guest-management 경로를 사용한다. Image manifest에 포함된 fixture 파일을 바꾸면 재빌드한다.

**Runner 격리는 검증 대상이다.** Docker 호환 엔진의 custom network가 bridge 간 직접 TCP 접근을
허용하면 이 fixture는 실패해야 한다. [OrbStack의 cross-network 접근 보고](https://github.com/orbstack/orbstack/issues/1944)나
엔진 종류만으로 현재 버전의 성공/실패를 단정하지 말고 실제 denial 결과를 사용한다. 실패 시 표준 bridge
격리를 제공하는 별도 Linux Docker runner에서 같은 topology를 재검증한다. `internal: true`, 광범위한
trusted CIDR, assertion 완화 또는 host 방화벽 변경으로 실패를 숨기지 않는다. Linux runner의 PASS도 실제
release host의 TLS/peer/IPAM/egress/monitoring 증거를 대신하지 않으며, 배포 owner가 해당 release SHA의
증거를 확인하기 전 activation은 NO-GO다.
