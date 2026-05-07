/// <reference types="node" />
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  typedSql: {
    path: 'prisma/sql',
  },
  migrations: {
    path: 'prisma/migrations',
    seed: 'pnpm run prisma:seed:run',
  },
  datasource: {
    // Prisma v7 docs recommend env() for required vars, but also note that direct
    // process.env access is preferable when the URL may be absent for commands like
    // generate/type-check flows. We keep a local fallback for this repo's dev UX.
    url: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
  },
});
