# Campus reference data seeding

## 목적

캠퍼스·생활관·단과대처럼 애플리케이션 시작과 정책 판정에 필요한 reference data를
fixture와 분리해 반복 실행 가능한 방식으로 배포한다.

## Source of truth

| 데이터    | 코드 source                                                      | DB projection   |
| --------- | ---------------------------------------------------------------- | --------------- |
| 캠퍼스    | `prisma/seeds/reference/common/campus-reference-data.js`         | `CampusMaster`  |
| 생활관    | `prisma/seeds/reference/dormitories/dormitory-reference-data.js` | `Dormitory`     |
| 단과대    | `packages/shared/src/college/catalog.ts`                         | `CollegeMaster` |
| 시즌 운영 | 운영자가 확정한 시즌 일정·생활관별 호실 선택일                   | `Season*`       |

`apps/api/prisma/seed-data/reference/dormitory-seed-data.js`는 과거 기숙사 guide와 연락처를
재현하기 위한 legacy 자료다. production reference seed는 해당 파일을 import하지 않는다.

## 실행 단위

```bash
pnpm db:seed:reference
pnpm db:seed:reference:dormitories
pnpm db:seed:reference:colleges
```

- 전체 seed는 campus prerequisite를 포함해 생활관과 단과대를 한 transaction에서 적용한다.
- 개별 seed도 campus prerequisite를 먼저 upsert하므로 독립적으로 실행할 수 있다.
- production에서는 `DIRECT_URL`을 우선 사용하고, 없으면 `DATABASE_URL`을 사용한다.
- production에서 두 환경 변수가 모두 없으면 local fallback 없이 즉시 실패한다.

## 동시성·보안·실패 처리

- 모든 값은 repository의 정적 allowlist에서 읽고 parameterized query로 전달한다.
- seed 시작 시 transaction-scoped PostgreSQL advisory lock을 획득해 동시 실행을 직렬화한다.
- 각 master는 `INSERT ... ON CONFLICT DO UPDATE`로 idempotent하게 적용한다.
- 기존 unprefixed 단과대 code는 동일 캠퍼스·한글명 기준으로 canonical code로 먼저 전환한다.
  FK는 `ON UPDATE CASCADE`로 연결된 사용자·시즌 프로필 참조를 함께 보존한다.
- reference에서 제거된 생활관·단과대는 삭제하지 않고 `isActive = false`로 전환한다.
- 생활관은 `matchingSupported = false`도 함께 적용해 stale season operation이 action을 열지 못하게 한다.
- 실패 시 전체 transaction을 rollback하고 DB URL, credential, row payload를 로그에 출력하지 않는다.
- runtime app role이 아니라 migration/reference write 권한을 가진 direct connection으로 실행한다.

## Fresh database 적용 순서

빈 PostgreSQL/RDS에는 schema를 먼저 적용한 뒤 reference seed를 실행한다.

```bash
# local·개발 환경의 schema 동기화 검증
pnpm db:push
pnpm db:seed:reference

# 배포 환경
pnpm api:db:deploy:migrate
pnpm db:seed:reference
```

- `prisma db push`는 빈 DB에서도 현재 schema를 생성할 수 있어야 하지만 migration 이력을 만들지는 않는다.
- 배포 RDS는 `_prisma_migrations`와 baseline 이력을 보존해야 하므로 `prisma migrate deploy` owner인
  `api:db:deploy:migrate`를 사용한다.
- reference seed는 두 경로 모두에서 같은 결과를 내며 schema migration을 대신하지 않는다.

## 생활관 데이터 의미

`Dormitory`는 학교 시설 안내 전체가 아니라 매칭 정책에 필요한 최소 master다.

- `roomType`: 제품에서 선택 가능한 roommate cohort size
- `genderPolicy`: 성별 선택 가능 범위
- `matchingSupported`: 일반 학생 매칭 catalog 포함 여부
- `isActive`: 학교의 현재 운영 master 여부

전화번호, 규정, 편의시설, 식당 정보는 reference seed의 필수 시작 데이터가 아니다.
학교 일정에 따라 실제 매칭을 여는 책임은 `SeasonDormitoryOperation`이 소유한다.

## Dormitory master와 시즌 운영 분리

`Dormitory`는 이름과 달리 전역 생활관 master 역할을 하고, `SeasonDormitoryOperation`은
`seasonId + dormitoryId`별 운영 여부와 호실 선택일을 소유한다. 두 모델은 통합하지 않는다.

- 같은 생활관의 운영 여부와 `roomSelectionDate`는 학기마다 달라진다.
- master에 시즌 값을 덮어쓰면 과거 시즌의 종료 기준과 이력을 복원할 수 없다.
- 시즌별 `Dormitory` row를 복제하면 사용자 선택·과거 이력 FK의 안정적인 생활관 identity를 잃는다.
- 사용자 선택 및 신규 매칭 action은 `Dormitory.isActive + matchingSupported`와
  `SeasonDormitoryOperation.isOperated + roomSelectionDate`를 함께 만족해야 한다.

`Dormitory`를 `DormitoryMaster`로 이름만 변경하는 것은 의미를 더 명확히 할 수 있지만,
현재 구조의 책임을 바꾸지 않으면서 Prisma model과 호출부만 대규모로 변경하므로 별도 migration
필요가 생기기 전에는 유지한다.

## 외부 근거

- 춘천캠퍼스 생활관 시설:
  <https://knudorm.kangwon.ac.kr/content/K08>
- 춘천캠퍼스 2026학년도 2학기 선발 안내:
  <https://knudorm.kangwon.ac.kr/resources/2026_2.pdf>
- 삼척캠퍼스 생활관 시설:
  <https://dormitory.kangwon.ac.kr/bbs/content.php?co_id=1_5>
- 도계캠퍼스 생활관:
  <https://dorm.kangwon.ac.kr/>
- 삼척·도계 생활관 인실 구성(2026학년도 강원대학교 모집요강):
  <https://wwwk.kangwon.ac.kr/DATA/download/admission/2026%ED%95%99%EB%85%84%EB%8F%84%20%EA%B0%95%EC%9B%90%EB%8C%80%ED%95%99%EA%B5%90%20%EC%A0%95%EC%8B%9C%EB%AA%A8%EC%A7%91%EC%9A%94%EA%B0%95_1%EC%B0%A8%20%EC%88%98%EC%A0%95%2820250915%29%28%EA%B3%B5%EA%B0%9C%EC%9A%A9%29.pdf>
- Prisma seeding: <https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding>
- PostgreSQL deterministic upsert: <https://www.postgresql.org/docs/current/sql-insert.html>
- OWASP repository secret guidance:
  <https://owasp.org/www-project-devsecops-guideline/latest/01a-Secrets-Management>

## 검증

```bash
pnpm --dir apps/api test --run \
  src/architecture/reference-data/college-reference-data.spec.ts \
  src/architecture/reference-data/dormitory-reference-data.spec.ts \
  src/architecture/reference-data/reference-seed-scripts.spec.ts
pnpm --dir apps/api prisma:validate
pnpm api:typecheck
```
