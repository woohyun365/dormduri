# Lifecycle API module architecture

이 문서는 `apps/api/src/lifecycle` 내부 책임 경계, public surface, directory ownership, 수정 위치를 빠르게 찾기 위한 server-side lifecycle boundary map이다. Lifecycle은 제품 domain 정책을 소유하지 않고, 이미 존재하는 domain sweep port를 app-level scheduler에서 수렴시키는 orchestration module이다.

## Public boundary

외부 domain은 lifecycle concrete runner internals를 import하지 않는다. App/root scheduler가 필요한 surface는 아래로 제한한다.

- `LifecycleModule`: app-level periodic/boundary sweep wiring을 제공한다.
- `LifecycleSweepService`: application bootstrap 후 sweep interval/season boundary cron job을 등록하고, manual/test sweep 실행 entrypoint를 제공한다.
- `LIFECYCLE_SWEEP_TASKS`: ordered domain sweep task list를 composition하는 DI token이다.
- `LIFECYCLE_BOUNDARY_SCHEDULE`: season boundary schedule provider token이다.
- `LifecycleSweepTaskPort`: domain task adapter가 구현하는 port다. task별 DB transaction/ACID 책임은 owning domain service에 남는다.
- Retention observability emission은 `RetentionModule`이 export하는 `RETENTION_OBSERVABILITY_PORT`를 통해 연결한다.
- Retention archive/review/disposal sweep은 `RetentionModule`이 export하는 `RETENTION_SWEEP_PORT` narrow surface를 통해 연결한다.
- Social-safety bookmark expiration cleanup과 auth operational cleanup은 각 owning service를 lifecycle task adapter로 감싼다.

## Directory responsibilities

- `lifecycle.module.ts`: explicit imports와 lifecycle provider composition. Common/global fallback으로 dependency를 숨기지 않는다.
- `lifecycle-sweep.service.ts`: Nest scheduler integration, bootstrap/destroy lifecycle, periodic/boundary trigger, concurrent run guard.
- `lifecycle-sweep-runner.ts`: ordered task execution, database clock 기준 `now` resolution, retention observability emission. Nest module graph나 domain policy를 소유하지 않는다.
- `lifecycle-sweep-task.port.ts`: sweep task contract. 각 domain adapter는 `name`, `order`, `run(now)` 형태로 수렴 작업을 제공한다.
- `lifecycle-boundary-schedule.port.ts`: season/date boundary cron job contract.
- `lifecycle-sweep.tokens.ts`: DI token owner.
- `lifecycle-sweep.types.ts`: sweep result/task result type owner.
- `adapters/lifecycle-sweep-tasks.adapter.ts`: matches/chat/season-participants/social-safety/retention/auth domain service·port를 ordered task port로 감싸는 composition adapter.
- `adapters/season-boundary-schedule.adapter.ts`: season boundary schedule을 lifecycle port로 감싸는 adapter.

## Hard rules

- Lifecycle은 product policy를 직접 구현하지 않는다. match transition, chat cutoff, participant backfill, auth cleanup, retention disposal/retry 정책은 owning domain service/repository가 소유한다.
- Lifecycle runner/service는 `MatchesService`, `UsersService`, `SeasonParticipantsService`, `AuthOperationalCleanupService`, `ChatService` 같은 concrete domain service를 직접 import하지 않는다. Concrete wiring은 adapter/module composition에 둔다.
- 한 task 실패/observability 실패가 전체 app lifecycle을 불필요하게 깨지 않도록 fail-safe boundary를 유지한다. 단, 각 task의 product consistency 책임은 owning domain이 검증한다.
- `RetentionWorkerPrismaService`는 retention/auth cleanup 실행 credential boundary로 유지한다. 새 DB role을 추가할 때는 RDS connection budget과 grant spec을 먼저 갱신한다.
- 새 `forwardRef()`나 business `@Global()` module로 cycle을 숨기지 않는다.
- User-facing product behavior, response/error code, route policy는 lifecycle refactor로 변경하지 않는다.

## Current combined runtime

- 현재 하나의 Nest API process가 HTTP·Socket.IO serving과 enabled background 작업을 함께 소유한다. 별도 worker binary,
  `WorkerModule`, headless entrypoint 또는 worker deployment는 없다. Combined는 현재 구성을 설명하는 말이지 새 runtime-role
  enum이나 환경변수가 아니다.
- `LIFECYCLE_SWEEP_ENABLED`는 이 process 안의 자동 sweep 등록 스위치다. 기본값은 test에서 false, 그 외에는 true이며,
  false로 바꿔도 serving을 분리하거나 다른 process로 sweep을 이전하지 않는다. 별도 worker가 없는 상태에서 끄면 자동
  lifecycle sweep도 실행되지 않는다.
- `LifecycleSweepService.running`은 같은 service instance의 scheduled periodic/boundary sweep 중복 진입만 억제한다.
  Public/manual `runSweep`, `runPeriodicSweep`, `runBoundarySweep`는 이 guard를 거치지 않는다.
- Destroy는 이 instance를 closing으로 전환하고 현재 periodic interval과 lifecycle boundary cron을 제거한다.
  Pending schedule refresh와 이후 scheduled entry도 새 timer를 등록하지 않는다. 이미 진입한 sweep의 drain/cancel은
  보장하지 않으며 public/manual runner의 실행 의미는 바꾸지 않는다.
- `ArchiveJob`/`RetentionReviewJob`의 `FOR UPDATE SKIP LOCKED` claim은 해당 queue row의 DB 동시성 경계다. 이를 모든
  lifecycle task의 global single-run 또는 exactly-once 보장으로 확대하지 않는다. `RetentionWorkerPrismaService`도
  credential boundary이지 별도 worker process의 증거가 아니다.
- API instance를 늘리면 각 enabled instance에 scheduler가 생긴다. 활성화 전에 workload별 idempotency·lease·retry·
  shutdown과 `DATABASE_POOL_MAX`, active Prisma role 수, DB connection/IOPS budget을 별도로 검증한다.

상태별 owner·reset·multi-instance 한계와 분리 재검토 조건은
[Runtime composition and process state](../../../../docs/architecture/backend/runtime-composition-and-process-state.md)가 소유한다.

## Architecture guard

Lifecycle boundary는 `apps/api/test/architecture/platform/module-boundary.spec.ts`,
`apps/api/test/architecture/cross-domain/chat-boundary.spec.ts`가 고정한다. Combined runtime의 source/documentation 정합성은
`apps/api/test/architecture/platform/runtime-process-state-boundary.spec.ts`가 검사한다. 정적 guard는 실제 배포나 전체
concurrency/shutdown 동작의 증거가 아니다.

- `common/lifecycle`은 재생성하지 않는다.
- `LifecycleModule`은 affected owner modules를 explicit import한다.
- `RetentionModule`은 retention observability provider/export owner이며, lifecycle은 retention concrete provider를 직접 등록하지 않는다.
- `LifecycleSweepService`와 runner는 domain concrete service names를 직접 소유하지 않는다.
- Match lifecycle은 `MATCH_LIFECYCLE_SWEEP_PORT`, match history는 `MATCH_HISTORY_MATERIALIZATION_PORT`, chat lifecycle은 `CHAT_LIFECYCLE_SWEEP_PORT`, match/chat/season side effect는 narrow port surface를 통해 연결한다.
- `forwardRef()` regression은 금지한다.

## Where to change lifecycle behavior

- Sweep interval enable/disable/config wiring: `config/lifecycle.config.ts`,
  `config/lifecycle.env.ts`, `lifecycle-sweep.service.ts`.
- Scheduler bootstrap, interval registration, boundary cron registration/removal: `lifecycle-sweep.service.ts`.
- Ordered task execution and retention observability emission: `lifecycle-sweep-runner.ts`.
- Task ordering or task list composition: `adapters/lifecycle-sweep-tasks.adapter.ts` and `lifecycle.module.ts`.
- Season boundary job calculation: `adapters/season-boundary-schedule.adapter.ts`.
- Individual product convergence behavior: owning domain service/adapter, not lifecycle runner. Match active lifecycle convergence lives in `matches/active/lifecycle` behind `MATCH_LIFECYCLE_SWEEP_PORT`.
- Retention sweep contract: `retention/application/ports/retention-sweep.port.ts` and `retention/application/retention-sweep.service.ts`.
- Bookmark expiration cleanup contract: `social-safety/bookmarks/application/bookmark-lifecycle.service.ts`.
- Auth operational cleanup behavior: `auth/operations`.
- Sweep result type shape: `lifecycle-sweep.types.ts`.

## Useful verification

```bash
pnpm --dir apps/api exec vitest run --config ./vitest.config.unit.ts --maxWorkers=2 \
  src/lifecycle \
  test/architecture/platform/module-boundary.spec.ts \
  test/architecture/platform/runtime-process-state-boundary.spec.ts \
  test/architecture/cross-domain/chat-boundary.spec.ts
pnpm --dir apps/api exec vitest run --config ./vitest.config.integration.ts --maxWorkers=1 \
  test/integration/users/account-deletion.integration.spec.ts \
  test/integration/matches/match-history.integration.spec.ts \
  test/integration/seasons/season-transition.integration.spec.ts \
  test/integration/matches/unmatch.integration.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
