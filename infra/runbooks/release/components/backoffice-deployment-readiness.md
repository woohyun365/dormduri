# BackOffice deployment readiness handoff

## 상태와 책임

- Repository state: `FUTURE_COMPONENT`
- 현재 BackOffice Web/API 구현: 없음
- 결정된 target topology: **User App 4GiB host + BackOffice 2GiB host + managed PostgreSQL**
- 비용·resource source of truth:
  [`infrastructure-target-release-readiness.md`](./infrastructure-target-release-readiness.md)
- topology 결정 근거:
  [`production-runtime-topology.md`](../../../../docs/architecture/platform/production-runtime-topology.md)

이 문서는 미래 BackOffice 구현·배포 세션이 사용자 제품과 운영자 제품을 같은 host에 관성적으로
합치지 않도록 경계를 전달한다. 실제 provider, instance identifier, network와 비용은 BackOffice
release 시점에 다시 확인하고 target evidence에 기록한다.

## 목표 repository 구조

```text
apps/
├── web/                 # 사용자 Next.js
├── api/                 # 사용자 NestJS
├── backoffice-web/      # 운영자 Next.js
└── backoffice-api/      # 운영자 NestJS

infra/deploy/
├── user/
│   ├── compose.yml
│   └── ...
└── backoffice/
    ├── compose.yml
    └── ...
```

현재 `infra/deploy/compose.api.yml`을 이 구조로 미리 이동하지 않는다. BackOffice deployable이
생길 때 caller migration, CI path filter, image inventory와 rollback 경계를 함께 설계한다.

## 배포 단위 경계

사용자 제품과 BackOffice는 다음 항목을 독립적으로 소유한다.

- OCI image와 immutable digest
- runtime env manifest와 secret namespace
- deploy/pull principal과 최소 권한 IAM role
- ingress, Security Group/firewall와 canonical host
- health/readiness, rollout, previous safe digest와 rollback
- 로그의 `service` label과 Prometheus scrape target

BackOffice host는 public product ingress를 재사용하지 않는다. 운영자 접근은 IP allowlist, VPN,
SSM 또는 동등한 제한 경계를 사용한다. 단순히 별도 container로 실행하는 것은 host 장애·memory
pressure·권한 침해를 격리하지 못하므로 목표 topology로 인정하지 않는다.

## Database와 migration 경계

- 사용자 API와 BackOffice API가 같은 release에서 migration을 각각 실행하지 않는다.
- 단일 release migration owner가 schema migration과 role grant를 한 번만 수행한다.
- BackOffice API는 browser가 아니라 별도 최소 권한 DB credential을 소유한다.
- 관리자 조회·변경은 capability guard와 actor/action/target/outcome 감사 기록을 남긴다.
- 대량 조회·내보내기·분석 query는 사용자 transaction pool을 고갈시키지 않도록 별도 pool budget과
  timeout을 둔다.

## Resource와 비용 입력

BackOffice container resource, host headroom, provider 가격과 전체 배포 예산은
[`infrastructure-target-release-readiness.md`](./infrastructure-target-release-readiness.md)가 단독
소유한다. 이 handoff에서는 같은 숫자를 복제하지 않고 BackOffice release 시 target readiness 값을
검증한 뒤 evidence에 계산 시점과 owner를 기록한다.

## Observability 연결

- BackOffice API metric은 Prometheus가 별도 job으로 scrape한다.
- BackOffice Web/API stdout은 host Alloy가 중앙 Loki로 전달한다.
- Grafana에 사용자 제품과 분리된 dashboard·alert label을 둔다.
- 운영 로그·metric은 Grafana에서 보고, 신고·제재·문의·시즌 운영 같은 durable 제품 데이터는
  BackOffice UI/API가 소유한다.
- Loki/Prometheus raw query를 BackOffice 제품 API로 재노출하지 않는다. 필요한 경우 Grafana
  dashboard deep link만 제한적으로 제공한다.

## 구현 시작 전 checklist

1. BackOffice 기능과 admin capability/감사 범위를 승인한다.
2. `apps/backoffice-web`, `apps/backoffice-api`의 public contract와 domain reuse 경계를 설계한다.
3. User App 내부 source를 경로로 직접 import하지 않고 shared contract 또는 owning package를 사용한다.
4. Local Compose에서 두 deployable과 disposable DB를 검증하되 production host 분리를 유지한다.
5. User/BackOffice별 Dockerfile, compose profile, env manifest, image inventory를 구성한다.
6. CI를 path-aware lane으로 나누고 migration lane은 단일 owner로 유지한다.
7. BackOffice host의 private operator ingress와 RDS Security Group을 검증한다.
8. Metric/log/alert fail-open과 사용자 App 장애 격리 rehearsal을 수행한다.
9. 실제 월 예산, instance identifier, digest와 rollback evidence를 release 문서에 기록한다.

## 중단 조건

- BackOffice가 사용자 session/capability를 그대로 신뢰한다.
- 관리자 API 또는 Grafana/Loki/Prometheus port가 public internet에 직접 노출된다.
- User API와 BackOffice API가 migration ownership을 공유하지 못한다.
- 관리자 action audit과 최소 권한 DB role이 없다.
- User App 장애와 BackOffice 장애를 독립적으로 rollback할 수 없다.
