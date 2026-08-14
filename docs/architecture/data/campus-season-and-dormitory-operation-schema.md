# 캠퍼스 시즌 / 운영 기숙사 스키마 설계

**상태**: Accepted / current
**날짜**: 2026-04-22
**Sprint**: 7
**관련 이슈**: #194 (캠퍼스/기숙사 시즌 API), #195 (매칭 API), #197 (Home/dashboard 조립)
**적용 범위**: `Season`, `SeasonDormitoryOperation`, `Dormitory` 마스터 분리, 캠퍼스 시즌 윈도우와 기숙사별 매칭 종료 메타 스키마 기준

## 목적

캠퍼스 시즌 윈도우와 기숙사별 실제 매칭 종료일을 분리한 스키마 구조를 설명한다.

## 테이블 역할

### `Season`

- 캠퍼스별 단일 시즌
- 준비 시작 / 매칭 시작 / 시즌 종료를 소유
- override를 통해 예외 상태를 강제할 수 있음

핵심 필드:

- `campusCode`
- `academicYear`
- `semester`
- `preparationStartDate`
- `matchingStartDate`
- `seasonEndDate`

### `SeasonDormitoryOperation`

- 이번 시즌 실제 운영 기숙사 목록
- 기숙사별 실제 `roomSelectionDate`

핵심 필드:

- `seasonId`
- `dormitoryId`
- `isOperated`
- `roomSelectionDate`

## 왜 `Dormitory.isOperated` 하나로 풀지 않나

- 기숙사는 학교에 계속 존재하지만 특정 시즌에만 미운영일 수 있다.
- 과거에는 운영했고 이번 시즌에는 미운영인 상태를 보존해야 한다.
- 따라서 `Dormitory` 마스터와 `SeasonDormitoryOperation` 시즌성 운영 상태를 분리해야 한다.

## 정합성 제약

- `Season`는 `(campusCode, academicYear, semester)`로 유일해야 한다.
- `SeasonDormitoryOperation`는 `(seasonId, dormitoryId)`로 유일해야 한다.
- 운영 기숙사 목록은 `Season.campusCode`와 동일한 캠퍼스의 `Dormitory`만 참조해야 한다.
- `matchingStartDate <= roomSelectionDate <= seasonEndDate` 규칙을 운영/API 레벨에서 검증해야 한다.

## 쿼리 기준

- 유저용 시즌 조회: `Season` + `SeasonDormitoryOperation(isOperated=true)`
- 유저용 기숙사 목록: 현재/예정 `Season`의 운영 기숙사만 노출
- 매칭 가능 여부: `matchingStartDate`와 해당 기숙사 `roomSelectionDate` 기준
- 시즌성 데이터 초기화: `seasonEndDate` 기준

## 참고 소스

1. `docs/policies/season-lifecycle.md`
2. `apps/api/prisma/schema.prisma`
