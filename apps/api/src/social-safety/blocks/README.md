# Social-safety blocks

## Public boundary

- `POST /api/blocks/:targetUserId`: 현재 시즌에서 visible/actionable한 상대를 active block relation으로 생성한다.
- `DELETE /api/blocks/:targetUserId`: active block을 `unblockedAt`으로 닫는다. missing/already-unblocked는 idempotent success다.
- `GET /api/blocks`: 내가 차단한 active relation 목록만 반환한다. 상대가 더 이상 노출 가능하지 않으면 `NO_LONGER_VISIBLE`로 coarse 표시한다.

## Directory responsibilities

- `block.module.ts` / `block.controller.ts`: root entrypoint. root에는 module/controller만 둔다.
- `application/`: thin service facade.
- `commands/`: block/unblock transaction orchestration.
- `queries/`: cursor list read model.
- `policies/`: target resolve, self/missing/deleted/current active match fail-closed 판단.
- `repositories/`: `UserBlock` / `UserBlockEvent` persistence only.
- `side-effects/`: bookmark cleanup, match pending cancel, chat direct-thread close port orchestration.
- `presenters/`: shared contract allowlist response mapping.
- `contracts/`: block shared/API contract regression spec. Root social-safety contract spec에 block assertion을 남기지 않는다.
- `errors/`: probing-safe user-facing errors.

## Hard rules

- Target user에게 block notification을 보내지 않는다.
- Active match 관계는 block으로 자동 종료하지 않고 `ACTIVE_MATCH_BLOCK_NOT_ALLOWED`로 닫는다.
- Block create는 양방향 active bookmark를 soft-delete하지만 unblock은 bookmark/request/thread를 복원하지 않는다. unblock 이후 explicit chat resume/send는 chat owner가 active block absence를 다시 확인한 뒤 lazy 처리한다.
- Pending match request와 direct chat thread close는 matches/chat owner port를 통해서만 수행한다.
- Social-safety code는 `ChatService`, `MatchesService` concrete 또는 chat/match persistence를 직접 mutate하지 않는다.
- Block note는 blocker-only private note이며 target 또는 public search/profile response에 노출하지 않는다.

## Architecture guard

- `apps/api/src/architecture/social-safety/social-safety-boundary.spec.ts`
- social-safety Prisma schema/index architecture guard
- `apps/api/src/architecture/security/auth-access-route-matrix.spec.ts`
- `apps/api/src/architecture/module-boundary.spec.ts`

## Where to change

- API shape/response allowlist: `packages/shared/src/social-safety/block.ts` + `presenters/`.
- Block relation/event persistence: `repositories/` + Prisma schema/migration SQL.
- Target availability: `policies/block-target-policy.evaluator.ts`.
- Cross-domain side-effect handoff: `side-effects/block-side-effect.service.ts` and owner ports in `matches/` / `chat/`.
- Shared contract regression: `contracts/block-contract.spec.ts`.
