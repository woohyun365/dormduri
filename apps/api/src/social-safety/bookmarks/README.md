# Bookmark slice

`bookmarks/`는 viewer-private saved candidate relation을 소유하는 독립 slice다. 이 slice만 떼어 별도 module로 옮겨도 읽히도록 root production TS에는 `bookmark.module.ts`, `bookmark.controller.ts`만 두고, facade/write/read/policy/persistence/presentation 책임을 하위 디렉토리로 분리한다. `README.md`는 docs 예외다.

## Public surface

- `GET /api/bookmarks`: current season active bookmarks를 cursor list로 반환한다.
- `POST /api/bookmarks/:targetUserId`: visible/actionable target을 active bookmark로 생성하거나 deleted row를 restore한다.
- `DELETE /api/bookmarks/:targetUserId`: active bookmark를 soft-delete한다. missing/already-deleted는 idempotent success다.
- `BookmarkLifecycleService.expireEndedSeasonBookmarks(now)`: ended season active bookmarks를 bounded batch로 `expiredAt` 처리한다. Scheduler 연결은 `LifecycleModule` task adapter가 담당한다.

## Directory map

- `bookmark.module.ts`: slice provider composition만 담당한다. root `social-safety.module.ts`는 이 module만 import한다.
- `bookmark.controller.ts`: route, auth actor, param/query parse만 담당한다.
- `application/bookmark.service.ts`: HTTP-facing thin facade. command/query를 조합하지 않고 위임만 한다.
- `application/bookmark-lifecycle.service.ts`: season-end cleanup facade. lifecycle orchestration에서 호출된다.
- `commands/`: create/delete transaction orchestration. Target stale recheck와 idempotency를 여기서 다룬다.
- `queries/`: list read model과 cursor encode/decode. Hidden target을 되살리지 않는다.
- `policies/`: DB-backed target context evaluation + public target policy 조합. Concrete profile/match/chat service import 금지.
- `repositories/`: `UserBookmark` persistence only. Target visibility나 presentation 판단 금지.
- `presenters/`: shared contract response allowlist, empty state, list metadata.
- `contracts/`: bookmark shared/API contract regression spec. Root social-safety contract spec에 bookmark assertion을 남기지 않는다.
- `errors/`: probing-safe user-facing error mapping.

## Hard rules

- Bookmark response는 hidden reason, deleted identity, registration snapshot raw data, retained/vault payload를 노출하지 않는다.
- Bookmark list는 active row와 visible item을 구분한다. active row가 있지만 모두 숨겨졌으면 `NO_VISIBLE_BOOKMARKS`, active row가 없으면 `NO_BOOKMARKS`다.
- Roommate-search bookmark metadata는 이미 visible한 candidate에만 coarse `{ bookmarked, bookmarkedAt? }`를 붙인다.
- `MATCH_SCORE` list는 bounded active-bookmark scan으로 시작한다. 대량 ranking/EXPLAIN 튜닝은 운영 관측 후 별도 performance follow-up으로 다룬다.

## Useful verification

```bash
pnpm --dir apps/api test -- src/social-safety/bookmarks/contracts/bookmark-contract.spec.ts src/social-safety/bookmarks/commands/create-bookmark.command.spec.ts src/social-safety/bookmarks/commands/delete-bookmark.command.spec.ts src/social-safety/bookmarks/queries/bookmark-list.query.spec.ts src/social-safety/bookmarks/queries/bookmark-list.cursor.spec.ts src/social-safety/bookmarks/policies/bookmark-target-policy.evaluator.spec.ts src/social-safety/bookmarks/repositories/bookmark.repository.spec.ts src/social-safety/bookmarks/application/bookmark-lifecycle.service.spec.ts src/social-safety/bookmarks/presenters/bookmark.presenter.spec.ts --runInBand
pnpm api:typecheck
git diff --check
```
