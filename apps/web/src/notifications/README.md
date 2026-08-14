# notifications

`/notifications` 전용 개인 알림함 page boundary다.

## 책임

- 개인별 `UserNotification` inbox list, unread count, mark read/all read를 소유한다.
- 알림 card에는 support/report/chat/matching 원문을 노출하지 않고 사용자가 다음 행동을 이해할 수 있는 안전한 요약 문구만 표시한다.
- support ticket 알림은 `/support?ticketId=...`로 handoff한다.
- matching 알림은 `matchRequestId`/`activeMatchId` pointer만 사용하고 닉네임·프로필·요청 메시지 원문은 매칭 탭에서 다시 조회한다.
- `/notifications`는 protected self-only route다. `proxy.ts`가 비로그인 사용자를 `/login`으로 보낸다.
- HomeTab은 unread count fallback만 읽고, 목록/read/read-all/error UI는 이 page가 소유한다.

## 구조

- `api/`: page-local BFF client와 shared notification contract parse.
- `components/`: filter/list/item UI.
- `model/`: notification summary copy mapper.
- `__tests__/`: client와 copy/privacy 테스트.
