import { registerAs } from '@nestjs/config';
import { readNumberEnv, readStringEnv } from './env.helpers.js';

export const DEFAULT_DATABASE_URL =
  'postgresql://postgres:postgres@localhost:5432/knu_roommate?schema=public';
export const DEFAULT_DATABASE_ADAPTER_CONNECT_TIMEOUT_MS = 5_000;
export const DEFAULT_DATABASE_ADAPTER_IDLE_TIMEOUT_MS = 300_000;
export const DEFAULT_DATABASE_POOL_MAX = 10;
export const DEFAULT_DATABASE_POOL_MIN = 0;
export const DEFAULT_DATABASE_QUERY_TIMEOUT_MS = 0;
export const DEFAULT_DATABASE_STATEMENT_TIMEOUT_MS = 0;
export const DEFAULT_DATABASE_APPLICATION_NAME = 'knu-roommate-api';

export default registerAs('database', () => {
  const runtimeDatabaseUrl = readStringEnv(process.env, 'DATABASE_URL', DEFAULT_DATABASE_URL);

  return {
    runtimeDatabaseUrl,
    directDatabaseUrl: readStringEnv(process.env, 'DIRECT_URL', runtimeDatabaseUrl),
    adapterConnectionTimeoutMs: readNumberEnv(
      process.env,
      'DATABASE_ADAPTER_CONNECT_TIMEOUT_MS',
      DEFAULT_DATABASE_ADAPTER_CONNECT_TIMEOUT_MS,
      { min: 1 },
    ),
    adapterIdleTimeoutMs: readNumberEnv(
      process.env,
      'DATABASE_ADAPTER_IDLE_TIMEOUT_MS',
      DEFAULT_DATABASE_ADAPTER_IDLE_TIMEOUT_MS,
      { min: 1 },
    ),
    poolMax: readNumberEnv(process.env, 'DATABASE_POOL_MAX', DEFAULT_DATABASE_POOL_MAX, {
      min: 1,
    }),
    poolMin: readNumberEnv(process.env, 'DATABASE_POOL_MIN', DEFAULT_DATABASE_POOL_MIN, {
      min: 0,
    }),
    queryTimeoutMs: readNumberEnv(
      process.env,
      'DATABASE_QUERY_TIMEOUT_MS',
      DEFAULT_DATABASE_QUERY_TIMEOUT_MS,
      { min: 0 },
    ),
    statementTimeoutMs: readNumberEnv(
      process.env,
      'DATABASE_STATEMENT_TIMEOUT_MS',
      DEFAULT_DATABASE_STATEMENT_TIMEOUT_MS,
      { min: 0 },
    ),
    applicationName: readStringEnv(
      process.env,
      'DATABASE_APPLICATION_NAME',
      DEFAULT_DATABASE_APPLICATION_NAME,
    ),
  };
});
