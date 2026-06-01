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
export const DEFAULT_CHAT_REALTIME_MESSAGE_USER_LIMIT = 30;
export const DEFAULT_CHAT_REALTIME_MESSAGE_USER_WINDOW_SECONDS = 60;
export const DEFAULT_CHAT_REALTIME_MESSAGE_PAIR_LIMIT = 20;
export const DEFAULT_CHAT_REALTIME_MESSAGE_PAIR_WINDOW_SECONDS = 60;
export const DEFAULT_CHAT_REALTIME_MESSAGE_BURST_LIMIT = 5;
export const DEFAULT_CHAT_REALTIME_MESSAGE_BURST_WINDOW_SECONDS = 10;
export const DEFAULT_CHAT_REALTIME_TICKET_USER_LIMIT = 10;
export const DEFAULT_CHAT_REALTIME_TICKET_USER_WINDOW_SECONDS = 60;
export const DEFAULT_CHAT_REALTIME_TICKET_IP_LIMIT = 60;
export const DEFAULT_CHAT_REALTIME_TICKET_IP_WINDOW_SECONDS = 60;
export const DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_LIMIT = 30;
export const DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS = 60;
export const DEFAULT_CHAT_REALTIME_WS_CONNECT_USER_LIMIT = 10;
export const DEFAULT_CHAT_REALTIME_WS_CONNECT_USER_WINDOW_SECONDS = 60;
export const DEFAULT_CHAT_REALTIME_WS_CONCURRENT_USER_LIMIT = 5;
export const DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_LIMIT = 60;
export const DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_WINDOW_SECONDS = 60;
export const DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_LIMIT = 10;
export const DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_WINDOW_SECONDS = 60;

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

export function readChatRealtimeWsConnectIpRateLimit(env: NodeJS.ProcessEnv = process.env) {
  return {
    limit: readNumberEnv(
      env,
      'CHAT_REALTIME_WS_CONNECT_IP_LIMIT',
      DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_LIMIT,
      {
        min: 1,
      },
    ),
    windowMs:
      readNumberEnv(
        env,
        'CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS',
        DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS,
        { min: 1 },
      ) * 1_000,
  };
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

  messageUserLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_MESSAGE_USER_LIMIT',
    DEFAULT_CHAT_REALTIME_MESSAGE_USER_LIMIT,
    { min: 1 },
  ),
  messageUserWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_MESSAGE_USER_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_MESSAGE_USER_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
  messagePairLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_MESSAGE_PAIR_LIMIT',
    DEFAULT_CHAT_REALTIME_MESSAGE_PAIR_LIMIT,
    { min: 1 },
  ),
  messagePairWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_MESSAGE_PAIR_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_MESSAGE_PAIR_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
  messageBurstLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_MESSAGE_BURST_LIMIT',
    DEFAULT_CHAT_REALTIME_MESSAGE_BURST_LIMIT,
    { min: 1 },
  ),
  messageBurstWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_MESSAGE_BURST_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_MESSAGE_BURST_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
  ticketUserLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_TICKET_USER_LIMIT',
    DEFAULT_CHAT_REALTIME_TICKET_USER_LIMIT,
    { min: 1 },
  ),
  ticketUserWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_TICKET_USER_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_TICKET_USER_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
  ticketIpLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_TICKET_IP_LIMIT',
    DEFAULT_CHAT_REALTIME_TICKET_IP_LIMIT,
    { min: 1 },
  ),
  ticketIpWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_TICKET_IP_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_TICKET_IP_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
  wsConnectIpLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_WS_CONNECT_IP_LIMIT',
    DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_LIMIT,
    { min: 1 },
  ),
  wsConnectIpWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
  wsConnectUserLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_WS_CONNECT_USER_LIMIT',
    DEFAULT_CHAT_REALTIME_WS_CONNECT_USER_LIMIT,
    { min: 1 },
  ),
  wsConnectUserWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_WS_CONNECT_USER_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_WS_CONNECT_USER_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
  wsConcurrentUserLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_WS_CONCURRENT_USER_LIMIT',
    DEFAULT_CHAT_REALTIME_WS_CONCURRENT_USER_LIMIT,
    { min: 1 },
  ),
  wsSubscribeSocketLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_LIMIT',
    DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_LIMIT,
    { min: 1 },
  ),
  wsSubscribeSocketWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
  wsSubscribeFailureLimit: readNumberEnv(
    process.env,
    'CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_LIMIT',
    DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_LIMIT,
    { min: 1 },
  ),
  wsSubscribeFailureWindowMs:
    readNumberEnv(
      process.env,
      'CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_WINDOW_SECONDS',
      DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_WINDOW_SECONDS,
      { min: 1 },
    ) * 1_000,
}));
