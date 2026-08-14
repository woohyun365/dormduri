# Product and service runbooks

`docs/runbooks`는 운영자가 제품·서비스 정책을 반복 적용하거나 제품 동작을 검증하는 절차를
소유한다. 일회성 조사 기록은 `local-docs/analysis/`에 둔다.

- [`season-operation.md`](./season-operation.md): 시즌 운영 절차
- [`observability/`](./observability/): API/Auth workload와 제품 metric 검증

Infrastructure 배포, DB, 관측 stack, incident와 rollback 절차는 `infra/runbooks/`가 소유한다.
Production release는 `infra/runbooks/release/production-release-readiness.md`에서 시작하고 실제
component 결과의 집계와 최종 판정은
`infra/runbooks/release/production-release-evidence.md`에만 기록한다.
