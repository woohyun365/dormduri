# Matches API module architecture

이 문서는 `apps/api/src/matches` 내부 책임 경계, public surface, transaction invariant, 수정 위치를 빠르게 찾기 위한 server-side boundary map이다.

Matches는 2인실 roommate match request, active match, unmatch, match history, score projection 노출 판단을 소유한다. Chat thread, roommate search read model, social-safety ledger, retention vault 자체는 각 owner의 source-of-truth를 유지하고 matches는 좁은 port나 read projection만 사용한다.

## Public boundary

외부 domain production code는 최종적으로 concrete `MatchesService`를 직접 import/inject하지 않는다. 목적별 port token을 통해 필요한 surface만 사용한다.

- `MatchesModule`: matches HTTP/controller, request/active/history/lifecycle provider wiring을 제공한다.
- `MATCH_ACTIVE_VIEW_PORT`: profiles/current-user/search 같은 consumer가 현재 active match snapshot과 participant별 active match map을 읽는 좁은 read surface다.
- `MATCH_LIFECYCLE_SWEEP_PORT`: top-level lifecycle sweep이 active match cutoff/season-end transition을 요청하는 surface다.
- `MATCH_HISTORY_MATERIALIZATION_PORT`: lifecycle/retention sweep이 match history materialization을 요청하는 surface다.
- `MATCH_BLOCK_SIDE_EFFECT_PORT`: social-safety block transaction이 affected pending match request cancel을 요청하는 side-effect surface다.
- `MATCH_SCORE_PROJECTION_PORT`: profiles/bookmarks 같은 consumer가 score visibility와 query-time score 계산을 요청하는 matches-owned score surface다.

외부 consumer는 concrete `MatchesService`에 의존하지 말고 위 port surface를 사용한다. `application/matches.service.ts`의 `MatchesService`는 matches HTTP/controller facade이며, history materialization/read 구현은 `history/` slice의 서비스와 repository가 소유한다.

## Owned responsibilities

- Match request create/list/accept/reject/cancel behavior.
- Active match read, unmatch request/cancel, room-selection cutoff와 season-end lifecycle transition.
- ActiveMatch lifecycle event log as append-only audit/debug trace for active relation state transitions.
- Match history materialization, read projection, deleted/deidentified counterpart tombstone, RRPD archive handoff.
- `perspectiveScore(viewer, target)` 기반 score projection consumption/exposure decision.
- External domain이 필요한 최소 match view/lifecycle/history/block side-effect port 제공.
- Match-specific user-facing error contract and response projection.

## Non-responsibilities

- Chat thread creation/reopen/read-marker/message write lifecycle. Chat domain owns conversation thread/message source-of-truth.
- Roommate search full read model/materialized projection and detail-entry token behavior. Profiles/search owner owns candidate discovery surface.
- Social-safety block/report ledger and moderation review queue. Matches only receives match-specific side-effect requests through a port.
- BackOffice/admin UI and admin workflow screens.
- Redis/cache correctness. Postgres transaction and row/advisory locks remain the correctness boundary.
- 3-person/group matching. Current matches module is scoped to 2-person match semantics.

## Directory responsibilities

Final root production files stay small:

- `matches.module.ts`: module imports/controllers/provider-export summary only.
- `matches.controller.ts`: HTTP route parsing/delegation only.
- `README.md`: this boundary map.

Final subdirectory targets:

- `composition/`: `MatchesModule` provider/export grouping.
- `application/`: controller-facing `MatchesService` facade and application-level orchestration surfaces that are not public exports.
- `application/ports/`: public port tokens and interfaces for external consumers.
- `context/`: active match/domain route context decorator, guard, resolver, and request context type.
- `requests/`: match request create/list/accept/reject/cancel command, query, policy, preparation, presenter, repository.
- `active/`: active match read, unmatch command/policy/persistence, lifecycle transition, active-match presenter/repository, lifecycle event trace.
- `active/lifecycle-events/`: ActiveMatch lifecycle event metadata allowlist, repository, writer, and no-PII tests.
- `history/`: ended-season history materialization, source loading, row/score snapshot builders, persistence repository, read query/presenter, deleted/deidentified tombstone, RRPD archive handler.
- `scoring/`: API-owned match score algorithm, projection, and exposure decision. Shared package는 score algorithm을 소유하지 않는다.
- `lifecycle/`: cross-domain side-effect implementations such as block side-effect and lifecycle sweep adapter.
- `persistence/`: shared Prisma/TypedSQL infrastructure only when it is not owned by a narrower slice.
- `errors/`: user-facing matches error contract.
- `contracts/`: API-local shared match contract behavior regression specs when needed; shared package source-of-truth layout specs stay under architecture.

## Transaction and concurrency invariants

- Create/accept/reject/cancel/unmatch paths keep Serializable transaction semantics where the current behavior relies on atomic state convergence.
- Participant pair, requester/receiver, and active match mutation paths keep advisory lock boundaries to serialize pair/action races.
- `apps/api/prisma/sql/lockMatchRequestRow.sql` and `apps/api/prisma/sql/lockActiveMatchRow.sql` remain row-lock source-of-truth for request/active-match updates.
- Create/accept/unmatch commands recheck stale state inside the transaction after locks are acquired.
- ActiveMatch lifecycle event append must happen inside the same Prisma transaction as the state mutation it explains.
- Pending request expiration, room-selection cutoff, hidden/deactivated/withdrawn/expired/deleted/deidentified participant state, active match presence, and target visibility are fail-closed.
- Redis/cache may be introduced only as an optimization/metric gate; it is not a correctness source for match state transitions.

## Query/index and RDS cost guardrails

- Match request list reads are participant-facing hot reads. Requester/receiver list paths have dedicated `seasonId + participantId + createdAt + id` indexes so `createdAt desc, id desc` ordering stays stable without changing response shape.
- Pending request expiration keeps both global `expiresAt + status` and season-scoped `seasonId + status + expiresAt` indexes. Global lifecycle sweeps and season-local request actions therefore do not compete for one ambiguous index shape.
- Same-pair pending duplicate checks use canonical `pairKey` with `seasonId + pairKey + status`; `pairMinParticipantId` / `pairMaxParticipantId` remain persisted audit/query fields, not the duplicate-check index owner.
- Active match participant lookups continue to rely on participant-specific active indexes because `SeasonParticipant` ids are season-scoped. The all-active lifecycle sweep has a separate `status + endedAt + startedAt + id` index for deterministic batch ordering.
- Match history user reads have a viewer-centric `viewerParticipantId + finalizedAt + createdAt + id` index. Whole-season history rebuild remains `deleteMany + createMany` for idempotency and simplicity; bounded rebuild should be introduced only after production-like season size, lock time, or IOPS evidence shows the need.
- Local schema/index changes do not claim production RDS p95 or IOPS improvements by themselves. Production-like `EXPLAIN`, CloudWatch thresholds, and bounded materialization triggers belong in operational follow-up work.

## External domain boundaries

- `seasons` / `season-participants`: provide current season, dormitory `roomSelectionDate`, registration/visibility/profile-complete inputs. Matches evaluates matchability for request/active/history flows, but does not own season registration.
- `chat`: matches calls chat lifecycle ports on accept/unmatch/season transition. Chat owns thread/message/read-marker persistence and realtime outbox payloads.
- `profiles` / `roommate-search` / `current-user`: consume active match and score/history projections through narrow read surfaces. They do not mutate match tables directly.
- `social-safety`: owns block/report ledger. Block create may request pending match request cancellation through `MATCH_BLOCK_SIDE_EFFECT_PORT`; active match termination remains explicit match/admin policy work.
- `retention`: owns retained vault and disclosure jobs. Matches owns match-history archive handler input/output and never keeps retained payload in hot user-facing history rows.
- `shared`: final match DTO/schema contracts live under `packages/shared/src/match/**` and public imports use `@repo/shared/match` / `@repo/shared/match/contract`. Root flat `@repo/shared/{match-contract,match-score,match/score}` compatibility paths are not final architecture.

## ActiveMatch lifecycle event log

`ActiveMatchLifecycleEvent` is an internal operations/audit/debug trace for active relation state transitions. It does not replace `ActiveMatch` current-state, `ActiveMatchUnmatchRequest`, `SeasonMatchHistoryEntry`, or chat-owned thread/message state as user-facing sources of truth. The event log must not be used as event sourcing, replay, or read-model rebuild input.

Append points stay with the mutation owner and the same Prisma transaction:

| Event                                      | Owner path                                                                                                          | Transaction rule                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `ACTIVE_CREATED`                           | `requests/commands/accept-match-request.command.ts` + `requests/persistence/match-request-acceptance.repository.ts` | append after `activeMatch.create` succeeds in the accept transaction |
| `UNMATCH_REQUESTED`                        | `active/commands/request-unmatch.command.ts` + `active/persistence/active-match.repository.ts`                      | append after pending unmatch request create succeeds                 |
| `UNMATCH_REQUEST_CANCELLED`                | `active/commands/cancel-unmatch-request.command.ts` + `active/persistence/active-match.repository.ts`               | append after viewer pending request terminal update succeeds         |
| `UNMATCHED`                                | `active/commands/request-unmatch.command.ts` + `active/persistence/active-match.repository.ts`                      | append after mutual terminal `ActiveMatch.UNMATCHED` update succeeds |
| `UNMATCH_REQUEST_EXPIRED` / `SEASON_ENDED` | `active/lifecycle/active-match-lifecycle-sweep.service.ts`                                                          | append only for rows actually transitioned by the sweep              |

Metadata is allowlist-only. Do not store raw match request notes, profile/lifestyle bodies, chat body/retained payload, email/token/phone/provider credentials, raw HTTP bodies, stack traces, raw Prisma errors, internal audit payloads, or full identity snapshots.

## Where to change match behavior

| Behavior                     | Current source                                                                                                        | Final target                                                                                                | Notes                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| HTTP route delegation        | `matches.controller.ts`                                                                                               | `matches.controller.ts`                                                                                     | Controller stays root-only and delegates to application/provider surface.                         |
| Provider/export composition  | `matches.module.ts`                                                                                                   | `composition/` + `matches.module.ts`                                                                        | Module decorator should read as imports/controllers/provider-export summary.                      |
| Request create/list          | `requests/commands`, `requests/queries`, `requests/eligibility`, `requests/policies`, `requests/persistence`          | `requests/commands`, `requests/queries`, `requests/policies`, `requests/presenters`, `requests/persistence` | Keep requestability and stale-state checks close to command/repository boundary.                  |
| Request accept/reject/cancel | `requests/commands`, `requests/policies`, `requests/persistence`, `requests/presenters`                               | `requests/commands`, `requests/policies`, `requests/persistence`                                            | Accept path must preserve chat lifecycle port call inside the transaction.                        |
| Active match read/context    | `active/queries`, `active/presenters`, `context/match-context.resolver.ts`, `active/context/*`                        | `active/queries`, `active/presenters`, `context/`, `active/context/`                                        | Context guard/resolver prepares coarse context; action-specific rules stay in command/policy.     |
| Unmatch request/cancel       | `active/commands`, `active/policies`, `active/persistence`                                                            | `active/commands`, `active/policies`, `active/persistence`                                                  | Preserve active row lock, mutual unmatch transaction, and chat lifecycle port call.               |
| Lifecycle sweep              | `active/lifecycle/active-match-lifecycle-sweep.service.ts`, `MATCH_LIFECYCLE_SWEEP_PORT`                              | `active/lifecycle`, `MATCH_LIFECYCLE_SWEEP_PORT`                                                            | Top-level lifecycle depends on the port, not concrete `MatchesService`.                           |
| Active lifecycle events      | `active/lifecycle-events`, `requests/commands/accept-match-request.command.ts`, `active/commands`, `active/lifecycle` | `active/lifecycle-events`                                                                                   | Audit/debug trace only; append in same transaction as the mutation; not event sourcing.           |
| History materialization      | `history/application/match-history-materialization.service.ts`, `history/materialization`, `history/persistence`      | `history/application`, `history/materialization`, `history/persistence`                                     | Retained payload stays out of hot user-facing history rows.                                       |
| History read                 | `history/application/match-history-query.service.ts`, `history/presenters/match-history.presenter.ts`                 | `history/application`, `history/presenters`                                                                 | Deleted/deidentified counterpart detail degrades to tombstone.                                    |
| Score projection             | `scoring/match-score.algorithm.ts`, `scoring/match-score-projection.ts`, `MATCH_SCORE_PROJECTION_PORT`                | `scoring/`, `application/ports/match-score-projection.port.ts`                                              | `perspectiveScore(viewer, target)` algorithm은 API matches-owned; shared는 DTO/schema만 소유한다. |
| Transaction locks/selects    | `requests/persistence`, `active/persistence`, `persistence/match-pair-identity.ts`, `apps/api/prisma/sql/lock*.sql`   | owning slice `*/persistence`                                                                                | TypedSQL, pair identity, and Prisma select shapes stay infrastructure-local.                      |
| User-facing errors           | `errors/matches.errors.ts`                                                                                            | `errors/`                                                                                                   | Refactor must not change response/error code behavior.                                            |
| Block side-effect            | `lifecycle/match-block-side-effect.service.ts`, `application/ports/match-block-side-effect.port.ts`                   | `lifecycle/`, `application/ports/`                                                                          | Social-safety consumes the port; match request mutation remains match-owned.                      |

## Architecture guard expectation

Architecture guards should enforce the final product shape as refactor phases land.

- Root production TypeScript files are limited to `matches.module.ts`, `matches.controller.ts`, and `README.md`.
- Root spec files are limited to controller behavior only after specs are moved to owning slices or architecture.
- External production code does not import `matches/matches.service`.
- `MatchesModule` exports narrow ports instead of concrete `MatchesService`.
- ActiveMatch lifecycle event writer/repository remain matches-internal and are not exported or imported by external domains.
- Pure policies do not import Nest providers, `PrismaService`, or mutable infrastructure.
- `social-safety`, `profiles`, `users`, `lifecycle`, and `retention` do not mutate `matchRequest`/`activeMatch` tables directly outside match-owned ports.
- Shared match imports use nested `@repo/shared/match` surfaces, not root flat compatibility exports.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/module-boundary.spec.ts \
  src/architecture/cross-domain-chat-boundary.spec.ts \
  src/architecture/social-safety/social-safety-boundary.spec.ts \
  src/matches/application/matches.service.spec.ts \
  src/matches/matches.controller.spec.ts \
  src/matches/history/materialization/match-history-row.builder.spec.ts \
  src/matches/history/materialization/match-history-score-snapshot.builder.spec.ts \
  src/matches/history/application/match-history-materialization.service.spec.ts \
  src/matches/history/application/match-history-query.service.spec.ts \
  src/matches/history/presenters/match-history.presenter.spec.ts \
  src/matches/active/presenters/active-match.presenter.spec.ts \
  src/matches/requests/commands/match-request-command-flow.spec.ts \
  src/matches/active/commands/unmatch-command-flow.spec.ts \
  src/matches/requests/policies/match-request-expiration.policy.spec.ts \
  src/matches/persistence/match-pair-identity.spec.ts \
  src/matches/scoring/match-score-projection.spec.ts \
  src/matches/scoring/match-score.algorithm.spec.ts \
  src/matches/active/context/active-match-context.guard.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
