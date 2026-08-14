# API spec responsibility inventory

API spec 책임 분리 전 기준선은 총 439개였다. 파일 수 자체보다 아래 invariant가 이동 후에도 유지되는지를 migration 기준으로 사용한다.

| 기존 혼합 책임                    | canonical owner                         | 보존 invariant                                               |
| --------------------------------- | --------------------------------------- | ------------------------------------------------------------ |
| API domain의 Shared schema spec   | `packages/shared/test/contracts`        | parse/reject, optional/null, enum과 compatibility behavior   |
| Shared package export 검사        | `packages/shared/test/architecture`     | `package.json#exports`의 type/runtime artifact 존재          |
| product source 문자열 검사        | product behavior + `test/architecture`  | 실제 호출 결과와 dependency/import invariant                 |
| broad domain Prisma baseline      | `test/operations/database`              | domain별 critical index, partial unique, enum/table contract |
| observability 단일 infra spec     | platform + release operations           | stack, alert/query, release evidence를 독립 진단             |
| account deletion 대형 integration | user/participant/race/retention journey | 삭제, 철회, 경합, 보존·폐기 transaction behavior             |

## 금지 경계

- `apps/api/src/**/*.spec.ts`에서 `node:fs`로 자기 구현 source를 읽지 않는다.
- Shared-only schema behavior를 API architecture lane에 복제하지 않는다.
- 전체 baseline migration을 여러 domain spec에서 그대로 반복하지 않는다.
- exact 사용자 문구나 historical path 존재만으로 business invariant를 고정하지 않는다.

## 대형 integration 재검토

500줄 이상 spec은 LOC만으로 나누지 않고 use-case 경계를 확인했다.

- `matches/match-history`: materialization부터 조회까지 하나의 history lifecycle을 검증한다.
- `seasons/season-transition`: 시즌 상태 전이 transaction과 후속 정리를 함께 검증한다.
- `matches/unmatch`: pair unmatch lifecycle을 검증한다.
- `notifications/notifications`: notification outbox부터 inbox projection까지 하나의 전달 lifecycle을 검증한다.
- `social-safety/social-safety-block`: block/unblock lifecycle과 연관 surface 차단을 검증한다.
- `matches/matches`: request/accept/cancel로 이어지는 match request lifecycle을 검증한다.

반면 account deletion 파일은 계정 삭제, 시즌 철회, registration 경합, retention 폐기가 섞여 있어 각 journey로 분리했다.
