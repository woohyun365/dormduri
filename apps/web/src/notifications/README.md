# notifications

`/notifications` 전용 개인 알림함 page boundary다.

## 책임

- 개인별 `UserNotification` inbox list, unread count, mark read/all read를 소유한다.
- 알림 card에는 support/report/chat 원문을 노출하지 않고 owner resource pointer와 안전한 copy만 표시한다.
- support ticket 알림은 `/support?ticketId=...`로 handoff한다.

## 구조

- `api/`: page-local BFF client와 shared notification contract parse.
- `components/`: filter/list/item UI.
- `model/`: pointer-only notification copy mapper.
- `__tests__/`: client와 copy/privacy 테스트.
