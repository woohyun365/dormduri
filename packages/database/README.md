# @repo/database

PostgreSQL schema와 그 schema에서 만드는 Prisma Client를 여러 서버 앱이 같이 쓰도록 둔 공유 DB package다. 지금 쓰는 앱은
사용자 API(`apps/api`)뿐이고, 같은 DB를 쓰는 서버 앱이 생기면 그 앱도 이 package를 import한다.

## 이 package가 가진 것

| 경로                                | 내용                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `prisma/schema.prisma`              | Prisma schema(model·enum·관계·index)                                                      |
| `prisma/migrations/`                | 적용 순서대로 쌓는 migration. 적용한 migration은 고치지 않고 새 migration을 더한다        |
| `prisma/sql/`                       | 제품 TypedSQL query. 쓰는 곳·종류·의미는 API architecture test의 SQL inventory가 고정한다 |
| `prisma/role-grants/`               | DB role·grant SQL. 적용·확인은 [`infra/db/`](../../infra/db/README.md) script가 한다      |
| `prisma.config.ts`                  | Prisma CLI 설정. 로컬 개발 값은 `apps/api/.env`에서 읽는다                                |
| `src/client.ts`·`enums.ts`·`sql.ts` | 진입점. `src/generated/prisma/`(생성물, Git 밖)를 다시 내보낸다                           |

seed(`apps/api/prisma/seed.js`·`seed-data/`·`seeds/`)는 사용자 API의 개발·test data라 `apps/api`에 있다. Prisma Client를
만드는 `PrismaService`와 driver adapter·pool 설정은 각 앱의 platform 배선(`apps/api/src/platform/database`)이 가진다.

## 진입점

| import                  | 내용                                              |
| ----------------------- | ------------------------------------------------- |
| `@repo/database/client` | `PrismaClient`, `Prisma` namespace, model type    |
| `@repo/database/enums`  | enum 값과 type(Prisma Client runtime을 싣지 않음) |
| `@repo/database/sql`    | TypedSQL 함수                                     |

진입점은 `dist/`를 가리킨다. 그래서 앱이 build·typecheck·test 전에 client 생성과 build를 먼저 한다(API는
`pnpm api:prepare`·`pnpm api:prisma:generate`).

## 명령

repo root 기준:

```bash
pnpm --dir packages/database prisma:validate   # schema 검사
pnpm --dir packages/database prisma:generate   # client와 TypedSQL 생성(DB 연결 필요)
pnpm --dir packages/database build             # dist 생성
pnpm --dir packages/database prisma:migrate    # 개발 중 migration 생성·적용(migrate dev)
pnpm database:lint                             # 진입점과 prisma.config.ts lint
pnpm db:seed                                   # prisma db seed → apps/api seed script
```

- TypedSQL 생성(`prisma generate --sql`)은 SQL 결과 type을 DB에 물어 만든다. 그래서 migration이 적용된 PostgreSQL이 떠
  있어야 한다(CI는 `migrate deploy` 뒤 `pnpm api:prepare`, 로컬은 `pnpm db:up` 뒤). API image build는 DB 없이 미리 만든
  생성물을 복사해 build만 한다.
- Prisma 7은 `migrate dev`·`migrate reset`·`db push` 뒤 seed를 자동 실행하지 않는다. seed가 필요하면 그 뒤 `pnpm db:seed`를
  따로 실행한다. seed script는 생성 client 없이 `pg`로 실행한다.
- Production migration은 `pnpm api:db:deploy:migrate`([`infra/db/README.md`](../../infra/db/README.md))로만 적용한다.
