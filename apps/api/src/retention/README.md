# Retention API module architecture

이 문서는 `apps/api/src/retention`의 server-side RRPD retention boundary map이다. Retention은 삭제·비식별화 이후에도 제한된 목적과 기간 안에서 보존해야 하는 payload, disclosure, access log, review/disposal job을 다룬다.

## Public boundary

일반 product/lifecycle caller는 exported module/port surface를 사용한다. Source archive handler와 계정 삭제 등은
아래에 명시한 함수/registry로 협업한다. 이 협업을 임의 vault/disclosure 접근 권한으로 확대하지 않는다.

- `RetentionModule`: retention sweep/observability provider wiring의 module surface다. 현재 Nest export는 아래 두 port다.
- `RETENTION_OBSERVABILITY_PORT`: lifecycle sweep result를 metric/alert candidate signal로 변환하는 observability surface다.
- `RETENTION_SWEEP_PORT`: lifecycle sweep이 archive/review/disposal job을 실행할 때 사용하는 narrow surface다.
- Domain-owned archive handler는 `vault/retention-case.repository.ts`, `vault/retained-vault.service.ts` 등의 함수에 caller transaction을 전달한다. Archive dispatch는 `archive-jobs/targets/archive-target-handlers.ts`의 registry가 담당한다.
- 계정 삭제는 retained identity snapshot과 archive-job 생성 함수를 worker transaction에서 호출한다. Source-owner identity-link review와 report reference append의 제한은 [데이터 소유권 계약](../../../../docs/architecture/backend/domain-data-ownership.md)을 따른다.
- Vault/disclosure/target-handler용 별도 DI port는 현재 없다. Disclosure 함수의 존재는 BackOffice API 연결이나 운영 release readiness를 뜻하지 않는다.
- `RetentionWorkerPrismaService`와 `RetentionDisclosurePrismaService`: DB credential boundary다. 일반 API runtime credential은 RRPD raw payload/identifier payload를 직접 읽거나 쓰는 owner가 아니다.

## Directory responsibilities

- `application/`: lifecycle/backoffice/domain composition이 사용하는 public use-case service와 port definition. Product read/write API facade bucket을 두지 않는다.
- `archive-jobs/`: `ArchiveJob` queue claim, retry, manual-review transition, target handler registry. Target별 source row semantics는 handler owner domain에 둔다.
- `retained-identities/`: 삭제 계정 identifier anchor decision, snapshot, disclosure, disposal, metadata validation. User-facing display identity owner가 아니다.
- `vault/`: `RetentionCase`, `RetainedVaultObject`, hold, payload retain/disclose/dispose, payload codec, vault keyring owner.
- `access-logs/`: retained identity/vault disclosure 접근 로그 생성과 disposal scheduling owner.
- `review-jobs/`: identity-link review, due review retry, review handler registry owner.
- `crypto/`: retention payload encryption helper와 payload envelope format. Production key custody adapter는 이 boundary의 adapter로 붙는다.
- `observability/`: Prometheus definition, backlog snapshot, sweep emission mapping, metric recorder와 alert candidate signal을 함께 소유한다. Retained payload 원문을 로그/metric에 넣지 않는다.
- `composition/`: RetentionModule provider/export/token source of truth. Module decorator에서 긴 provider list를 직접 소유하지 않는다.
- Retention unit/integration specs는 owning slice 옆에 둔다. Cross-domain layout/import fitness는 `apps/api/test/architecture/`가 소유한다.

## Domain-owned archive handlers

Retention core는 queue/case/vault/access-log/review/disclosure boundary를 소유한다. Source row의 의미와 redaction/tombstone/minimization 규칙은 원래 domain handler가 소유한다.

- users identity: `users/identity/retention/nickname-audit-archive.handler.ts`, `users/identity/retention/academic-identity-audit-archive.handler.ts`.
- season-participants: `season-participants/retention/season-profile-history-archive.handler.ts`.
- matches: `matches/history/retention/match-history-archive.handler.ts`.
- chat: `chat/retention/thread-retention-archive.handler.ts`, `chat/retention/conversation-retained-body.service.ts`.

이 구분은 같은 용어가 domain마다 다른 bounded context를 가질 수 있기 때문이다. Retention root가 chat/matches/users/season-participants의 policy와 write semantics를 흡수하지 않는다.

## Observability and operations runbook

Retention observability는 lifecycle sweep 결과와 DB backlog를 count/status/error-code 중심의 metric과 alert candidate signal로 변환한다. 이 layer는 retained payload 원문, identifier payload, decrypt 결과, approval reference, disclosure purpose를 로그나 metric에 포함하지 않는다.

### Metric/alert ownership

- Prometheus definition owner: `observability/retention-metric.definitions.ts`.
- Sweep metric emission builder: `observability/retention-metrics.ts`.
- Backlog snapshot owner: `observability/retention-backlog-snapshot.query.ts`.
- Alert candidate owner: `observability/retention-alerts.ts`.
- Prometheus recorder와 structured log emission owner: `observability/retention-observability.service.ts`.
- Public injection surface: `RETENTION_OBSERVABILITY_PORT`.

### Alert triage

- `RETENTION_ARCHIVE_MANUAL_REVIEW`: `ArchiveJob`이 manual-review 상태로 이동했다. target handler owner domain의 source row transformation, retry history, last error code를 확인한다.
- `RETENTION_REVIEW_MANUAL_REVIEW`: identity-link review job이 manual review 상태다. review payload, approval policy, 대상 record의 retained/disposed state를 확인한다.
- `RETENTION_RETRY_EXHAUSTED`: archive retry budget이 소진됐다. 같은 target의 반복 실패 원인, worker crash loop, TypedSQL claim lease, source handler idempotency를 확인한다.
- `RETENTION_KEY_UNAVAILABLE`: retained body/keyring/KMS 후보 key를 찾지 못했다. env key, future KMS adapter, key rotation history, 해당 handler의 disclosure/decrypt path를 확인한다.
- `RETENTION_BACKLOG_THRESHOLD_EXCEEDED`: due backlog가 운영 기준을 넘었다. worker 수, batch size, lease, DB pool, IOPS, query latency를 함께 확인한다.
- `RETENTION_SWEEP_FAILED`: lifecycle sweep이 완료 전 실패했다. alert metadata는 mode와 sanitized error name만 남기며, 원문 error message는 retained payload/identifier 유입 가능성 때문에 기록하지 않는다.

### Worker count and RDS signals

`LIFECYCLE_SWEEP_ENABLED=true`인 runtime instance 수가 retention worker concurrency가 될 수 있다. 운영에서는 API serving replica와 worker 전용 replica/process를 분리하거나, 아래 지표를 기준으로 worker 수와 batch size를 조정한다.

- Queue/backlog: due archive/review/access-log count, manual review count, retry exhausted count.
- Runtime: sweep duration, processed count, retry/manual-review ratio, claim lease expiry frequency.
- RDS: connection count, pool saturation, CPU, ReadIOPS/WriteIOPS, DiskQueueDepth, slow query/query latency.
- Cost signal: worker 수 증가로 write amplification과 IOPS가 증가하면 batch size/interval 조정 또는 worker replica 분리를 우선 검토한다.

### Follow-up boundaries

- External alert delivery adapter는 #240 범위다. 현재 layer는 alert candidate를 생성하고 structured log로 남긴다.
- Production KMS/secret adapter는 #232 또는 별도 secret management issue 범위다.
- Production EXPLAIN/IOPS/load-test baseline은 운영 관측 issue에서 다룬다.

## Queue claim and disposal hardening

- `ArchiveJob` due processing은 `apps/api/prisma/sql/claimRetentionArchiveJobs.sql`의 TypedSQL `FOR UPDATE SKIP LOCKED` query로 bounded claim한다.
  - 기본 batch size는 `50`, 최대값은 `100`이다.
  - claim lease 기본값은 `5분`이며, claim 시 `nextRunAt`을 lease 만료 시각으로 이동해 다른 worker의 즉시 중복 처리를 막는다.
  - owner code는 `archive-jobs/archive-job.repository.ts`와 `archive-jobs/archive-job-runner.service.ts`다.
- `RetentionReviewJob` due processing은 `apps/api/prisma/sql/claimRetentionReviewJobs.sql`의 TypedSQL `FOR UPDATE SKIP LOCKED` query로 bounded claim한다.
  - 기본 batch size는 `50`, 최대값은 `100`, claim lease 기본값은 `5분`이다.
  - owner code는 `review-jobs/retention-review-job-runner.service.ts`다.
- `RetentionAccessLog` disposal은 `apps/api/prisma/sql/disposeDueRetentionAccessLogs.sql`의 TypedSQL CTE update로 due rows를 bounded/minimized 처리한다.
  - 기본 disposal batch size는 `100`, 최대값은 `500`이다.
  - access log disposal은 raw retained payload를 읽지 않고 metadata field만 최소화한다.
- `RetainedIdentity`와 `RetainedVaultObject` disposal은 bounded Prisma scan + conditional `updateMany`로 idempotent하게 처리한다.
  - 기본 disposal batch size는 `100`, 최대값은 `500`이다.
  - schema에 별도 claim column이 없으므로 duplicate worker race는 conditional update count로 흡수한다.

## Hard rules

- Product/user-facing read path는 `RetainedVaultObject` 원문 payload를 복원하지 않는다.
- Realtime event, cache, search/detail API, profile/match/chat response mapper는 retained vault payload를 source로 사용하지 않는다.
- 일반 API runtime credential은 RRPD raw payload와 retained identity identifier payload를 직접 SELECT/WRITE하지 않는다.
- Disclosure는 `accessedBy`, `accessReason`, `approvalReference`, `purpose`를 요구하고 `RetentionAccessLog`를 남긴다.
- 운영 metric/log/alert는 structured count/status/errorCode 중심으로 남기며 retained payload 원문, identifier payload, decrypt 결과를 포함하지 않는다.
- `ArchiveJob`은 domain payload transformation job이다. `RetainedIdentity` 자체를 archive target으로 되돌리지 않는다.
- 새 shared retention contract가 필요하면 `packages/shared/src/retention/**` nested-only layout을 사용한다. `packages/shared/src/retention-contract.ts`나 `packages/shared/src/compat/retention-contract.ts`를 만들지 않는다.
- 새 `forwardRef()`로 retention/domain/lifecycle boundary를 봉합하지 않는다.
- Production KMS adapter, BackOffice disclosure API/UI, SELECT-level DB audit, external alert delivery adapter는 retention core port/adapter boundary 뒤에 붙인다.

## Architecture guard

- Root production file은 module surface 중심으로 유지한다. Command/query/policy/repository/adapter/spec은 owning slice 내부에 둔다.
- RetentionModule provider/export wiring은 `composition/retention.providers.ts`, `composition/retention.exports.ts`, `composition/retention.tokens.ts`가 소유한다.
- Cross-domain import/layout guard는 `apps/api/test/architecture/**`가 소유한다.
- Product domain은 retained payload parser/disclosure concrete implementation을 import하지 않는다.
- Lifecycle은 retention observability concrete provider를 직접 소유하지 않고 `RetentionModule`의 exported port를 주입받는다.
- Lifecycle sweep task execution은 broad users service가 아니라 retention sweep port로 수렴한다.
- Retention root production file은 `retention.module.ts`만 둔다. Observability, archive/review/access-log/disclosure/vault 책임은 각 owning slice 내부에 둔다.

## Where to change retention behavior

- Archive job claim/retry/manual-review transition: `archive-jobs/archive-job-runner.service.ts`, `archive-jobs/archive-job.repository.ts`, `archive-jobs/archive-job-transition.policy.ts`.
- Archive job claim SQL: `apps/api/prisma/sql/claimRetentionArchiveJobs.sql`.
- Archive job creation and payload shape: `archive-jobs/create-deletion-archive-jobs.command.ts`, `archive-jobs/archive-job.payload.ts`.
- Archive target registry/dispatch only: `archive-jobs/targets/archive-target-handlers.ts`. Source row transformation은 각 owner domain handler에서 수정한다.
- Retained identity decision/hold priority: `retained-identities/retained-identity-decision.policy.ts`.
- Retained identity snapshot transaction: `retained-identities/create-retained-identity-snapshot.command.ts`.
- Retained identity metadata validation: `retained-identities/retained-identity-metadata.validator.ts`.
- Retained identity identifier cipher/env key lookup: `retained-identities/retained-identity-cipher.ts`.
- Retained identity disclosure/disposal behavior: `retained-identities/retained-identity-disclosure.service.ts`, `retained-identities/retained-identity-disposal.service.ts`.
- Retained vault retain/disclose/dispose and payload codec: `vault/`.
- Retention case/hold updates: `vault/retention-case.repository.ts` and `vault/retained-vault.service.ts`.
- Retained vault keyring/env key lookup: `vault/retained-vault-keyring.ts`.
- Retained vault payload parser/codec rules: `vault/retained-vault-payload-codecs.ts`.
- Retained vault retain/disclose/dispose behavior: `vault/retained-vault.service.ts`.
- Retention payload encryption envelope: `crypto/retention-cipher.ts`.
- Access log create/disposal behavior: `access-logs/create-retention-access-log.command.ts`, `access-logs/retention-access-log-disposal.service.ts`, `access-logs/retention-access-log-disposal-review.command.ts`.
- Access log disposal SQL: `apps/api/prisma/sql/disposeDueRetentionAccessLogs.sql`.
- Identity-link review scheduling/retry transition: `review-jobs/schedule-chat-identity-link-review-job.command.ts`, `review-jobs/retention-review-job-runner.service.ts`, `review-jobs/retention-review-job-transition.policy.ts`.
- Retention review job claim SQL: `apps/api/prisma/sql/claimRetentionReviewJobs.sql`.
- Chat retained body tombstone/disclosure/identity-link minimization: `apps/api/src/chat/retention/conversation-retained-body.service.ts`.
- Archive target source row transformations: users identity, season-participants, matches, chat `retention/` handlers listed above.
- Retention sweep facade used by lifecycle: `application/`.
- Backlog snapshot, metric, alert candidate signal: `observability/`.
- Encryption helper/keyring adapter: `crypto/` and `vault/` keyring boundary.
- DB credential provider ownership: `apps/api/src/platform/database`.
- Lifecycle cron/sweep trigger ownership: `apps/api/src/lifecycle`.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=50% \
  src/architecture/retention-boundary.spec.ts \
  src/architecture/module-boundary.spec.ts \
  src/retention
pnpm api:typecheck
pnpm exec prettier --check \
  apps/api/src/retention/README.md \
  docs/policies/data-retention.md \
  docs/policies/service-boundary.md
git diff --check
```
