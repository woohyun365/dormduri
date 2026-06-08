# Block slice

`blocks/`는 viewer-specific block relation과 block event history를 소유하는 독립 slice다. Block은 상대 사용자에게 고지하지 않는 safety relation이며, match/chat/bookmark side-effect는 purpose-specific port 또는 adapter로 요청한다.

## Planned public surface

- `GET /api/blocks`: 내가 차단한 사용자 목록과 내 note를 조회한다.
- `POST /api/blocks/:targetUserId`: target을 차단하고 필요한 side-effect를 idempotent하게 실행한다.
- `DELETE /api/blocks/:targetUserId`: active block을 닫는다. Bookmark/request/thread를 즉시 restore하지 않는다.

## Directory map

- `block.module.ts`: slice provider composition만 담당한다.
- `block.controller.ts`: route, auth actor, param/query/body parse만 담당한다.
- `application/block.service.ts`: thin facade.
- `commands/`: block/unblock write use cases.
- `queries/`: block list read model.
- `policies/`: active match reject, note ownership, visibility/probing-safe decisions.
- `repositories/`: `UserBlock`/`UserBlockEvent` persistence only.
- `side-effects/`: bookmark removal, match pending cancel, chat direct thread close orchestration.
- `presenters/`: block response allowlist.
- `errors/`: probing-safe user-facing error mapping.

## Hard rules

- Target에게 block/unblock 사실을 notification으로 보내지 않는다.
- Active match block은 거부하고 report/support path로 분리한다.
- Block create는 양방향 active bookmark를 soft-delete하지만 unblock은 bookmark/request/thread를 자동 restore하지 않는다.
- Non-matched direct thread close/reopen authority는 chat이 소유한다. Social-safety는 close side-effect intent만 전달한다.
