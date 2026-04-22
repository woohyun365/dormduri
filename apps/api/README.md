# apps/api 실행 · 테스트 가이드

이 문서는 `apps/api`를 처음 실행하거나, 로컬에서 Prisma/Nest 환경을 검증하려는 개발자를 위한 빠른 안내서다.

핵심 목표:

- 로컬 DB를 띄운다
- schema를 반영하고 seed를 넣는다
- API를 실행한다
- 기본 검증 명령과 테스트 계정을 바로 확인한다

## 1. 기본 구성

- API 런타임: NestJS 11
- ORM: Prisma 7
- DB: PostgreSQL 16
- Prisma schema: `apps/api/prisma/schema.prisma`
- Prisma config: `apps/api/prisma.config.ts`
- Seed script: `apps/api/prisma/seed.js`

## 2. 환경변수

로컬 개발 기본 파일:

- `apps/api/.env`
- 예시: `apps/api/.env.example`

예시 값:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public"
PORT=4000
JWT_SECRET="<generate-with-openssl-rand-base64-32>"
```

권장:

```bash
cp apps/api/.env.example apps/api/.env
```

환경 정책:

- `development / test`: 로컬 fallback 허용
- `production`: `DATABASE_URL`, `JWT_SECRET` 누락 시 앱 시작 실패

즉, 실제 운영/배포에서는 반드시 환경변수 또는 secret store로 주입해야 한다.

## 3. 로컬 실행 순서

repo root 기준:

```bash
pnpm db:up
pnpm db:push
pnpm db:seed
pnpm --dir apps/api start:dev
```

웹까지 함께 띄우려면:

```bash
pnpm dev
```

DB 제어 명령:

```bash
pnpm db:up
pnpm db:down
pnpm db:logs
```

## 4. Prisma / DB 기본 명령

### 4-1. schema validate

```bash
pnpm --dir apps/api prisma:validate
```

### 4-2. Prisma Client generate

```bash
pnpm --dir apps/api prisma:generate
```

생성 경로:

```text
apps/api/src/generated/prisma
```

### 4-3. schema 반영

개발 중에는 현재 `db push` 기준으로 정렬한다.

```bash
pnpm db:push
```

### 4-4. seed 실행

```bash
pnpm db:seed
```

## 5. 테스트 계정

공통 비밀번호:

```text
1q2w3e4r
```

주요 계정:

| 검증 시나리오           | 이메일                          | 닉네임         | 비고                |
| ----------------------- | ------------------------------- | -------------- | ------------------- |
| 운영 캠퍼스 기본 로그인 | `test@kangwon.ac.kr`            | `테스트춘천남` | 춘천 / `ASSIGNED`   |
| 운영 캠퍼스 여성 검증   | `test-f@kangwon.ac.kr`          | `테스트춘천여` | 춘천 / `ASSIGNED`   |
| 비운영 캠퍼스 남성 검증 | `test-samcheok-m@kangwon.ac.kr` | `테스트삼척남` | 삼척 / `UNASSIGNED` |
| 비운영 캠퍼스 여성 검증 | `test-samcheok-f@kangwon.ac.kr` | `테스트삼척여` | 삼척 / `UNASSIGNED` |
| 비운영 캠퍼스 남성 검증 | `test-dogye-m@kangwon.ac.kr`    | `테스트도계남` | 도계 / `UNASSIGNED` |
| 비운영 캠퍼스 여성 검증 | `test-dogye-f@kangwon.ac.kr`    | `테스트도계여` | 도계 / `UNASSIGNED` |

## 6. 빠른 검증 명령

### 6-1. 최소 실행 확인

```bash
pnpm --dir apps/api prisma:validate
pnpm db:push
pnpm db:seed
pnpm --dir apps/api start:dev
```

### 6-2. 빌드 검증

```bash
pnpm --dir apps/api build
```

### 6-3. 테스트

```bash
pnpm --dir apps/api test
```

### 6-4. lint

```bash
pnpm --dir apps/api lint
```

변경 파일만 먼저 보고 싶으면:

```bash
pnpm --dir apps/api exec eslint \
  src/config/env.ts \
  src/common/prisma/prisma.service.ts \
  prisma.config.ts \
  --no-warn-ignored
```

## 7. 실행 후 확인 포인트

### 7-1. DB seed 확인

예시:

```bash
docker exec knu-roommate-postgres-dev \
  psql -U postgres -d knu_roommate \
  -c 'SELECT email, nickname, campus, gender FROM "User" ORDER BY email;'
```

### 7-2. API smoke 확인

서버 실행 후 예시:

```bash
curl "http://localhost:4000/api/seasons/current?campus=CHUNCHEON"
curl "http://localhost:4000/api/dormitories?campus=CHUNCHEON&gender=M"
```

인증이 필요한 API는 로그인 후 access token을 붙여 호출한다.

## 8. 참고 문서

- Prisma / seed 관련 세부 이슈:
  - `docs/06_trouble-shooting/database/prisma-7-seed-config-and-generated-client.md`
- season date-only 규칙:
  - `docs/07_tech/database/date-only-normalization-rule.md`
