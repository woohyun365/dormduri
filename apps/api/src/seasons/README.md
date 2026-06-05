# Seasons API module architecture

이 문서는 `apps/api/src/seasons`의 제품 책임 경계, source-of-truth, #208/#209 작업 범위를 빠르게 파악하기 위한 server-side boundary map이다.

## Public boundary

외부 domain은 현재 transitional baseline에서 `SeasonsService`를 사용하지만, 최종 구조에서는 season runtime port를 통해 current season context만 사용한다.

- `SeasonsModule`: public current season route와 season runtime provider wiring을 제공한다.
- `GET /api/seasons/current?campus=...`: 운영 캠퍼스의 사용자용 current season snapshot을 반환한다.
- `SeasonsService`: Phase 0 기준 compatibility facade다. Phase 2~4에서 runtime query/port로 내부 책임을 분리한다.
- `SEASON_CONTEXT_PORT`: Phase 4 target public port다. 외부 도메인은 concrete `SeasonsService` 대신 이 port로 current context를 읽도록 전환한다.
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
- `seasons.module.ts`: current transitional provider/export wiring. Phase 7 이후 provider list가 커지면 composition 분리를 검토한다.
- `seasons.service.ts`: current season query, reference time resolution, dormitory match window query를 함께 가진 compatibility facade. Phase 2~4에서 runtime query/repository/port로 분리한다.
- `season.utils.ts`: KST date helper, schedule/state/override mapper. Phase 2에서 pure policy/helper를 분리하고 Phase 4에서 외부 direct import를 제거한다.
- `season.types.ts`: current runtime context/internal row type. Phase 3~4에서 runtime/port type으로 이동한다.
- `seasons.errors.ts`: user-facing seasons error contract.
- `contracts/`: shared season contract behavior regression spec.

## #208 operations scope

#208은 backend/API/domain 범위의 season operations hardening이다. BackOffice UI는 이 module 범위가 아니다.

포함:

- schedule/override backend operations route와 command.
- overlap/invalid date/invalid override window validation.
- optimistic concurrency 또는 equivalent lost-update guard.
- schedule/override mutation transaction.
- actor, reason, before/after snapshot을 포함한 operations audit append.
- 운영 절차/incident 대응 README 또는 policy update.

제외:

- BackOffice rendering/hook/page/component.
- DB manual update를 정상 운영 path로 유지하는 것.
- override columns를 audit/history ledger로 사용하는 것.

## #209 cache scope

#209는 season context read의 비용을 줄이되 source-of-truth를 바꾸지 않는 작업이다.

포함:

- 한 logical operation/request 안에서 동일 campus current season context를 재사용하는 request/method-level memoization.
- cache key, invalidation point, stale read 허용 범위 문서화.
- cache hit/miss와 DB query count를 고정하는 targeted tests.

제외:

- Redis/process-local distributed cache 도입.
- stale season state를 product behavior로 허용하는 설계 변경.
- mutation 후 invalidation 없이 오래 남는 cache.

## Hard rules

- Phase 1 architecture guard 전에는 production file move/refactor를 시작하지 않는다.
- future season row만 있는 경우 사용자용 current season은 `null`이다.
- 비운영 캠퍼스는 사용자용 current season 리소스를 제공하지 않는다.
- override는 current state 계산에만 영향을 준다. schedule, operated dormitory, history, audit source-of-truth를 대체하지 않는다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- Web rendering/hook/page/component 작업은 seasons API module 범위가 아니다.

## Target direction

최종 구조는 runtime read, operations mutation, ports, cache를 분리한다.

- `runtime/`: current season query/repository/mapper/policy.
- `operations/`: #208 schedule/override commands, operations controller, audit repository.
- `ports/`: external domain-facing season context and boundary schedule ports.
- `cache/`: #209 request/method-level memoization helper.
- `platform/time/`: KST date helper처럼 season-neutral time helper.

## Where to change

- Public current season route parsing: `seasons.controller.ts`.
- Current runtime read behavior before split: `seasons.service.ts`, `season.utils.ts`.
- User-facing seasons error behavior: `seasons.errors.ts`.
- Policy/source-of-truth semantics: `docs/04_policy/official/season-lifecycle.md`.
- Final implementation sequencing: `.omx/plans/seasons-final-ideal-structure-refactor-plan.md`.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand src/seasons
pnpm api:typecheck
pnpm exec prettier --check apps/api/src/seasons/README.md docs/04_policy/official/season-lifecycle.md
pnpm --dir apps/api exec eslint src/seasons/README.md
```
