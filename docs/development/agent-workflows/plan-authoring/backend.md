# Backend plan authoring

`apps/api`, shared public contract, persistence, transaction, background work가 primary owner인 계획에 사용합니다.
[Core](./core.md)를 먼저 읽습니다.

## Domain owner and invariant

- controller 이름이 아니라 business capability와 aggregate/use-case owner를 찾습니다.
- actor, target, state transition, precondition, terminal state, forbidden transition을 명시합니다.
- aggregate state와 partial draft를 혼동하지 않고 action capability가 transaction precondition을 충분히 투영하는지 확인합니다.
- auth가 호출하는 다른 domain의 invariant를 auth 내부에 복제하지 않습니다.

## Public contract and error semantics

- request/response schema, status/error code, presenter, de-identification, compatibility를 producer/consumer 관점에서 봅니다.
- public contract는 shared package가 실제 FE/BE 의미를 공유할 때만 소유합니다.
- internal DTO, Prisma row, provider payload를 public type처럼 노출하지 않습니다.
- validation, authorization, not-found, conflict, throttle, provider failure를 사용자·운영 의미에 맞게 구분합니다.

## Transaction, concurrency, and idempotency

- read-check-write가 같은 transaction/lock/unique constraint에서 보호되는지 확인합니다.
- duplicate request, retry, replay, concurrent terminal transition, stale capability와 TOCTOU를 다룹니다.
- idempotency key나 distributed lock은 실제 retry/concurrency boundary가 요구할 때만 도입합니다.
- side effect와 commit 경계를 분리하고 email/event/provider 실패의 보상 또는 outbox 필요성을 판단합니다.

## Persistence and lifecycle

- schema owner, foreign key, unique/index, query pattern, retention, anonymization/deletion을 함께 설계합니다.
- migration은 released data 유무를 확인하고 fresh DB, current DB, rollback/forward-fix 전략을 구분합니다.
- snapshot/history는 현재 mutable row와 의미·schema version·공개 범위를 분리합니다.
- seed/reference data는 idempotency, deterministic key, production-safe input과 실행 owner를 갖습니다.

## Security, abuse, and provider boundary

- authentication, authorization, enumeration, replay, brute force, moderation, rate limit, secret/log leakage를 점검합니다.
- external provider는 adapter, timeout, retry, circuit/fail-open-or-closed, payload scrubbing과 operator evidence를 갖습니다.
- auth·PII·moderation·legal이면 [Security and privacy](./cross-cutting/security-privacy.md)를 추가합니다.

## Performance and operations

- actual query shape, index, pool, CPU/memory, hashing, job cadence, provider quota에서 saturation 후보를 찾습니다.
- metric은 owner-local operational question에 연결하고 product data analytics와 혼동하지 않습니다.
- health/readiness는 operator action에 필요한 bounded signal만 노출하며 alert 판정은 observability owner에 둡니다.
- migration, rollout, provider 또는 production target이 포함되면 [Operations and release](./cross-cutting/operations-release.md)를 추가합니다.

## Background work and integration

- scheduler, cleanup worker, event consumer/materializer는 trigger, ownership, idempotency, retry, retention과
  cluster-wide execution boundary를 갖습니다.
- 호출되지 않는 future worker나 metric을 운영 준비로 간주하지 않습니다.
- FE/BFF는 public contract와 user-facing error semantics를, BackOffice는 operator authorization과 audit 가능한
  product workflow를 통해 연결합니다.
- Main application, auth, support, BackOffice가 같은 persistence table을 직접 공유하는 대신 canonical domain
  owner를 호출하도록 계획합니다.

## Internal architecture

- controller → application command/query → domain policy → repository/provider → presenter 흐름의 실제 필요성을 확인합니다.
- 작은 owner는 flat 구조를 유지하고 독립 lifecycle/module boundary가 있을 때만 nested slice를 만듭니다.
- raw re-export, catch-all utils/types, unused abstraction, runtime-unconnected code를 계획에 남기지 않습니다.
- cross-domain call은 public service/contract를 사용하고 내부 persistence를 우회하지 않습니다.

## Backend verification

- invariant/policy: unit test
- command/query transaction and repository: integration test
- controller/public contract/error: controller or API integration test
- concurrency/idempotency: deterministic race/replay test
- migration/seed: fresh database plus relevant existing-state path
- provider/job: fake/recording adapter, timeout/failure/cleanup test
- performance-sensitive work: representative benchmark/stress with stated environment
- architecture boundary: import/caller/layout behavior test, not historical file-name fixation

Plan은 owner/invariant, state/capability matrix, public contract, transaction boundary, persistence lifecycle, security,
background work, operations, integration caller와 verification evidence를 명시합니다.
