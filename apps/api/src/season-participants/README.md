# Season Participants API module architecture

이 문서는 `apps/api/src/season-participants`의 제품 책임 경계, public surface, final directory ownership을 빠르게 찾기 위한 server-side boundary map이다.

## Public boundary

외부 domain production code는 season-participants 내부 command/query/repository 구현을 직접 import하지 않는다. 필요한 surface는 아래로 제한한다.

- `SeasonParticipantsModule`: current season profile/participation route와 public provider wiring을 제공한다.
- `SeasonParticipantsService`: controller-facing facade와 lifecycle sweep facade다. 직접 Prisma/Dormitories/Chat concrete dependency를 조립하지 않는다.
- `CurrentSeasonParticipationViewQuery`: current-user response의 season participation segment를 만든다.
- `CurrentSeasonParticipantContextGuard`: route-level current-season participant context를 준비한다.
- `capabilities/index.ts`, `policies/index.ts`, `public-target-policy/index.ts`: 외부 domain이 사용할 수 있는 pure policy/capability barrel이다.
- Registration readiness는 `identity/account-identity-invariant.ts` pure vocabulary와 `platform/http/account-identity-invariant.error.ts` HTTP adapter를 소비한다. Users route error namespace를 import하지 않는다.

## Directory responsibilities

- `application/`: public facade, current-user view query, season action user query, season context assertion/query, use-case provider tokens/deps.
- `composition/`: `SeasonParticipantsModule` provider/export grouping. Write/public-target/source owner factory providers와 public module export surface를 module decorator에서 분리해 유지한다.
- `context/`: `@RequireCurrentSeasonParticipant()`, `@SeasonParticipant()` decorator/guard/resolver/types.
- `profile-draft/`: current season profile draft read/write command, mapper, completeness/write-lock policy.
- `dormitory-selection/`: selectable dormitory query, selection update command, readiness evaluator, mapper, selection write-lock policy.
- `registration/`: finalize registration command, readiness evaluator, profile history mapper, registration policy.
- `deregistration/`: deregister command and deregistration fail-closed policy.
- `participants/`: participant record select/mapper/container command/source policy.
- `public-targets/`: public target read snapshot query.
- `public-target-policy/`: public exposure/relation/action/result pure policy. DB query를 넣지 않는다.
- `capabilities/`: current-user capability input/mapper/policy.
- `policies/`: participant status/selection pure policy barrel.
- `lifecycle/`: lifecycle event writer/repository/types and current-season participant backfill command.
- `lifestyle/`: season participant lifestyle persistence mapper.
- `errors/`: user-facing season-participants error contract.
- `contracts/`: shared season participation contract behavior regression spec.
- `test-support/`: season-participants test fixtures only.

## Hard rules

- Root production TypeScript file은 controller/module만 허용한다.
- root `.owner.ts` 파일로 경계를 우회하지 않는다.
- `SeasonParticipantsService`는 provider-injected facade이며 direct dependency assembler가 아니다.
- `season-participant-use-case.deps.ts`는 deps/type만 소유하고 DB-backed helper 구현은 owner-adjacent query files에 둔다.
- `season-participants` production code는 concrete `DormitoriesService`를 import하지 않는다.
- `dormitories` production code는 `season-participants`를 import하지 않는다.
- public target policy는 pure policy로 유지하고 Prisma/Nest provider를 import하지 않는다.
- hidden/deactivated/withdrawn/expired/deleted/deidentified projection은 profile draft, dormitory selection, registration, public target/action에서 fail-closed다.
- `SeasonParticipantLifecycleEvent`는 audit/debug trace이며 current-state timestamp columns가 user-facing source of truth다.
- Account identity invariant failure는 users route error가 아니라 identity shared-kernel vocabulary와 platform HTTP adapter로 표현한다.

## Architecture guard

- Final structure boundary: `apps/api/src/architecture/season-participants/season-participants-boundary.spec.ts`.
- Route/domain context inventory: `apps/api/src/architecture/domain-context/domain-context-route-matrix.spec.ts`.
- Shared contract behavior: `contracts/season-participation-contract.spec.ts`.
- Shared package layout fitness는 domain 내부가 아니라 `apps/api/src/architecture/contracts/layout/`가 소유한다.
- Root spec surface는 controller spec만 허용한다. Module/provider/export fitness는 architecture guard와 `composition/` source-of-truth가 소유한다. Slice behavior spec은 owner-adjacent directory에 둔다.

## Where to change

- Route delegation: `current-season-participation.controller.ts`.
- Facade method delegation: `application/season-participants.service.ts`.
- Use-case composition and provider factory wiring: `application/season-participant-write-owner.ts` and `composition/`.
- Verified season action user and season context assertion/query: `application/season-action-user.query.ts`, `application/season-context.query.ts`.
- Current-user season segment: `application/current-season-participation-view.query.ts`.
- Current-season participant guard/context: `context/`.
- Profile draft behavior: `profile-draft/`.
- Dormitory selection behavior: `dormitory-selection/` plus `dormitories/selection-catalog/` port implementation.
- Registration finalize behavior: `registration/`.
- Registration account identity invariant mapping: `registration/season-registration-readiness.evaluator.ts`, `identity/account-identity-invariant.ts`, `platform/http/account-identity-invariant.error.ts`.
- Deregistration behavior: `deregistration/`.
- Lifecycle event/backfill behavior: `lifecycle/`.
- Public exposure/action policy: `public-target-policy/`.
- Shared contract: `packages/shared/src/season/participation/**` and public imports from `@repo/shared/season/participation` or `@repo/shared/season`.

## Useful verification

```bash
pnpm --dir apps/api exec jest --watchman=false --runInBand \
  src/architecture/season-participants/season-participants-boundary.spec.ts \
  src/architecture/dormitories/dormitories-boundary.spec.ts \
  src/season-participants
pnpm api:typecheck
git diff --check
```
