/// <reference types="node" />
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';
const DEFAULT_DIRECT_URL = DEFAULT_DATABASE_URL;

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
    // Production-grade split:
    // - runtime Prisma Client uses DATABASE_URL (pooled / app traffic)
    // - Prisma CLI uses DIRECT_URL (direct session connection for migrate/admin)
    // Dev/test can safely fall back to DATABASE_URL when DIRECT_URL is absent.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? DEFAULT_DIRECT_URL,
  },
});
