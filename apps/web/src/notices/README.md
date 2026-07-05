# notices

`/notices` 전용 공지사항 page boundary다.

## 책임

- `GET /api/notices`, `GET /api/notices/:noticeId` BFF를 통해 global 1:N 공지 list/detail을 읽는다.
- 공지 preview와 본문을 표시하되, 개인 알림함이나 support ticket 본문과 섞지 않는다.
- Admin 공지 작성/CMS는 이 boundary의 책임이 아니다.

## 구조

- `api/`: page-local BFF client와 shared contract parse.
- `components/`: 공지 list/article/chip UI.
- `model/`: 날짜/필터/view model mapper.
- `__tests__/`: client와 mapper/API 회귀 테스트.
