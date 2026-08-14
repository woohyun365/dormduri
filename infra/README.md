# Infrastructure

`infra/`는 실행 가능한 runtime·database·observability 구성과 이를 검증·운영하는 handoff를 소유한다.
제품 정책은 `docs/policies/`, 장기 topology 결정은 `docs/architecture/platform/`, repository 실행 도구는
`scripts/`가 소유한다.

## 디렉터리 책임

| 디렉터리         | 책임                                                                      | 소유하지 않는 것                                                |
| ---------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `deploy/`        | API/Web image, nginx, production-neutral runtime candidate, release smoke | provider host, registry, rollout 자동화, local resource fixture |
| `rehearsal/`     | production candidate에만 합성하는 local resource·network·fixture overlay  | 실제 release evidence, production DB 성능                       |
| `observability/` | Prometheus·Loki·Grafana·Alloy·Alertmanager configuration asset            | incident 절차, release 판정, managed Sentry 저장소              |
| `db/`            | migration·role grant·credential smoke operator script                     | DB 생성, credential 발급, backup 승인                           |
| `aws/`           | 미래 AWS target 입력과 setup checklist                                    | IaC, 실제 resource 상태, release 완료 증거                      |
| `artifacts/`     | OCI build evidence schema                                                 | 생성된 artifact 자체                                            |
| `runbooks/`      | release, operation, incident, rehearsal 실행 절차와 evidence handoff      | 제품 정책과 architecture 설명                                   |

`image-inventory.json`, `runtime-hardening.json`, `compose-profiles.json`은 각각 외부 image pin,
runtime hardening, Compose 합성 순서의 machine-readable source of truth다.

## 시작 위치

- 로컬 full-stack 검증: [`rehearsal/README.md`](./rehearsal/README.md)
- runtime candidate 구성: [`deploy/README.md`](./deploy/README.md)
- 관측 configuration: [`observability/README.md`](./observability/README.md)
- DB operator script: [`db/README.md`](./db/README.md)
- 실제 배포 준비: [`runbooks/release/production-release-readiness.md`](./runbooks/release/production-release-readiness.md)

## 불변 규칙

1. Rehearsal overlay와 stress policy를 production candidate에 자동 합성하지 않는다.
2. Container startup은 migration, role grant, fixture seed를 실행하지 않는다.
3. Provider secret과 실제 endpoint를 tracked file이나 evidence template에 기록하지 않는다.
4. Local evidence를 실제 target release evidence로 승격하지 않는다.
5. 생성 결과는 `artifacts/local/` 또는 CI artifact storage에 두고 `infra/`에 쓰지 않는다.
