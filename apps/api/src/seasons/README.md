# Seasons API module architecture

이 문서는 `apps/api/src/seasons` 내부 책임 경계, public surface, directory ownership, 수정 위치를 빠르게 찾기 위한 server-side boundary map이다.

## Public boundary

외부 domain production code는 seasons 내부 runtime/operations 구현을 직접 import하지 않는다. 현재 시즌 문맥이 필요한 도메인은 기본적으로 `SEASON_CONTEXT_PORT` / `SeasonContextPort`를 사용한다. 단, campus 운영 여부와 current season context를 함께 projection해야 하는 read-model/policy path는 stable helper `runtime/campus-service-state.query.ts`만 직접 사용할 수 있다.

- `SeasonsModule`: public current season route, operations route, runtime/cache/operations provider wiring을 제공한다.
- `GET /api/seasons/current?campus=...`: 운영 캠퍼스의 사용자용 current season snapshot을 반환한다.
- `PATCH /api/campuses/:campusCode/seasons/:seasonId/schedule`: `admin:season:operations:write` capability가 있는 운영 actor만 특정 campus의 season schedule을 optimistic concurrency로 수정한다.
- `PATCH /api/campuses/:campusCode/seasons/:seasonId/override`: 특정 campus의 운영 override state/window/reason을 optimistic concurrency로 설정한다.
- `DELETE /api/campuses/:campusCode/seasons/:seasonId/override`: 특정 campus의 override를 해제하고 audit event를 남긴다.
- `SEASON_CONTEXT_PORT`: 외부 도메인의 public season context port다. current season context/state와 dormitory match window read만 제공한다.
- `SeasonsService`: `application/` 내부 controller-facing facade이자 `SeasonContextPort` 구현체다. 외부 도메인의 concrete dependency가 아니다.
- shared season contract는 `packages/shared/src/season/{runtime,operations,participation}/**`가 canonical owner이며 public import는 `@repo/shared/season`과 granular `@repo/shared/season/*`만 사용한다.

## Source of truth

- 정책 source of truth: `docs/04_policy/official/season-lifecycle.md`.
- 사용자용 current season은 운영 캠퍼스의 `Season` row 중 기준 시간이 `preparationStartDate` ~ `seasonEndDate`에 들어온 row에서 계산한다.
- upcoming season row는 preview/operations 준비 데이터이며 사용자용 current season으로 승격하지 않는다.
- 활성 override는 선택된 current season row의 effective state 계산에만 적용한다. override는 schedule/history/audit 원장이 아니다.
- 운영 기숙사와 `roomSelectionDate`는 `SeasonDormitoryOperation`이 소유한다. 매칭 종료일은 운영 기숙사별 `roomSelectionDate`에서 계산하고, 시즌 종료는 campus `seasonEndDate`를 따른다.
- Postgres가 authoritative source다. request/method-level memoization은 한 logical operation 안의 반복 조회 비용을 줄이는 최적화일 뿐 source-of-truth가 아니다.

## Directory responsibilities

- root: `seasons.controller.ts`, `seasons.module.ts` production entrypoint만 둔다. `README.md`와 `seasons.controller.spec.ts`는 root 문서/route regression spec으로 유지한다.
- `application/`: `SeasonsService` facade와 해당 regression spec. Controller-facing shape와 `SEASON_CONTEXT_PORT` 구현을 제공하되 Prisma/query/policy ownership을 갖지 않는다.
- `errors/`: user-facing seasons error contract. Controller/operations command가 같은 error mapper를 공유한다.
- `ports/`: 외부 도메인-facing season context port와 current season context type/helper export surface. 외부 도메인은 `runtime/`을 직접 import하지 않는다.
- `runtime/`: current season context query, campus service-state query, dormitory match window query, Prisma repository, season state policy, current season response mapper, normalized runtime row type. 대부분 Seasons module 내부 구현 상세이며, `campus-service-state.query.ts`만 users current-user projection과 profile/social-safety read-model policy의 stable cross-domain helper로 허용한다.
- `operations/`: schedule/override admin API controller, command, repository, audit repository, mapper, validation policy, operational metrics. Mutation과 audit append는 같은 transaction 안에서 수행한다.
- `cache/`: request/method-level current season context memoization helper. Cache instance를 명시적으로 넘긴 logical operation 안에서만 재사용하며 process/Redis cache가 아니다.
- `contracts/`: shared season contract behavior regression spec. Shared package layout fitness는 `apps/api/src/architecture/contracts/layout/season-shared-contract-layout.spec.ts`가 소유한다.
- `platform/time/kst-date.ts`: season-neutral KST local-date helper. `season.utils.ts` root forwarding file은 두지 않는다.

## Hard rules

- Root production TypeScript file은 `seasons.controller.ts`, `seasons.module.ts`만 허용한다.
- Upcoming season row만 있는 경우 사용자용 current season은 `null`이다.
- 비운영 캠퍼스는 사용자용 current season 리소스를 제공하지 않는다.
- Override는 current state 계산에만 영향을 준다. Schedule, operated dormitory, history, audit source-of-truth를 대체하지 않는다.
- Operations mutation은 route `campusCode + seasonId`를 모두 검증하며, `seasonId` 단독으로 다른 campus season을 수정하지 않는다.
- Operations audit payload는 operation 대상 `campusCode`, actor id/capability snapshot, changed field, before/after season snapshot만 저장하고 session/gender 같은 불필요한 actor metadata를 남기지 않는다.
- Metric/log payload는 actor/session/reason/snapshot 원문을 포함하지 않는다. Structured payload는 `action`, `campusCode`, `outcome`, `recordedAt` allowlist만 허용한다.
- Redis/process-wide cache는 현재 source-of-truth나 기본 cache strategy가 아니다. 관측된 병목이 제품 운영 조건으로 확정될 때 seasons cache owner가 다룬다.
- `/health/seasons` 같은 상세 운영 endpoint는 public endpoint로 추가하지 않는다. 필요하면 protected capability route가 소유한다.
- BackOffice UI는 seasons API module 범위가 아니다.
- 새 `forwardRef()`로 boundary 문제를 봉합하지 않는다.
- seasons API module은 Web rendering/hook/page/component를 소유하지 않는다.

## Architecture guard

Seasons architecture guard는 `apps/api/src/architecture/seasons-boundary.spec.ts`가 소유한다. Shared season contract layout guard는 `apps/api/src/architecture/contracts/layout/season-shared-contract-layout.spec.ts`가 소유한다.

- Root production TypeScript file은 `seasons.controller.ts`, `seasons.module.ts`만 허용한다.
- `SeasonsService`와 `seasonsErrors`는 root forwarding export 없이 각각 `application/`, `errors/`가 소유한다.
- `SeasonsService`는 facade delegation 위주이며 direct Prisma query, query shape, reference time resolution을 소유하지 않는다.
- External production code는 `seasons/operations/**`, `seasons/application/**`, `seasons/errors/**`를 직접 import하지 않는다. `seasons/runtime/**` 중 cross-domain 직접 import는 `campus-service-state.query.ts`로만 제한한다.
- External production code는 `SEASON_CONTEXT_PORT` / `SeasonContextPort`로 current season context를 소비한다.
- Operations code는 request cache slice를 import하지 않는다. Admin mutation과 request memoization boundary를 분리한다.
- `season.utils.ts`와 `season.types.ts` root helper surface는 두지 않는다.
- Shared season runtime/operations/participation contract owner는 `packages/shared/src/season/{runtime,operations,participation}/**`다.

## Where to change

- Public current season route parsing: `seasons.controller.ts`.
- Controller-facing current season facade: `application/seasons.service.ts`.
- User-facing seasons error behavior: `errors/seasons.errors.ts`.
- External season context consumption: `ports/season-context.port.ts`.
- Current season DB read shape and reference time resolution: `runtime/current-season-context.query.ts`, `runtime/season-runtime.repository.ts`.
- Campus operated + current season service-state projection: `runtime/campus-service-state.query.ts`.
- Current season state calculation and response projection: `runtime/season-runtime.policy.ts`, `runtime/current-season.mapper.ts`.
- Dormitory match window read behavior: `runtime/dormitory-match-window.query.ts`.
- Schedule/override mutation and audit behavior: `operations/` commands/repositories/policy/mapper.
- Season runtime/operations metric recording: `operations/season-operational-metrics.service.ts`, `runtime/current-season-context.query.ts`, operation command specs.
- Request/method-level memoization: `cache/`, `runtime/current-season-context.query.ts`, `runtime/dormitory-match-window.query.ts`, `ports/season-context.port.ts`.
- Shared season runtime/operations/participation contracts: `packages/shared/src/season/{runtime,operations,participation}/**` and `contracts/` behavior specs.
- Policy/source-of-truth semantics: `docs/04_policy/official/season-lifecycle.md`.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/seasons-boundary.spec.ts \
  src/architecture/contracts/layout/season-shared-contract-layout.spec.ts \
  src/seasons/seasons.controller.spec.ts \
  src/seasons/application/seasons.service.spec.ts \
  src/seasons/contracts/season-contract.spec.ts \
  src/season-participants/contracts/season-participation-contract.spec.ts
pnpm shared:build && pnpm shared:typecheck
pnpm api:typecheck
pnpm --dir apps/api exec eslint src/architecture/seasons-boundary.spec.ts src/seasons
pnpm exec prettier --check apps/api/src/seasons/README.md

git diff --check
```
