# apps/api ORM / Prisma 실행 가이드

이 문서는 `apps/api`의 Prisma ORM(현재 Prisma 7 기준) 실행 방법과
로컬 개발/검증 절차를 정리한다.

## 1. 현재 구성 요약

- ORM: Prisma 7
- DB: PostgreSQL 16
- API 런타임: NestJS 11
- Prisma schema: `apps/api/prisma/schema.prisma`
- Prisma config: `apps/api/prisma.config.ts`
- Seed script: `apps/api/prisma/seed.js`

중요:

- Prisma 7에서는 **seed가 자동 실행되지 않는다.**
- 따라서 seed는 반드시 명시적으로 `prisma db seed` 또는 repo script로 실행해야 한다.
- 이 프로젝트는 현재 `prisma.config.ts`의 `migrations.seed`에 seed 명령을 등록해 사용한다.

## 2. 환경변수

로컬 개발 기본 파일:

- `apps/api/.env`
- 예시: `apps/api/.env.example`

현재 기본값:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public"
PORT=4000
JWT_SECRET="dev-jwt-secret"
```

코드 레벨에서는 `.env`가 없더라도 development fallback이 남아 있지만,
실제 운용/배포에서는 **`.env`만 바꿔서 동작시키는 방식**을 기본으로 본다.

## 3. 로컬 DB 실행

repo root에서 실행:

```bash
pnpm db:up
```

중지:

```bash
pnpm db:down
```

로그 확인:

```bash
pnpm db:logs
```

## 4. Prisma 7 기준 기본 명령

### 4-1. schema validate

```bash
pnpm --dir apps/api prisma:validate
```

또는 repo root:

```bash
pnpm --dir apps/api exec prisma validate --schema prisma/schema.prisma
```

### 4-2. Prisma Client generate

```bash
pnpm --dir apps/api prisma:generate
```

이 프로젝트의 client output은 다음 경로다:

```text
apps/api/src/generated/prisma
```

### 4-3. DB에 schema 반영 (`db push`)

개발 중 빠르게 schema를 맞출 때:

```bash
pnpm db:push
```

또는:

```bash
pnpm --dir apps/api prisma:push
```

주의:

- `db push`는 migration 파일을 남기지 않는다.
- 프로토타이핑/로컬 개발 정렬에는 편하지만,
  운영 이력 관리가 필요한 단계에서는 `migrate dev`/migration 전략을 별도로 써야 한다.

공식 문서도 `db push`를 “migration 없이 schema 상태를 DB에 반영하는 방식”으로 설명한다.

### 4-4. seed 실행

```bash
pnpm db:seed
```

또는:

```bash
pnpm --dir apps/api prisma:seed
```

현재 seed는 `prisma.config.ts`에서 아래처럼 연결돼 있다:

```ts
migrations: {
  seed: 'node prisma/seed.js',
}
```

## 5. 현재 seed 데이터

기본 로그인/예외 처리/캠퍼스·성별 확인용 계정이 준비돼 있다.

공통 비밀번호:

```text
1q2w3e4r
```

주요 계정:

| 용도                            | 이메일                          | 닉네임         |
| ------------------------------- | ------------------------------- | -------------- |
| 기본 로그인                     | `test@kangwon.ac.kr`            | `테스트춘천남` |
| 운영캠퍼스 여성                 | `test-f@kangwon.ac.kr`          | `테스트춘천여` |
| 삼척 남                         | `test-samcheok-m@kangwon.ac.kr` | `테스트삼척남` |
| 삼척 여                         | `test-samcheok-f@kangwon.ac.kr` | `테스트삼척여` |
| 도계 남                         | `test-dogye-m@kangwon.ac.kr`    | `테스트도계남` |
| 도계 여                         | `test-dogye-f@kangwon.ac.kr`    | `테스트도계여` |
| 이미 가입된 이메일 예외 확인    | `existing-email@kangwon.ac.kr`  | `이메일중복`   |
| 이미 사용 중인 닉네임 예외 확인 | `nickname-holder@kangwon.ac.kr` | `중복닉테스트` |

## 6. Nest + Prisma 개발 실행 순서

repo root 기준 권장 순서:

```bash
pnpm db:up
pnpm db:push
pnpm db:seed
pnpm --dir apps/api start:dev
```

웹까지 함께 띄울 때:

```bash
pnpm dev
```

## 7. 테스트 / 검증 방법

### 7-1. ORM/DB 레벨 최소 검증

```bash
pnpm --dir apps/api prisma:validate
pnpm db:push
pnpm db:seed
```

권장 확인 포인트:

- schema 문법이 유효한가
- PostgreSQL 연결이 되는가
- `User` 테이블에 seed 계정이 들어갔는가

예시:

```bash
docker exec knu-roommate-postgres-dev \
  psql -U postgres -d knu_roommate \
  -c 'SELECT email, nickname, campus, gender FROM "User" ORDER BY email;'
```

### 7-2. API 빌드 검증

```bash
pnpm --dir apps/api build
```

이 명령은 Prisma Client generate 이후 Nest build까지 함께 확인한다.

### 7-3. API 테스트

```bash
pnpm --dir apps/api test
```

E2E가 추가되면:

```bash
pnpm --dir apps/api test:e2e
```

### 7-4. 변경 파일 중심 lint

전체 repo lint는 현재 unrelated warning/error에 영향받을 수 있으므로,
ORM/설정 변경 시에는 우선 변경 파일 기준으로 확인한다.

예:

```bash
pnpm --dir apps/api exec eslint \
  src/main.ts \
  src/common/prisma/prisma.service.ts \
  src/auth/auth.service.ts \
  src/config/env.ts \
  prisma.config.ts \
  --no-warn-ignored
```

## 8. migrate 관련 메모

현재 브랜치/상태에서는 `db push` + explicit seed 흐름으로 개발 정렬을 하고 있다.

향후 migration 이력을 본격 관리하려면:

```bash
pnpm --dir apps/api prisma:migrate
```

다만 Prisma 7에서는 예전처럼 `migrate dev` 뒤에 seed가 자동으로 돌지 않으므로,
필요하면 별도로 다시 실행해야 한다.

## 9. 왜 seed를 JS로 두었나

이 프로젝트는 Prisma client를 기본 경로가 아닌
`src/generated/prisma` 아래로 출력한다.

현재 Prisma 7 + 이 repo의 ESM/출력 구조 조합에서는
CLI seed 시점에 TS seed가 generated client import 해석 문제를 일으킬 수 있어,
현재는 **`node prisma/seed.js` 기반 seed**로 안정화했다.

즉:

- 앱 런타임에서는 Prisma generated client 사용
- seed는 Prisma 7 CLI와 충돌이 적은 JS 스크립트로 분리

## 10. 참고 문서

- Prisma Seeding: https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
- Prisma Config Reference: https://www.prisma.io/docs/orm/reference/prisma-config-reference
- Prisma CLI `db push`: https://www.prisma.io/docs/orm/reference/prisma-cli-reference
