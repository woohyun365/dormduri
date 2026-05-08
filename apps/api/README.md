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
# 앱 런타임이 사용하는 URL. 운영에서는 pooled / pooler URL 권장.
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public"
# Prisma CLI가 사용하는 direct URL. 운영에서는 세션 유지 가능한 direct URL 권장.
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public"
PORT=4000
JWT_SECRET="<generate-with-openssl-rand-base64-32>"
VERIFICATION_CODE_HMAC_SECRET="<generate-with-openssl-rand-base64-32>"
```

권장:

```bash
cp apps/api/.env.example apps/api/.env
```

환경 정책:

- `development / test`: 로컬 fallback 허용
- `production`: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `VERIFICATION_CODE_HMAC_SECRET` 누락 시 앱 시작 실패

운영 권장 연결 경로:

- **앱 런타임**: `DATABASE_URL` → pooled / external pooler / provider pooler URL
- **Prisma CLI**: `DIRECT_URL` → migrate / validate / admin 용 direct connection

선택적 pool 튜닝 환경변수:

- `DATABASE_POOL_MAX`
- `DATABASE_POOL_MIN`
- `DATABASE_ADAPTER_CONNECT_TIMEOUT_MS`
- `DATABASE_ADAPTER_IDLE_TIMEOUT_MS`
- `DATABASE_QUERY_TIMEOUT_MS`
- `DATABASE_STATEMENT_TIMEOUT_MS`
- `DATABASE_APPLICATION_NAME`

즉, 실제 운영/배포에서는 반드시 환경변수 또는 secret store로 주입해야 한다.

## 3. 로컬 실행 순서

repo root 기준:

```bash
pnpm db:up
pnpm --dir apps/api prisma:migrate
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

TypedSQL을 함께 생성하므로 내부적으로 `prisma generate --sql`을 사용한다.

주의:

- TypedSQL generate는 SQL 파일 타입 추론을 위해 DB 연결이 필요하다.
- `pnpm check:api`, `pnpm build:api`, `pnpm test:api` 실행 전에는 로컬 PostgreSQL이 떠 있고 migration이 적용된 상태여야 한다.

### 4-3. migration 생성 / 적용

개발 중 schema 변경은 `migrate dev` 기준으로 반영한다.

```bash
pnpm --dir apps/api prisma:migrate
```

필요하면 migration 상태를 먼저 확인한다.

```bash
pnpm --dir apps/api exec prisma migrate status
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
pnpm --dir apps/api prisma:migrate
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
  src/config/app.config.ts \
  src/config/auth.config.ts \
  src/config/database.config.ts \
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
