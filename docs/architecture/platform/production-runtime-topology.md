# Production runtime topology

## 책임

이 문서는 KNU Roommate의 현재 production runtime 배치 결정과 변경 근거를 소유한다. Provider,
instance identifier, 실제 가격과 release 결과는 release readiness/evidence가 소유하고, secret·DB·ingress·rollback
불변 조건은 [Production runtime safety](../../policies/production-runtime-safety.md)가 소유한다.

## 결정

BackOffice 출시 전에는 **User App 4GiB host + private managed PostgreSQL**을 기준으로 준비한다.
BackOffice 출시 시에는 8GiB 단일 host로 합치지 않고 **User App 4GiB host + BackOffice 2GiB host +
private managed PostgreSQL**로 분리한다.

```text
User App host 4GiB
├── user nginx
├── Web
├── API
└── self-hosted observability stack

BackOffice host 2GiB
├── admin nginx
├── BackOffice Web
├── BackOffice API
└── observability collector

Managed PostgreSQL
```

## 선택 근거

- 사용자 traffic과 운영자 workload의 memory pressure 및 장애 영역을 분리한다.
- 사용자 제품과 BackOffice의 image, environment, deploy principal, ingress, health와 rollback을 독립시킨다.
- BackOffice 운영자 접근을 public 사용자 ingress와 분리하고 더 강한 network/capability 경계를 적용한다.
- BackOffice release가 사용자 제품의 무관한 rollout을 요구하지 않게 한다.
- 초기에는 운영 복잡도를 낮추기 위해 사용자 host에 bounded observability를 함께 두되, 실제 resource evidence가 나빠지면 별도 ops host 또는 managed service 전환을 다시 결정한다.

## Runtime 책임 경계

### User App host

- 사용자 Web/API와 public ingress를 소유한다.
- API의 auth hash와 제품 transaction이 우선 resource owner다.
- Observability는 제품 요청을 방해하지 않는 limit와 fail-open 경계를 사용한다.
- BackOffice Web/API를 배치하지 않는다.

### BackOffice host

- 운영자 Web/API와 제한된 admin ingress만 소유한다.
- 사용자 session/capability를 그대로 재사용하지 않고 별도 admin authorization과 audit을 적용한다.
- 사용자 제품과 별도의 health, rollout과 previous-safe rollback 경로를 사용한다.
- 중앙 관측 stack으로 로그와 metric을 전달하되 raw 관측 query를 제품 API로 재노출하지 않는다.

### Managed PostgreSQL

- User API와 BackOffice API가 같은 schema를 사용하더라도 runtime credential과 pool budget을 분리한다.
- Schema migration은 두 API가 경쟁해서 실행하지 않고 release pipeline의 단일 migration owner가 한 번만 수행한다.
- 대량 운영 조회·내보내기는 사용자 transaction pool과 timeout을 침범하지 않게 별도 budget을 사용한다.

## Repository와 deploy 구조 목표

```text
apps/
├── web/
├── api/
├── backoffice-web/
└── backoffice-api/

infra/deploy/
├── user/
│   └── compose.yml
└── backoffice/
    └── compose.yml
```

BackOffice deployable이 생기기 전에는 빈 디렉터리나 가짜 compose를 만들지 않는다. 구현 시 caller,
CI path filter, image inventory, environment manifest와 rollback 경계를 함께 이전한다.

## Capacity 근거와 변경 trigger

정확한 container limit, provider 가격과 현재 planning budget은
[`infrastructure-target-release-readiness.md`](../../../infra/runbooks/release/components/infrastructure-target-release-readiness.md)가
소유한다. Local 연결·resource 회귀 절차는
[`full-stack-local-infrastructure.md`](../../../infra/runbooks/rehearsal/full-stack-local-infrastructure.md)가
소유한다.

다음 조건 중 하나가 확인되면 topology를 새 decision으로 재검토한다.

- User host의 sustained CPU, memory, disk 또는 latency가 release threshold를 넘는다.
- Observability resource가 제품 요청의 headroom을 침범한다.
- BackOffice query가 사용자 DB pool 또는 transaction latency를 침범한다.
- 단일 host 장애 영역이나 operator 접근 경계가 승인된 RTO/RPO를 만족하지 못한다.
- Multi-instance, managed observability, read replica 또는 별도 analytics store가 비용 대비 더 유리하다는 evidence가 생긴다.

## 변경 이력

| 날짜       | 변경 내용                                                                                          |
| ---------- | -------------------------------------------------------------------------------------------------- |
| 2026-08-11 | User App 4GiB와 미래 BackOffice 2GiB를 분리하고 managed PostgreSQL을 공유하는 topology를 확정했다. |
