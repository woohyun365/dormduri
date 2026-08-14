import { registerAs } from '@nestjs/config';
import { readBooleanEnv, readStringEnv } from '../../config/environment/env.helpers.js';
import { DEFAULT_NODE_ENV } from '../runtime/app.config.js';

export const DEFAULT_LOG_LEVEL = 'info';
export const DEFAULT_LOG_HASH_SECRET = 'local-log-hash-secret-change-me';
export const DEFAULT_LOG_PRETTY = false;
export const DEFAULT_OBSERVABILITY_SERVICE_NAME = 'api';
export const DEFAULT_METRICS_ENABLED = true;
export const DEFAULT_METRICS_BEARER_TOKEN = null;
export const DEFAULT_METRICS_ROUTE = 'internal/metrics';
export const DEFAULT_METRICS_HTTP_DURATION_BUCKETS = [
  0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2, 5,
] as const;

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
    metricsEnabled: readBooleanEnv(process.env, 'METRICS_ENABLED', DEFAULT_METRICS_ENABLED),
    metricsBearerToken: process.env.METRICS_BEARER_TOKEN?.trim() || DEFAULT_METRICS_BEARER_TOKEN,
    metricsRoute: DEFAULT_METRICS_ROUTE,
    metricsHttpDurationBuckets: [...DEFAULT_METRICS_HTTP_DURATION_BUCKETS],
  };
});
