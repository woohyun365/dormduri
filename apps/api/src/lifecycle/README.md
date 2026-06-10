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

## Operational worker count

- 현재 별도 worker binary는 없고, 같은 Nest app instance가 `LIFECYCLE_SWEEP_ENABLED=true`로 뜨면 lifecycle worker로 동작한다.
- 따라서 운영상 worker 개수는 `LIFECYCLE_SWEEP_ENABLED=true`인 BE/API docker instance 개수와 같다.
- 초기 운영은 API serving instance는 `LIFECYCLE_SWEEP_ENABLED=false`, 별도 worker deployment 1개만 `true`로 두는 구성을 우선한다.
- `ArchiveJob`/`RetentionReviewJob`은 retention TypedSQL claim이 `FOR UPDATE SKIP LOCKED`를 사용하므로 worker instance를 2개 이상으로 늘려도 같은 queue row를 중복 claim하지 않아야 한다.
- worker instance를 늘릴 때는 `DATABASE_POOL_MAX`, active Prisma role 수, RDS connection/IOPS budget을 함께 계산한다.

## Architecture guard

Lifecycle boundary는 `apps/api/src/architecture/common-boundary.spec.ts`, `apps/api/src/architecture/module-boundary.spec.ts`, `apps/api/src/architecture/cross-domain-chat-boundary.spec.ts`가 고정한다.

- `common/lifecycle`은 재생성하지 않는다.
- `LifecycleModule`은 affected owner modules를 explicit import한다.
- `RetentionModule`은 retention observability provider/export owner이며, lifecycle은 retention concrete provider를 직접 등록하지 않는다.
- `LifecycleSweepService`와 runner는 domain concrete service names를 직접 소유하지 않는다.
- Chat lifecycle은 `CHAT_LIFECYCLE_SWEEP_PORT`, match/chat/season side effect는 narrow port surface를 통해 연결한다.
- `forwardRef()` regression은 금지한다.

## Where to change lifecycle behavior

- Sweep interval enable/disable/config wiring: `config/lifecycle.config.ts`, `lifecycle-sweep.service.ts`.
- Scheduler bootstrap, interval registration, boundary cron registration/removal: `lifecycle-sweep.service.ts`.
- Ordered task execution and retention observability emission: `lifecycle-sweep-runner.ts`.
- Task ordering or task list composition: `adapters/lifecycle-sweep-tasks.adapter.ts` and `lifecycle.module.ts`.
- Season boundary job calculation: `adapters/season-boundary-schedule.adapter.ts`.
- Individual product convergence behavior: owning domain service/adapter, not lifecycle runner.
- Retention sweep contract: `retention/application/ports/retention-sweep.port.ts` and `retention/application/retention-sweep.service.ts`.
- Bookmark expiration cleanup contract: `social-safety/bookmarks/application/bookmark-lifecycle.service.ts`.
- Auth operational cleanup behavior: `auth/operations`.
- Sweep result type shape: `lifecycle-sweep.types.ts`.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/lifecycle \
  src/architecture/common-boundary.spec.ts \
  src/architecture/module-boundary.spec.ts \
  src/architecture/cross-domain-chat-boundary.spec.ts
pnpm --dir apps/api exec jest --config ./test/jest-integration.json --watchman=false --runInBand \
  test/integration/account-deletion.integration.spec.ts \
  test/integration/match-history.integration.spec.ts \
  test/integration/season-transition.integration.spec.ts \
  test/integration/unmatch.integration.spec.ts
pnpm api:typecheck
pnpm --dir apps/api exec eslint <changed files without apps/api prefix>
git diff --check
```
