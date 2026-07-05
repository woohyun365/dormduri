# support

`/support` 전용 고객센터 / 문의하기 page boundary다.

## 책임

- FAQ list, 내 ticket list/detail, ticket 생성, follow-up message composer를 소유한다.
- 본인 ticket만 조회/작성하며, 신고인 정보·운영 내부 메모·RRPD payload·운영자 개인 식별 정보는 표시하지 않는다.
- 알림함에서 support ticket pointer로 진입할 수 있다.

## 구조

- `api/`: page-local support BFF client와 shared contract parse.
- `components/`: FAQ, ticket form/list/thread/composer UI.
- `model/`: category/status/date display mapper.
- `__tests__/`: client와 component/page 회귀 테스트.
