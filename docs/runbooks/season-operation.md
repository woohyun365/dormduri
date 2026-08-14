# 시즌 운영 Runbook

캠퍼스 시즌 schedule과 예외 override를 안전하게 변경하기 위한 운영 절차다. 정책 의미는
[`season-lifecycle.md`](../policies/season-lifecycle.md), API 내부 책임은
`apps/api/src/seasons/README.md`를 따른다.

## 운영 대상

### Campus season schedule

- `preparationStartDate`
- `matchingStartDate`
- `seasonEndDate`
- optimistic concurrency용 현재 `updatedAt`

### Season override

- `state`
- `reason`
- `startsAt`
- `endsAt`
- optimistic concurrency용 현재 `updatedAt`

### Dormitory operation

기숙사별 운영 여부와 `roomSelectionDate`는 `Season` schedule이 아니라
`SeasonDormitoryOperation`이 소유한다. 시즌 매칭 종료를 campus 공통 날짜로 추정하지 않는다.

## Schedule 변경 절차

1. 대상 campus와 season id를 확인한다.
2. 학교 공식 일정에서 준비 시작일, 매칭 시작일, 시즌 종료일을 확인한다.
3. 현재 season snapshot과 `updatedAt`을 읽는다.
4. `admin:season:operations:write` capability를 가진 운영 actor로 schedule API를 호출한다.
5. 응답의 schedule과 audit 기록을 확인한다.
6. 사용자용 current season 응답과 주요 Main surface를 smoke test한다.

운영 일정은 임의의 월별 기본값이나 `roomSelectionDate - N일`로 자동 결정하지 않는다.

## Override 사용 절차

Override는 장애·학교 일정 변경처럼 schedule을 수정하지 않고 일시적으로 effective state를 바꿔야 하는
예외에만 사용한다.

1. 변경 사유와 종료 시점을 확정한다.
2. 현재 season snapshot과 기존 active override를 확인한다.
3. 시작·종료 시각을 포함해 override를 설정한다.
4. 사용자용 current season state와 action capability를 확인한다.
5. 종료 후 자동 만료 여부를 확인하고, 조기 종료라면 clear API로 해제한다.

Override를 season history, schedule 변경, 운영 기숙사 변경의 대체 수단으로 사용하지 않는다.

## API 경계

| 작업          | API                                                           |
| ------------- | ------------------------------------------------------------- |
| Schedule 변경 | `PATCH /api/campuses/:campusCode/seasons/:seasonId/schedule`  |
| Override 설정 | `PATCH /api/campuses/:campusCode/seasons/:seasonId/override`  |
| Override 해제 | `DELETE /api/campuses/:campusCode/seasons/:seasonId/override` |

모든 mutation은 route campus와 season 소유 관계, 입력 contract, optimistic concurrency를 다시 검증하고
같은 transaction에서 audit event를 기록한다.

## 확인 항목

- 사용자 current season이 대상 campus schedule에서 계산되는가
- 운영 기숙사별 `roomSelectionDate`가 유지되는가
- override가 schedule 원본을 변경하지 않는가
- metric/log에 actor/session/reason 원문이 노출되지 않는가
- 잘못된 campus-season 조합과 stale `updatedAt`이 거부되는가
