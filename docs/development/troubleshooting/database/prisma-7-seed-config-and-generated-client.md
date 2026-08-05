# Prisma 7 seed 설정과 custom generated client 경계

**상태**: Current
**마지막 검증 환경**: Prisma 7.8, Node.js ESM, PostgreSQL 16
**현재 owner**: `apps/api/prisma.config.ts`, `apps/api/prisma/seed.js`, `apps/api/package.json`

## 증상

- `package.json`의 과거 Prisma seed 설정을 CLI가 읽지 않습니다.
- Custom output인 `apps/api/src/generated/prisma`를 TypeScript seed에서 직접 import하면 ESM의 `.js` specifier와 실행 시점의 `.ts` 파일이 충돌할 수 있습니다.

## 원인

Prisma 7 seed command는 `prisma.config.ts`의 `migrations.seed`가 소유합니다. 또한 seed CLI는 Nest
application runtime과 다른 module-resolution 경로로 실행되므로 generated client를 그대로 재사용한다는
가정이 안전하지 않습니다.

## 해결

- `prisma.config.ts`는 `seed: 'pnpm run prisma:seed:run'`을 사용합니다.
- `prisma:seed:run`은 shared build 이후 `node prisma/seed.js`를 실행합니다.
- Main seed와 reference seed는 JavaScript + `pg` 경계에서 독립 실행합니다.
- Prisma 7에서 `migrate dev`나 `db push`가 seed를 자동 실행한다고 가정하지 않습니다.

```bash
pnpm db:up
pnpm db:push
pnpm db:seed
pnpm db:seed:reference
```

## 검증

```bash
pnpm --dir apps/api prisma:validate
pnpm api:prisma:generate
pnpm api:typecheck
```

## 참고

- [Prisma seeding](https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding)
- [Prisma config reference](https://www.prisma.io/docs/orm/reference/prisma-config-reference)
