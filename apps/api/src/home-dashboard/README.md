# Home dashboard API

`home-dashboard`는 Home 탭 전용 **read-only presentation query** 경계다.
도메인 mutation owner가 아니며, current-user/season/season-participants/matches/chat의 사용자 표시용 read model과 count만 조합해 `@repo/shared/home`의 `HomeDashboardResponse`를 반환한다.

규칙:

- update/create/delete 같은 side effect를 수행하지 않는다.
- Home 화면에 필요한 allowlist DTO만 반환한다.
- hidden/deactivated/deleted/retention/audit/report/moderation raw field는 노출하지 않는다.
- 사용자별 capability/activity가 포함되므로 Web BFF와 API 모두 no-store 성격으로 사용한다.
