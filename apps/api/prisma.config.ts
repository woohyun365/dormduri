/// <reference types="node" />
import { fileURLToPath } from 'node:url';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

const DEFAULT_DATABASE_URL =
  'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public';
const DEFAULT_DIRECT_URL = DEFAULT_DATABASE_URL;
const LOCAL_DOTENV_PATH = fileURLToPath(new URL('.env', import.meta.url));

/**
 * Local Codex/tmux shells can inherit stale DATABASE_URL/DIRECT_URL values from
 * older sessions. Prisma CLI gives DIRECT_URL precedence, so development
 * generate/migrate commands should treat apps/api/.env as the local source of
 * truth. Test and production keep explicit environment injection so integration
 * sandbox schemas and production secret managers are not overwritten.
 */
loadDotenv({
  path: LOCAL_DOTENV_PATH,
  override: process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production',
  quiet: true,
});

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
