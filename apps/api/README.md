# apps/api 실행 · 테스트 가이드

이 문서는 `apps/api`를 처음 실행하거나, 로컬에서 Prisma/Nest 환경을 검증하려는 개발자를 위한 빠른 안내서다.

핵심 목표:

- 로컬 DB를 띄운다
- schema를 반영하고 seed를 넣는다
- API를 실행한다
- 기본 검증 명령과 테스트 계정을 바로 확인한다

## 1. 기본 구성

- API 런타임: NestJS 12
- ORM: Prisma 7
- DB: PostgreSQL 18
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
DATABASE_URL="postgresql://dormduri_dev:dormduri_dev_password@localhost:5432/dormduri?schema=public"
# Prisma CLI가 사용하는 direct URL. 운영에서는 세션 유지 가능한 direct URL 권장.
DIRECT_URL="postgresql://dormduri_dev:dormduri_dev_password@localhost:5432/dormduri?schema=public"
PORT=4000
VERIFICATION_CODE_HMAC_SECRET="<generate-with-openssl-rand-base64-32>"
AUTH_PERSISTENCE_HMAC_SECRET="<generate-with-openssl-rand-base64-32>"
AUTH_PERSISTENCE_HMAC_KEY_VERSION="v1"
AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64="<generate-with-openssl-rand-base64-32>"
AUTH_MAIL_ENVELOPE_KEY_VERSION="v1"
```

권장:

```bash
cp apps/api/.env.example apps/api/.env
```

환경 정책:

- `development`: Prisma CLI(`prisma:generate`, migrate 등)는 stale shell/tmux env로 인한 P1000을 막기 위해 `apps/api/.env`를 로컬 source of truth로 보고 inherited `DATABASE_URL`/`DIRECT_URL`을 덮어쓴다.
- `test`: integration sandbox가 주입하는 disposable schema URL을 보존하기 위해 `.env`가 이미 주입된 `DATABASE_URL`/`DIRECT_URL`을 덮어쓰지 않는다.
- `production`: `DATABASE_URL`, `DIRECT_URL`, `VERIFICATION_CODE_HMAC_SECRET`, `AUTH_PERSISTENCE_HMAC_SECRET`, `AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64` 누락 시 앱 시작 실패. `AUTH_PERSISTENCE_HMAC_KEY_VERSION`은 digest prefix/rotation marker이며 secret과 함께 변경 이력을 관리한다. secret manager/infra 주입값을 `.env`로 덮어쓰지 않는다.

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
- `PRISMA_QUERY_LOG_EVENTS`: `1/true/yes/on`이면 Prisma query event를 활성화한다. 통합 테스트 SQL trace처럼 실패 시점 진단이 필요할 때만 켠다.

현재 auth transport는 JWT bridge 대신 DB-backed opaque session token을 사용하므로 `JWT_SECRET`은 더 이상 API 런타임 필수 환경변수가 아니다. 실제 운영/배포에서는 남은 DB/HMAC/provider secret을 반드시 환경변수 또는 secret store로 주입해야 한다.

## 3. 로컬 실행 순서

repo root 기준:

```bash
pnpm db:up
pnpm --dir apps/api prisma:migrate
pnpm db:seed
pnpm --dir apps/api start:dev
```

로컬 DB 이름이 `dormduri`가 되기 전에 만든 dev DB는 새로 만든다. 그 DB가 5432에 떠 있으면 DB에 붙는 명령(`prisma:migrate`, `prisma generate --sql`을 부르는 `prisma:generate`·`pnpm api:check`)이 새 사용자 인증 실패(`P1000`)로 멈춘다. 옛 데이터는 옮기지 않는다(보존 암호 결속 값과 baseline index 이름이 바뀌어 새 코드와 맞지 않는다).

1. 옛 dev DB를 멈춰 port 5432를 비운다: `docker stop knu-roommate-postgres-dev`(옛 이름). 되돌릴 때 쓰므로 지우지 않는다.
2. 위 순서의 `pnpm db:up` → `pnpm --dir apps/api prisma:migrate` → `pnpm db:seed`로 새 DB(`dormduri-postgres-dev`, volume `dormduri-dev_dormduri-postgres-data`)를 띄우고 채운다. 빈 DB라 `prisma:migrate`는 새 migration 이름을 묻지 않는다.
3. `apps/api/.env`가 있으면 Prisma CLI가 그 값을 먼저 쓰므로(2절) `DATABASE_URL`·`DIRECT_URL`을 2절 예시 값으로 고친다.
4. 옛 데이터가 필요하면 옛 container를 다시 띄워 직접 읽는다. 남은 옛 이름 자원은 [로컬 환경 runbook](../../infra/runbooks/rehearsal/local-environments.md#옛-이름-자원)에서 골라 지운다.

`docker-compose.dev.yml`은 compose project 이름을 `dormduri-dev`로 고정하므로 이 저장소의 checkout 여럿이 같은 dev DB를 쓴다. 한 번에 한 checkout에서만 띄운다. 다른 checkout으로 옮긴 뒤 `prisma:migrate`가 적용된 migration이 바뀌었거나 DB와 다르다고 알리고 멈추면(DB는 바뀌지 않음), 로컬 데이터를 지워도 될 때 `pnpm --dir apps/api exec prisma migrate reset` 뒤 `pnpm db:seed`로 맞춘다.

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
- `pnpm api:check`, `pnpm api:build`, `pnpm api:test` 실행 전에는 로컬 PostgreSQL이 떠 있고 migration이 적용된 상태여야 한다.

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

## 6. 검증 명령

루트 public command는 fresh checkout에서 단독 실행할 수 있도록 Shared build와 Prisma generation을 포함한다.
GitHub Actions는 `pnpm api:prepare`를 한 번 실행한 뒤 prepared command를 사용해 같은 준비를 반복하지 않는다.

| 목적           | 로컬 public command         | CI prepared command                  |
| -------------- | --------------------------- | ------------------------------------ |
| 준비           | public command가 자동 수행  | `pnpm api:prepare`                   |
| lint/typecheck | `pnpm api:check`            | `pnpm api:check:prepared`            |
| unit           | `pnpm api:test`             | `pnpm api:test:prepared`             |
| integration    | `pnpm api:test:integration` | `pnpm api:test:integration:prepared` |
| E2E            | `pnpm api:test:e2e`         | `pnpm api:test:e2e:prepared`         |
| stress harness | `pnpm api:test:stress`      | `pnpm api:test:stress:prepared`      |
| 전체 test      | `pnpm api:test:ci`          | 각 test lane을 개별 실행             |
| build          | `pnpm api:build`            | `pnpm api:build:prepared`            |

Prepared command는 CI 내부 capability다. 로컬에서는 개별 명령의 독립 실행성을 보존하는 public command를 기본으로 사용한다.
Integration local/full command는 suite별 UUID schema와 worker 2를 사용하고, Hosted CI는 독립 PostgreSQL runner 두 개가
stable shard를 하나씩 소유한다. E2E는 worker 1을 유지하며 Dockerized real load는 일반 PR gate가 아닌 rehearsal 범위다.

Runtime emit은 `nest-cli.json`과 `.swcrc`가 소유하는 ESM SWC builder를 사용한다. SWC는 typecheck를 수행하지 않으므로
`pnpm api:check`와 CI static gate의 TypeScript `noEmit` 검증을 제거하지 않는다. Production build는 test source와 declaration을
emit하지 않으며 `dist/main.js`, source map, decorator metadata를 보존한다.

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
pnpm api:test
pnpm api:test:integration
pnpm api:test:e2e
pnpm api:test:stress
```

### 6-4. lint/typecheck

```bash
pnpm api:check
```

변경 파일만 먼저 보고 싶으면:

```bash
pnpm --dir apps/api exec eslint \
  src/platform/runtime/app.config.ts \
  src/auth/config/auth.config.ts \
  src/platform/database/database.config.ts \
  src/platform/database/prisma.service.ts \
  prisma.config.ts \
  --no-warn-ignored
```

## 7. 실행 후 확인 포인트

### 7-1. DB seed 확인

예시:

```bash
docker exec dormduri-postgres-dev \
  psql -U dormduri_dev -d dormduri \
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
  - `docs/development/troubleshooting/database/prisma-7-seed-config-and-generated-client.md`
- season date-only 규칙:
  - `docs/architecture/data/date-only-normalization-rule.md`
