# Retention API module architecture

이 문서는 `apps/api/src/retention`의 server-side RRPD retention boundary map이다. Retention은 삭제·비식별화 이후에도 제한된 목적과 기간 안에서 보존해야 하는 payload, disclosure, access log, review/disposal job을 다룬다.

## Public boundary

외부 domain production code는 retention 내부 owner 구현을 직접 import하지 않는다. 필요한 기능은 목적별 module/port surface를 통해 사용한다.

- `RetentionModule`: retention worker/disclosure/observability provider wiring의 module surface다.
- `RETENTION_OBSERVABILITY_PORT`: lifecycle sweep result를 metric/alert candidate signal로 변환하는 observability surface다.
- `RETENTION_SWEEP_PORT`: lifecycle sweep이 archive/review/disposal job을 실행할 때 사용하는 narrow surface다.
- `RETENTION_VAULT_PORT`: domain-owned archive handler가 원문 payload를 retained vault에 보관하거나 disposal 상태를 갱신할 때 사용하는 retained payload surface다.
- `RETENTION_DISCLOSURE_PORT`: 승인 근거가 있는 운영 disclosure workflow만 사용하는 retained payload/identifier disclosure surface다.
- `ARCHIVE_TARGET_HANDLER_PORT`: `ArchiveJob` target별 domain-owned handler registry surface다.
- `RetentionWorkerPrismaService`와 `RetentionDisclosurePrismaService`: DB credential boundary다. 일반 API runtime credential은 RRPD raw payload/identifier payload를 직접 읽거나 쓰는 owner가 아니다.

## Directory responsibilities

- `application/`: lifecycle/backoffice/domain composition이 사용하는 public use-case service와 port definition. Product read/write API facade bucket을 두지 않는다.
- `archive-jobs/`: `ArchiveJob` queue claim, retry, manual-review transition, target handler registry. Target별 source row semantics는 handler owner domain에 둔다.
- `retained-identities/`: 삭제 계정 identifier anchor decision, snapshot, disclosure, disposal, metadata validation. User-facing display identity owner가 아니다.
- `vault/`: `RetentionCase`, `RetainedVaultObject`, hold, payload retain/disclose/dispose, payload codec, vault keyring owner.
- `access-logs/`: retained identity/vault disclosure 접근 로그 생성과 disposal scheduling owner.
- `review-jobs/`: identity-link review, due review retry, review handler registry owner.
- `crypto/`: retention payload encryption helper와 payload envelope format. Production key custody adapter는 이 boundary의 adapter로 붙는다.
- `observability/`: backlog snapshot, structured metric, alert candidate signal. Retained payload 원문을 로그/metric에 넣지 않는다.
- `composition/`: RetentionModule provider/export/token source of truth. Module decorator에서 긴 provider list를 직접 소유하지 않는다.
- `contracts/`: retention behavior regression spec. Cross-domain layout/import fitness는 `apps/api/src/architecture/`가 소유한다.
- `test-support/`: retention unit/integration fixture와 builder.

## Domain-owned archive handlers

Retention core는 queue/case/vault/access-log/review/disclosure boundary를 소유한다. Source row의 의미와 redaction/tombstone/minimization 규칙은 원래 domain handler가 소유한다.

- users identity: nickname audit, academic identity audit archive handler.
- season-participants: season profile history archive handler.
- matches: match history archive handler.
- chat: thread retention, retained message body tombstone/disclosure handler.

이 구분은 같은 용어가 domain마다 다른 bounded context를 가질 수 있기 때문이다. Retention root가 chat/matches/users/season-participants의 policy와 write semantics를 흡수하지 않는다.

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
- Cross-domain import/layout guard는 `apps/api/src/architecture/**`가 소유한다.
- Product domain은 retained payload parser/disclosure concrete implementation을 import하지 않는다.
- Lifecycle은 retention observability concrete provider를 직접 소유하지 않고 `RetentionModule`의 exported port를 주입받는다.
- Lifecycle sweep task execution은 broad users service가 아니라 retention sweep port로 수렴한다.
- Current transition surface에는 root owner files가 남아 있을 수 있다. 신규 수정은 위 owning slice와 public boundary로 수렴시킨다.

## Where to change retention behavior

- Archive job claim/retry/manual-review transition: `archive-jobs/`.
- Archive target handler registry and target payload dispatch: `archive-jobs/` + 각 owner domain의 `retention/` handler.
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
- Identity-link review scheduling/retry/handler: `review-jobs/schedule-chat-identity-link-review-job.command.ts`, `review-jobs/retention-review-job-runner.service.ts`, `review-jobs/retention-review-job-transition.policy.ts`.
- Retention sweep facade used by lifecycle: `application/`.
- Backlog snapshot, metric, alert candidate signal: `observability/`.
- Encryption helper/keyring adapter: `crypto/` and `vault/` keyring boundary.
- DB credential provider ownership: `apps/api/src/platform/database`.
- Lifecycle cron/sweep trigger ownership: `apps/api/src/lifecycle`.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/retention-boundary.spec.ts \
  src/architecture/module-boundary.spec.ts \
  src/retention
pnpm api:typecheck
pnpm exec prettier --check \
  apps/api/src/retention/README.md \
  docs/04_policy/official/data-retention.md \
  docs/04_policy/official/service-boundary.md
git diff --check
```
