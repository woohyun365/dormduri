import { registerAs } from '@nestjs/config';
import { readBooleanEnv, readNumberEnv } from './env.helpers.js';

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
export const CHAT_REALTIME_ALLOWED_ORIGINS_ENV = 'CHAT_REALTIME_ALLOWED_ORIGINS';

export const DEFAULT_CHAT_REALTIME_DISPATCHER_ENABLED = nodeEnv !== 'test';
export const DEFAULT_CHAT_REALTIME_DISPATCHER_INTERVAL_MS = 1_000;
export const DEFAULT_CHAT_REALTIME_DISPATCHER_BATCH_SIZE = 50;
export const DEFAULT_CHAT_REALTIME_DISPATCHER_CLAIM_LEASE_MS = 30_000;
export const DEFAULT_CHAT_REALTIME_DISPATCHER_RETRY_BASE_MS = 1_000;
export const DEFAULT_CHAT_REALTIME_DISPATCHER_RETRY_MAX_MS = 60_000;

export function readChatRealtimeAllowedOrigins(
  env: NodeJS.ProcessEnv = process.env,
): string[] | false {
  const raw = env[CHAT_REALTIME_ALLOWED_ORIGINS_ENV]?.trim();
  if (!raw) {
    return false;
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : false;
}

export default registerAs('chatRealtime', () => ({
  allowedOrigins: readChatRealtimeAllowedOrigins(process.env),
  dispatcherEnabled: readBooleanEnv(
    process.env,
    'CHAT_REALTIME_DISPATCHER_ENABLED',
    DEFAULT_CHAT_REALTIME_DISPATCHER_ENABLED,
  ),
  dispatcherIntervalMs: readNumberEnv(
    process.env,
    'CHAT_REALTIME_DISPATCHER_INTERVAL_MS',
    DEFAULT_CHAT_REALTIME_DISPATCHER_INTERVAL_MS,
    { min: 100 },
  ),
  dispatcherBatchSize: readNumberEnv(
    process.env,
    'CHAT_REALTIME_DISPATCHER_BATCH_SIZE',
    DEFAULT_CHAT_REALTIME_DISPATCHER_BATCH_SIZE,
    { min: 1 },
  ),
  dispatcherClaimLeaseMs: readNumberEnv(
    process.env,
    'CHAT_REALTIME_DISPATCHER_CLAIM_LEASE_MS',
    DEFAULT_CHAT_REALTIME_DISPATCHER_CLAIM_LEASE_MS,
    { min: 1_000 },
  ),
  dispatcherRetryBaseMs: readNumberEnv(
    process.env,
    'CHAT_REALTIME_DISPATCHER_RETRY_BASE_MS',
    DEFAULT_CHAT_REALTIME_DISPATCHER_RETRY_BASE_MS,
    { min: 100 },
  ),
  dispatcherRetryMaxMs: readNumberEnv(
    process.env,
    'CHAT_REALTIME_DISPATCHER_RETRY_MAX_MS',
    DEFAULT_CHAT_REALTIME_DISPATCHER_RETRY_MAX_MS,
    { min: 1_000 },
  ),
}));
