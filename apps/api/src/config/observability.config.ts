import { registerAs } from '@nestjs/config';
import { readBooleanEnv, readStringEnv } from './env.helpers.js';
import { DEFAULT_NODE_ENV } from './app.config.js';

export const DEFAULT_LOG_LEVEL = 'info';
export const DEFAULT_LOG_HASH_SECRET = 'local-log-hash-secret-change-me';
export const DEFAULT_LOG_PRETTY = false;
export const DEFAULT_OBSERVABILITY_SERVICE_NAME = 'api';

export type ApiLogLevel = 'debug' | 'info' | 'warn' | 'error';

function readLogLevel(env: NodeJS.ProcessEnv): ApiLogLevel {
  const value = readStringEnv(env, 'LOG_LEVEL', DEFAULT_LOG_LEVEL).toLowerCase();

  return value === 'debug' || value === 'warn' || value === 'error' ? value : 'info';
}

export default registerAs('observability', () => {
  const nodeEnv = process.env.NODE_ENV?.trim() || DEFAULT_NODE_ENV;

  return {
    env: nodeEnv,
    serviceName: readStringEnv(
      process.env,
      'OBSERVABILITY_SERVICE_NAME',
      DEFAULT_OBSERVABILITY_SERVICE_NAME,
    ),
    logLevel: readLogLevel(process.env),
    logHashSecret: readStringEnv(process.env, 'LOG_HASH_SECRET', DEFAULT_LOG_HASH_SECRET),
    logPretty: readBooleanEnv(process.env, 'LOG_PRETTY', DEFAULT_LOG_PRETTY),
  };
});
