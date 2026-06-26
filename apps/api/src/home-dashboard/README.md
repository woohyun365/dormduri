# Home dashboard API

`home-dashboard`는 Home 탭 전용 **read-only presentation query** 경계다.
도메인 mutation owner가 아니며, current-user/season/season-participants/matches/chat의 사용자 표시용 read model과 count만 조합해 `@repo/shared/home`의 `HomeDashboardResponse`를 반환한다.

규칙:

- update/create/delete 같은 side effect를 수행하지 않는다.
- Home 화면에 필요한 allowlist DTO만 반환한다.
- hidden/deactivated/deleted/retention/audit/report/moderation raw field는 노출하지 않는다.
- 사용자별 capability/activity가 포함되므로 Web BFF와 API 모두 no-store 성격으로 사용한다.

## Local full-stack seed

- `apps/api/prisma/seed-data/fixtures/home-dashboard-e2e-fixtures.js`는 Home read model 검증 전용 local seed를 만든다.
- 기본 mode는 `HOME_E2E_SEED_MODE=current-matching`이며 current season, 운영 기숙사별 10명 이상 participant matrix, active match, pending received request, unread chat, 2026-01 past history summary를 준비한다.
- `HOME_E2E_SEED_MODE=season-open | post-match | future-preview`로 같은 `2026-02` season row의 schedule을 전환해 상태별 수동/Playwright smoke를 준비할 수 있다.
- `future-preview`와 current mode는 Prisma `Season(campusCode, academicYear, semester)` unique constraint 때문에 같은 DB 상태에서 동시에 유지하지 않는다.
- production/runtime `home-dashboard` query는 seed/test-support 파일을 import하지 않는다. Seed는 local DB fixture ownership만 가진다.
