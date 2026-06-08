# Social Safety API module architecture

Social-safety 도메인의 server-side boundary map이다. 이 문서는 bookmark, block, report, safety projection handoff를 구현할 때 다음 세션이 수정 위치와 금지 경계를 빠르게 파악하기 위한 orientation note다.

## Public boundary

- `bookmarks`: viewer-private saved candidate relation을 소유한다. Public target projection은 읽지만 profile/match/chat concrete service에 직접 결합하지 않는다.
- `blocks`: viewer-specific block relation을 소유한다. Block create는 bookmark 제거와 non-matched direct thread close side-effect를 orchestration port로 요청한다.
- `reports`: report intake 원장을 소유한다. Intake만으로 participant hidden/deactivated projection이나 계정 제재를 직접 변경하지 않는다.
- `PARTICIPANT_VISIBILITY_WRITER_PORT`: 운영 검토/시스템 결정 이후 participant-level current visibility projection을 갱신해야 할 때 사용하는 boundary port다.

## Directory responsibilities

- `application/ports/`: 외부 도메인 또는 후속 writer owner와 연결되는 port token/type. Concrete persistence나 Prisma write를 넣지 않는다.
- `bookmarks/`: bookmark command/query/policy/repository owner. Target card는 public target/search projection allowlist만 사용한다.
- `blocks/`: block command/query/policy/repository owner. Chat/thread side-effect는 chat port로 요청한다.
- `reports/`: report intake command/query/policy/repository owner. Evidence/RRPD disclosure internals는 직접 import하지 않는다.
- `composition/`: future module provider/export grouping.
- `contracts/`: API/shared contract regression specs.

## Hard rules

- `social-safety` production code는 `ChatService`, `ProfilesService`, `MatchesService` concrete를 import하지 않는다.
- `social-safety` production code는 chat table을 직접 mutate하지 않는다. Chat side-effect는 `CHAT_BLOCK_SIDE_EFFECT_PORT` 같은 purpose-specific port를 사용한다.
- `social-safety` production code는 `SeasonParticipant.hiddenByAdminAt`, `hiddenReasonCode`, `deactivatedAt`를 직접 mutate하지 않는다. Projection 갱신은 participant visibility writer port를 통한다.
- Report intake는 제재 decision이 아니다. Intake command는 participant hidden/deactivated projection을 변경하지 않는다.
- Retained vault/RRPD disclosure internals는 report/support product path에서 직접 import하지 않는다.
- User-facing report/bookmark/block response에는 hidden reason detail, raw lifecycle timestamp, retained/vault payload, deleted identity를 노출하지 않는다.

## Architecture guard

- `apps/api/src/architecture/social-safety/social-safety-boundary.spec.ts`가 concrete service import, direct chat persistence, participant projection direct mutation, retained vault disclosure import를 금지한다.
- Shared/API contract red specs는 `apps/api/src/social-safety/social-safety-contract.red.spec.ts`에서 고정한다.

## Where to change

- Report reason/shared contract: `packages/shared/src/social-safety/report.ts`.
- Bookmark shared contract: `packages/shared/src/social-safety/bookmark.ts`.
- Block shared contract: `packages/shared/src/social-safety/block.ts`.
- Notification kind/payload handoff: `packages/shared/src/notifications/contract.ts` and notification writer port.
- Participant visibility projection handoff: `application/ports/participant-visibility-writer.port.ts`.

## Useful verification

```bash
pnpm --dir apps/api test -- src/social-safety/social-safety-contract.red.spec.ts src/architecture/social-safety/social-safety-boundary.spec.ts --runInBand
pnpm api:typecheck
git diff --check
```
