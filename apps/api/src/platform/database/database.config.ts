import { registerAs } from '@nestjs/config';
import {
  readBooleanEnv,
  readNumberEnv,
  readStringEnv,
} from '../../config/environment/env.helpers.js';

export const DEFAULT_DATABASE_URL =
  'postgresql://knu_dev:knu_dev_password@localhost:5432/knu_roommate?schema=public';
export const DEFAULT_DATABASE_ADAPTER_CONNECT_TIMEOUT_MS = 5_000;
export const DEFAULT_DATABASE_ADAPTER_IDLE_TIMEOUT_MS = 300_000;
export const DEFAULT_DATABASE_POOL_MAX = 10;
export const DEFAULT_DATABASE_POOL_MIN = 0;
export const DEFAULT_DATABASE_QUERY_TIMEOUT_MS = 0;
export const DEFAULT_DATABASE_STATEMENT_TIMEOUT_MS = 0;
export const DEFAULT_DATABASE_APPLICATION_NAME = 'knu-roommate-api';
export const DEFAULT_RETENTION_WORKER_DATABASE_APPLICATION_NAME =
  'knu-roommate-api-retention-worker';
export const DEFAULT_RETENTION_DISCLOSURE_DATABASE_APPLICATION_NAME =
  'knu-roommate-api-retention-disclosure';
export const DEFAULT_PRISMA_QUERY_LOG_EVENTS = false;

function resolveSchema(databaseUrl: string) {
  return new URL(databaseUrl).searchParams.get('schema');
}

export default registerAs('database', () => {
  const runtimeDatabaseUrl = readStringEnv(process.env, 'DATABASE_URL', DEFAULT_DATABASE_URL);
  const retentionWorkerDatabaseUrl = readStringEnv(
    process.env,
    'RETENTION_WORKER_DATABASE_URL',
    runtimeDatabaseUrl,
  );
  const retentionDisclosureDatabaseUrl = readStringEnv(
    process.env,
    'RETENTION_DISCLOSURE_DATABASE_URL',
    runtimeDatabaseUrl,
  );

  return {
    runtimeDatabaseUrl,
    runtimeSchema: resolveSchema(runtimeDatabaseUrl),
    retentionWorkerDatabaseUrl,
    retentionWorkerSchema: resolveSchema(retentionWorkerDatabaseUrl),
    retentionDisclosureDatabaseUrl,
    retentionDisclosureSchema: resolveSchema(retentionDisclosureDatabaseUrl),
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
    retentionWorkerApplicationName: readStringEnv(
      process.env,
      'RETENTION_WORKER_DATABASE_APPLICATION_NAME',
      DEFAULT_RETENTION_WORKER_DATABASE_APPLICATION_NAME,
    ),
    retentionDisclosureApplicationName: readStringEnv(
      process.env,
      'RETENTION_DISCLOSURE_DATABASE_APPLICATION_NAME',
      DEFAULT_RETENTION_DISCLOSURE_DATABASE_APPLICATION_NAME,
    ),
    prismaQueryLogEvents: readBooleanEnv(
      process.env,
      'PRISMA_QUERY_LOG_EVENTS',
      DEFAULT_PRISMA_QUERY_LOG_EVENTS,
    ),
  };
});
