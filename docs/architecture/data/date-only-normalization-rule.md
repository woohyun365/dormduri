# Date-only 필드 정규화 규칙

**상태**: Accepted / current
**날짜**: 2026-04-22
**Sprint**: 7
**관련 이슈**: #194 (캠퍼스/기숙사 시즌 API), #193 (사용자/프로필 API), #195 (매칭 API)
**적용 범위**: `DATE`/`TIMESTAMPTZ` 구분, `packages/shared/src/date/`, `apps/api` 서비스 경계의 date-only 정규화 규칙

## 목적

날짜만 중요한 값(`DATE`)과 정확한 시각이 중요한 값(`TIMESTAMPTZ`)을 섞지 않도록,
모노레포 전체에서 date-only 필드 처리 규칙을 고정한다.

## 값 분류

### 1. date-only

- 예: `roomSelectionDate`, `preparationStartDate`, `matchingStartDate`, `seasonEndDate`
- 의미: 시각이 아니라 **날짜 자체**가 중요
- API/서비스 표현: `YYYY-MM-DD`

### 2. instant(datetime)

- 예: `overrideStartedAt`, `overrideEndsAt`, `createdAt`, `updatedAt`
- 의미: 정확한 시각이 중요
- API/서비스 표현: ISO datetime string 또는 `Date`

## 레이어별 원칙

### DB

- date-only → `DATE`
- instant → `TIMESTAMPTZ`

### Prisma 직후 service boundary

- `DATE`로 읽힌 값은 **즉시 `YYYY-MM-DD` 문자열로 normalize**
- `TIMESTAMPTZ`는 `Date` 유지

### 내부 계산

- date-only 계산 함수는 `LocalDateString`만 받는다
- instant 계산 함수는 `Date`/timestamp만 받는다

### API 응답

- date-only → `YYYY-MM-DD`
- instant → ISO datetime string

## 공용 primitive

`@repo/shared/date`

- `LocalDateString`
- `IsoDateTimeString`
- `toDateOnlyString(value)`
- `toIsoDateTimeString(value)`
- `isLocalDateString(value)`

## 적용 원칙

1. Prisma row를 서비스 깊숙이 그대로 전달하지 않는다.
2. date-only 필드는 service boundary에서 normalize한 app-level 타입으로 바꾼다.
3. `.toISOString().slice(0, 10)`를 곳곳에 흩뿌리지 말고 공용 primitive를 사용한다.
4. 새 `@db.Date` 필드가 생기면 같은 패턴으로 normalize 계층을 추가한다.

## 현재 적용 상태

현재 백엔드 `@db.Date` 필드는 시즌 도메인에 집중되어 있고,
`apps/api/src/seasons/*`에 위 규칙이 반영되어 있다.

즉 새 date-only 필드가 생기기 전까지는 시즌 도메인이 기준 구현이다.
