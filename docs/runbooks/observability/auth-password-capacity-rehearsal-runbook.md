# Auth password capacity local rehearsal

이 문서는 4GB RAM / 2CPU로 제한한 로컬 Docker engine에서 API, nginx, PostgreSQL, Prometheus, Loki, Alloy, Alertmanager, Grafana를 함께 실행하고 Auth 비밀번호 처리 용량을 반복 검증하는 절차다. 결과는 **local constrained evidence**이며 외부 host나 managed PostgreSQL의 용량 증명으로 해석하지 않는다.

## 실행 경계

- [Local environment selector](../../../infra/runbooks/rehearsal/local-environments.md)의 full-stack 4608MiB와 이 문서의 strict 4096MiB는 별도 profile이다. 기존 결과·workload를 바꾸거나 전역 engine을 자동 재설정하지 않는다.
- Docker engine 전체를 2 CPU / 4096MiB로 제한한다. 더 큰 개발 머신에서 container limit만 설정한 결과는 이 분류로 기록하지 않는다.
- API/nginx는 `infra/rehearsal/compose.api.runtime.yml`의 resource budget을 사용한다.
- 관측 stack은 production과 rehearsal이 공유하는 `infra/observability/compose.resources.yml`의 resource budget을 사용한다.
- 로컬 PostgreSQL은 production의 managed PostgreSQL을 대체하지 않는다. 같은 4GB engine을 사용하므로 app host 관점에서는 더 보수적인 배선 확인이지만 DB 성능 비교 근거는 아니다.
- Web과 BackOffice runtime은 현재 rehearsal compose에 포함하지 않는다. 두 runtime의 합산 576MiB limit은 미사용 budget으로 남으며, 결과를 전체 서비스 host 검증으로 확대 해석하지 않는다.
- `stress:auth:hash-micro`는 Docker engine 밖에서 실행되는 host 진단이다. 이 runbook의 4GB/2CPU 판정에는 실제 container endpoint를 사용하는 H1~H9만 포함한다.
- Password, email, token, grant/session secret, DB URL은 report에 남기지 않는다.

## 1. Docker engine 제한

현재 engine 정보를 먼저 확인한다.

```bash
pnpm --dir apps/api stress:local:preflight
```

OrbStack을 사용하는 경우의 설정 예시는 다음과 같다. 전역 개발 환경 설정이므로 스크립트가 자동으로 변경하지 않는다.

```bash
orb config set cpu 2
orb config set memory_mib 4096
```

설정 후 OrbStack을 재시작하고 preflight를 다시 실행한다. Docker Desktop이나 별도 Linux VM도 동일하게 2 CPU / 4096MiB로 제한한다. 메모리 표기 오차는 기본적으로 ±256MiB만 허용한다.

Pass 기준:

- `status=passed`
- `actualCpus=2`
- `actualMemoryMiB`가 3840~4352 범위

## 2. Compose 정적 검증

```bash
pnpm infra:compose -- api-stress config >/tmp/knu-api-rehearsal-compose.yml
pnpm infra:compose -- observability-rehearsal config >/tmp/knu-observability-rehearsal-compose.yml
```

Rendered compose에는 실제 secret을 공유하지 않는다. Private env와 metrics bearer token이 없으면 runner가 ignored local 파일을 생성한다.

## 3. 빠른 실행

기본 명령은 H1 한 개를 실행한다.

```bash
pnpm --dir apps/api stress:local:auth-password
```

이 명령은 다음을 자동 수행한다.

1. 2 CPU / 4096MiB engine preflight
2. 로컬 PostgreSQL 시작과 fresh schema 적용
3. API/nginx와 resource-limited observability stack 시작
4. Auth capacity fixture 생성
5. 실제 login/signup/reset/change endpoint mix 실행
6. health/readiness/metrics, Docker stats, PostgreSQL 상태 수집
7. fixture와 raw artifact 정리 및 compose 종료
8. `.artifacts/tools/stress/api-auth-password-capacity-result-*.md` 작성

## 4. Profile 실행

60분 soak를 제외한 권장 순서는 다음과 같다.

```bash
STRESS_LOCAL_REHEARSAL_PROFILES=h1,h2,h3,h7,h4,h5,h6,h9 \
  pnpm --dir apps/api stress:local:auth-password
```

H8 soak를 포함한 전체 실행은 장시간 실행임을 명시적으로 확인해야 한다.

```bash
STRESS_LOCAL_REHEARSAL_PROFILES=all \
STRESS_LOCAL_REHEARSAL_INCLUDE_SOAK=I_UNDERSTAND_60_MINUTES \
  pnpm --dir apps/api stress:local:auth-password
```

Local constrained rehearsal에서는 profile의 기본 arrival rate와 duration을 변경하지 않는다. `STRESS_AUTH_CAPACITY_RATE` 또는 `STRESS_AUTH_CAPACITY_DURATION`을 사용한 짧은 실행은 배선 smoke로만 분류한다.

## 5. 판정과 정리

각 profile report에서 다음을 확인한다.

- k6 checks와 threshold가 통과했다.
- login success/failure, signup, password reset, password change operation별 p95/p99와 error rate가 기록됐다.
- API/nginx/관측 container가 resource limit 안에서 실행됐다.
- PostgreSQL waiting lock과 fixture residue가 남지 않았다.
- report의 `targetClass`가 `local constrained`로 기록됐다.
- secret material detection이 실패하지 않았다.

중단 또는 실패 후 정리가 필요하면 다음을 실행한다.

```bash
pnpm --dir apps/api stress:fixture:auth-capacity:reset
pnpm --dir apps/api stress:fixture:reset

pnpm infra:compose -- api-stress down
pnpm infra:compose -- observability-rehearsal down
```

## 선택적 외부 재검증으로 넘길 정보

별도 AWS/managed PostgreSQL reference 환경은 현재 최초 배포 gate에 포함하지 않는다. 운영 지표 악화나 인프라 변경으로 외부 재검증이 필요해질 때만 이 runbook과 `docs/architecture/platform/production-runtime-topology.md`, `infra/runbooks/release/components/infrastructure-target/readiness.md`를 입력으로 새 계획을 작성한다. 후속 계획은 특정 cloud vendor를 전제하지 않고 다음을 새로 결정해야 한다.

- 실제 app host의 CPU/memory 및 CPU credit 또는 throttling 특성
- managed PostgreSQL 연결 방식과 fixture 격리·정리 전략
- load generator를 app host 밖에서 실행하는 방법
- H0~H9 실행 window와 승인 책임자
- host CPU/memory, API RSS/event-loop lag, DB CPU/connection/lock/IOPS 수집 방법
- local constrained 결과와 외부 결과를 비교하는 GO/NO-GO 기준

현재 저장소는 외부 DB adapter나 cloud resource 생성을 구현하지 않는다. 이 미구현 상태는 승인된 H1~H7/H9 local baseline의 blocker가 아니다.
