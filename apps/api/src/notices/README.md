# API notices

`apps/api/src/notices`는 모든 사용자에게 공개되는 global notice read path를 소유한다.
개인 알림함(`notifications`)과 달리 사용자별 delivery/read state를 만들지 않고, 운영자가 게시한 공지의 공개 window만 검사한다.

## Boundary

- `GET /api/notices`: published window 안에 있는 공지 preview 목록만 반환한다. Preview에는 `body`를 포함하지 않는다.
- `GET /api/notices/:noticeId`: published window 안에 있는 공지 상세만 반환한다.
- `publishedAt is not null`, `publishedAt <= now`, `expiresAt is null or now < expiresAt` 조건을 만족하지 않으면 list에서 제외하고 detail은 404로 fail-closed한다.
- Home/Web은 fake notice rows를 만들지 않는다. 공지가 없으면 empty state로 수렴한다.
