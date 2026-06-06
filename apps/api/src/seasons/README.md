# Seasons API module architecture

이 문서는 `apps/api/src/seasons`의 제품 책임 경계, source-of-truth, #208/#209 작업 범위를 빠르게 파악하기 위한 server-side boundary map이다.

## Public boundary

외부 domain은 `SEASON_CONTEXT_PORT` / `SeasonContextPort`를 통해 current season context만 사용한다. `SeasonsService`는 module 내부 controller/facade 구현체이며 외부 도메인의 concrete dependency가 아니다.

- `SeasonsModule`: public current season route와 season runtime provider wiring을 제공한다.
- `GET /api/seasons/current?campus=...`: 운영 캠퍼스의 사용자용 current season snapshot을 반환한다.
- `PATCH /api/campuses/:campusCode/seasons/:seasonId/schedule`: `admin:season:operations:write` capability가 있는 운영 actor만 특정 campus의 season schedule을 optimistic concurrency로 수정한다.
- `PATCH /api/campuses/:campusCode/seasons/:seasonId/override`: 특정 campus의 운영 override state/window/reason을 optimistic concurrency로 설정한다.
- `DELETE /api/campuses/:campusCode/seasons/:seasonId/override`: 특정 campus의 override를 해제하고 audit event를 남긴다.
- `SEASON_CONTEXT_PORT`: 외부 도메인의 public season context port다. current season context/state와 dormitory match window read만 제공한다.
- `SeasonsService`: `SeasonContextPort` 구현체이자 controller-facing facade다. Prisma/query-shape ownership 없이 runtime query provider에 위임한다.
- shared season response/contract는 `packages/shared/src/season/**`가 canonical owner다. Shared layout 정리는 dormitories/season-participants plan Phase 9 수행 여부와 충돌하지 않게 Phase 8에서 검증한다.

## Source of truth

- 정책 source of truth: `docs/04_policy/official/season-lifecycle.md`.
- 사용자용 current season은 운영 캠퍼스의 `Season` row 중 기준 시간이 `preparationStartDate` ~ `seasonEndDate`에 들어온 row에서 계산한다.
- future season row는 preview/operations 준비 데이터이며 사용자용 current season으로 승격하지 않는다.
- 활성 override는 선택된 current season row의 effective state 계산에만 적용한다. override는 schedule/history/audit 원장이 아니다.
- 운영 기숙사와 `roomSelectionDate`는 `SeasonDormitoryOperation`이 소유한다. 매칭 종료일은 운영 기숙사별 `roomSelectionDate`에서 계산하고, 시즌 종료는 campus `seasonEndDate`를 따른다.
- Postgres가 authoritative source다. #209 cache/memoization은 request/method-level 재사용 최적화이며 Redis/process cache는 관측된 병목이 생길 때 후속 issue로 다룬다.

## Current directory responsibilities

- `seasons.controller.ts`: public `GET /api/seasons/current` HTTP parsing, campus query validation, not-found mapping.
- `seasons.module.ts`: runtime query/repository provider와 `SEASON_CONTEXT_PORT` export wiring. Phase 7 이후 provider list가 커지면 composition 분리를 검토한다.
- `seasons.service.ts`: `SeasonContextPort` 구현체와 controller-facing facade. Prisma, query shape, reference time resolution을 직접 소유하지 않는다.
- `ports/`: 외부 도메인-facing season context port와 current season context type/helper export surface. 외부 도메인은 `runtime/`을 직접 import하지 않는다.
- `runtime/`: current season context query, dormitory match window query, Prisma repository, season state policy, current season response mapper, normalized runtime row type. seasons module 내부 구현 상세다.
- `platform/time/kst-date.ts`: season-neutral KST local-date helper. `season.utils.ts` compatibility re-export는 두지 않는다.
- `seasons.errors.ts`: user-facing seasons error contract.
- `operations/`: #208 schedule/override admin API controller, command, repository, audit repository, mapper, validation policy. mutation과 audit append는 같은 transaction 안에서 수행한다.
- `cache/`: #209 request/method-level current season context memoization helper. cache instance를 명시적으로 넘긴 logical operation 안에서만 재사용하며 process/Redis cache가 아니다.
- `contracts/`: shared season contract behavior regression spec.

## #208 operations scope

#208은 backend/API/domain 범위의 season operations hardening이다. BackOffice UI는 이 module 범위가 아니다.

포함:

- schedule/override backend operations route와 command.
- operations mutation은 route `campusCode + seasonId`를 모두 검증하며, `seasonId` 단독으로 다른 campus season을 수정하지 않는다.
- overlap/invalid date/invalid override window validation.
- optimistic concurrency 또는 equivalent lost-update guard.
- schedule/override mutation transaction.
- actor, reason, before/after snapshot을 포함한 operations audit append.
- audit payload는 operation 대상 `campusCode`, actor id/capability snapshot, changed field, before/after season snapshot만 저장하고 session/gender 같은 불필요한 actor metadata를 남기지 않는다.
- 운영 절차/incident 대응 README 또는 policy update.

제외:

- BackOffice rendering/hook/page/component.
- DB manual update를 정상 운영 path로 유지하는 것.
- override columns를 audit/history ledger로 사용하는 것.

## #209 cache scope

#209는 season context read의 비용을 줄이되 source-of-truth를 바꾸지 않는 작업이다.

포함:

- 한 logical operation/request 안에서 동일 `campusCode + referenceNow` current season context를 재사용하는 request/method-level memoization.
- cache key, invalidation point, stale read 허용 범위 문서화. cache를 넘기지 않는 기존 호출은 호출마다 DB source-of-truth를 다시 확인한다.
- cache hit/miss와 DB query count를 고정하는 targeted tests.

제외:

- Redis/process-local distributed cache 도입.
- stale season state를 product behavior로 허용하는 설계 변경.
- mutation 후 invalidation 없이 오래 남는 cache.

## Phase 7 observability scope

Phase 7은 새 운영 route를 늘리지 않고 server-side metric/log privacy guard만 추가한다. 운영 dashboard, CloudWatch alarm, external health endpoint 구성은 별도 infra 작업이다.

포함:

- `operations/season-operational-metrics.service.ts`: current season query duration, request cache hit/miss/no-cache count, schedule/override operation outcome을 process-local in-memory snapshot으로 기록한다.
- `runtime/current-season-context.query.ts`: request cache를 받은 logical operation의 hit/miss와 no-cache 호출을 metric hook으로 전달한다.
- schedule/override/clear command: success, conflict, not found, validation failure, audit failure outcome을 metric hook으로 전달한다.
- metric/log payload는 actor/session/reason/snapshot 원문을 포함하지 않는다. structured payload는 `action`, `campusCode`, `outcome`, `recordedAt` allowlist만 허용한다.

제외:

- `/health/seasons` 같은 상세 운영 endpoint 추가. 필요 시 protected capability route로만 별도 Phase/issue에서 추가한다.
- Redis/process cache 도입. Phase 7 metric은 병목 관측 근거를 쌓기 위한 hook이지 source-of-truth나 cache 전략 변경이 아니다.
- CloudWatch dashboard/alarm 실제 구성.

## Hard rules

- Phase 1 architecture guard 전에는 production file move/refactor를 시작하지 않는다.
- future season row만 있는 경우 사용자용 current season은 `null`이다.
- 비운영 캠퍼스는 사용자용 current season 리소스를 제공하지 않는다.
- override는 current state 계산에만 영향을 준다. schedule, operated dormitory, history, audit source-of-truth를 대체하지 않는다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- Web rendering/hook/page/component 작업은 seasons API module 범위가 아니다.

## Target direction

최종 구조는 runtime read, operations mutation, ports, cache를 분리한다.

- `runtime/`: current season query/repository/mapper/policy. Phase 2에서 policy/mapper/type split을 완료했고 Phase 3에서 query/repository provider split을 완료했다.
- `operations/`: #208 schedule/override commands, operations controller, audit repository.
- `ports/`: external domain-facing season context and boundary schedule ports. Phase 4에서 `SEASON_CONTEXT_PORT`가 canonical external read boundary가 되었다.
- `cache/`: #209 request/method-level memoization helper. `createSeasonContextCache()`는 한 request/logical operation 안에서만 생성/전달한다.
- `platform/time/`: KST date helper처럼 season-neutral time helper.

## Where to change

- Public current season route parsing: `seasons.controller.ts`.
- Admin operations route parsing: `operations/seasons-operations.controller.ts`.
- External season context consumption: `ports/season-context.port.ts`.
- Current runtime read behavior: `seasons.service.ts`, `runtime/`, `platform/time/kst-date.ts`.
- Schedule/override mutation and audit behavior: `operations/`.
- Request/method-level memoization: `cache/`, `runtime/current-season-context.query.ts`, `runtime/dormitory-match-window.query.ts`, `ports/season-context.port.ts`.
- Season runtime/operations observability: `operations/season-operational-metrics.service.ts`, `runtime/current-season-context.query.ts`, operation command specs.
- User-facing seasons error behavior: `seasons.errors.ts`.
- Policy/source-of-truth semantics: `docs/04_policy/official/season-lifecycle.md`.
- Final implementation sequencing: `.omx/plans/seasons-final-ideal-structure-refactor-plan.md`.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand src/architecture/seasons-boundary.spec.ts src/seasons
pnpm api:typecheck
pnpm exec prettier --check apps/api/src/seasons/README.md docs/04_policy/official/season-lifecycle.md
pnpm --dir apps/api exec eslint src/seasons/README.md
```
