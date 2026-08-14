# support

`/support` 전용 고객센터 / 문의하기 page boundary다.

## 책임

- FAQ list, 내 ticket list/detail, ticket 생성, follow-up message composer를 소유한다.
- 본인 ticket만 조회/작성하며, 신고인 정보·운영 내부 메모·RRPD payload·운영자 개인 식별 정보는 표시하지 않는다.
- 알림함에서 support ticket pointer로 진입할 수 있다.
- `/support`는 protected self-only route다. FAQ API는 Support Center placement만 공개 조회하며, 사용자 ticket list/detail/create/reply UI는 로그인 세션이 필요하다.
- HomeTab은 support FAQ/ticket을 fetch하지 않고 문의하기 진입 CTA만 제공한다.

## 구조

- `api/`: page-local support BFF client와 shared contract parse.
- `components/`: FAQ, ticket form/list/thread/composer UI.
- `model/`: category/status/date display mapper.
- `__tests__/`: client와 component/page 회귀 테스트.
