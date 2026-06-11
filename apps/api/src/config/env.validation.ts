import Joi from 'joi';
import { DEFAULT_NODE_ENV, DEFAULT_PORT } from './app.config.js';
import {
  DEFAULT_AUTH_THROTTLE_LIMIT,
  DEFAULT_CODE_REQUEST_BACKSTOP_LIMIT,
  DEFAULT_CODE_REQUEST_BACKSTOP_WINDOW_SECONDS,
  DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS,
  DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
} from './auth.config.js';
import {
  AUTH_REDIS_DEGRADE_MODE,
  DEFAULT_AUTH_CLEANUP_BATCH_SIZE,
  DEFAULT_AUTH_CLEANUP_LAG_ALERT_SECONDS,
  DEFAULT_AUTH_EXPIRED_SESSION_RETENTION_DAYS,
  DEFAULT_AUTH_LOGIN_ATTEMPT_RETENTION_DAYS,
  DEFAULT_AUTH_RDS_POOL_UTILIZATION_ALERT_RATIO,
  DEFAULT_AUTH_REDIS_TRIGGER_AUTH_P95_MS,
  DEFAULT_AUTH_REDIS_TRIGGER_AUTH_WRITE_IOPS,
  DEFAULT_AUTH_REDIS_TRIGGER_THROTTLE_BYPASS_PER_HOUR,
  DEFAULT_AUTH_SECURITY_EVENT_RETENTION_DAYS,
  DEFAULT_AUTH_VERIFICATION_CODE_RETENTION_DAYS,
  DEFAULT_AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS,
} from './auth-operations.config.js';
import {
  DEFAULT_DATABASE_ADAPTER_CONNECT_TIMEOUT_MS,
  DEFAULT_DATABASE_ADAPTER_IDLE_TIMEOUT_MS,
  DEFAULT_DATABASE_APPLICATION_NAME,
  DEFAULT_RETENTION_DISCLOSURE_DATABASE_APPLICATION_NAME,
  DEFAULT_RETENTION_WORKER_DATABASE_APPLICATION_NAME,
  DEFAULT_DATABASE_POOL_MAX,
  DEFAULT_DATABASE_POOL_MIN,
  DEFAULT_DATABASE_QUERY_TIMEOUT_MS,
  DEFAULT_DATABASE_STATEMENT_TIMEOUT_MS,
  DEFAULT_DATABASE_URL,
  DEFAULT_PRISMA_QUERY_LOG_EVENTS,
} from './database.config.js';
import {
  DEFAULT_LIFECYCLE_SWEEP_ENABLED,
  DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS,
} from './lifecycle.config.js';
import {
  CHAT_REALTIME_ALLOWED_ORIGINS_ENV,
  CHAT_REALTIME_TRUST_PROXY_ENV,
  DEFAULT_CHAT_REALTIME_DISPATCHER_BATCH_SIZE,
  DEFAULT_CHAT_REALTIME_DISPATCHER_CLAIM_LEASE_MS,
  DEFAULT_CHAT_REALTIME_DISPATCHER_ENABLED,
  DEFAULT_CHAT_REALTIME_DISPATCHER_INTERVAL_MS,
  DEFAULT_CHAT_REALTIME_DISPATCHER_RETRY_BASE_MS,
  DEFAULT_CHAT_REALTIME_DISPATCHER_RETRY_MAX_MS,
  DEFAULT_CHAT_REALTIME_MESSAGE_BURST_LIMIT,
  DEFAULT_CHAT_REALTIME_MESSAGE_BURST_WINDOW_SECONDS,
  DEFAULT_CHAT_REALTIME_MESSAGE_PAIR_LIMIT,
  DEFAULT_CHAT_REALTIME_MESSAGE_PAIR_WINDOW_SECONDS,
  DEFAULT_CHAT_REALTIME_MESSAGE_USER_LIMIT,
  DEFAULT_CHAT_REALTIME_MESSAGE_USER_WINDOW_SECONDS,
  DEFAULT_CHAT_REALTIME_TICKET_IP_LIMIT,
  DEFAULT_CHAT_REALTIME_TICKET_IP_WINDOW_SECONDS,
  DEFAULT_CHAT_REALTIME_TICKET_USER_LIMIT,
  DEFAULT_CHAT_REALTIME_TICKET_USER_WINDOW_SECONDS,
  DEFAULT_CHAT_REALTIME_WS_CONCURRENT_USER_LIMIT,
  DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_LIMIT,
  DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS,
  DEFAULT_CHAT_REALTIME_WS_CONNECT_USER_LIMIT,
  DEFAULT_CHAT_REALTIME_WS_CONNECT_USER_WINDOW_SECONDS,
  DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_LIMIT,
  DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_WINDOW_SECONDS,
  DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_LIMIT,
  DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_WINDOW_SECONDS,
} from './chat-realtime.config.js';
import {
  CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV,
  DEFAULT_CHAT_THREAD_LIST_CURSOR_HMAC_SECRET,
} from '../chat/queries/chat-thread-list-cursor.js';
import {
  DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET,
  DEFAULT_ROOMMATE_SEARCH_CURSOR_HMAC_SECRET,
  PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV,
  ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV,
} from '../roommate-search/pagination/roommate-search-token.codec.js';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default(DEFAULT_NODE_ENV),
  DATABASE_URL: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().trim().default(DEFAULT_DATABASE_URL),
    }),
  DIRECT_URL: Joi.string().trim().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().trim().optional(),
  }),
  RETENTION_WORKER_DATABASE_URL: Joi.string().trim().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().trim().optional(),
  }),
  RETENTION_DISCLOSURE_DATABASE_URL: Joi.string().trim().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().trim().optional(),
  }),
  MIGRATION_DATABASE_URL: Joi.string().trim().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().trim().optional(),
  }),
  DATABASE_ADAPTER_CONNECT_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_DATABASE_ADAPTER_CONNECT_TIMEOUT_MS),
  DATABASE_ADAPTER_IDLE_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_DATABASE_ADAPTER_IDLE_TIMEOUT_MS),
  DATABASE_POOL_MAX: Joi.number().integer().min(1).default(DEFAULT_DATABASE_POOL_MAX),
  DATABASE_POOL_MIN: Joi.number().integer().min(0).default(DEFAULT_DATABASE_POOL_MIN),
  DATABASE_QUERY_TIMEOUT_MS: Joi.number()
    .integer()
    .min(0)
    .default(DEFAULT_DATABASE_QUERY_TIMEOUT_MS),
  DATABASE_STATEMENT_TIMEOUT_MS: Joi.number()
    .integer()
    .min(0)
    .default(DEFAULT_DATABASE_STATEMENT_TIMEOUT_MS),
  DATABASE_APPLICATION_NAME: Joi.string().trim().default(DEFAULT_DATABASE_APPLICATION_NAME),
  RETENTION_WORKER_DATABASE_APPLICATION_NAME: Joi.string()
    .trim()
    .default(DEFAULT_RETENTION_WORKER_DATABASE_APPLICATION_NAME),
  RETENTION_DISCLOSURE_DATABASE_APPLICATION_NAME: Joi.string()
    .trim()
    .default(DEFAULT_RETENTION_DISCLOSURE_DATABASE_APPLICATION_NAME),
  PRISMA_QUERY_LOG_EVENTS: Joi.boolean()
    .truthy('1')
    .truthy('true')
    .truthy('yes')
    .truthy('on')
    .falsy('0')
    .falsy('false')
    .falsy('no')
    .falsy('off')
    .default(DEFAULT_PRISMA_QUERY_LOG_EVENTS),
  PORT: Joi.number().integer().min(1).default(DEFAULT_PORT),
  VERIFICATION_CODE_HMAC_SECRET: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().trim().default(DEFAULT_VERIFICATION_CODE_HMAC_SECRET),
    }),
  CODE_REQUEST_COOLDOWN_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS),
  CODE_REQUEST_BACKSTOP_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CODE_REQUEST_BACKSTOP_WINDOW_SECONDS),
  CODE_REQUEST_BACKSTOP_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CODE_REQUEST_BACKSTOP_LIMIT),
  AUTH_THROTTLE_LIMIT: Joi.number().integer().min(1).default(DEFAULT_AUTH_THROTTLE_LIMIT),
  AUTH_CLEANUP_BATCH_SIZE: Joi.number().integer().min(1).default(DEFAULT_AUTH_CLEANUP_BATCH_SIZE),
  AUTH_EXPIRED_SESSION_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_EXPIRED_SESSION_RETENTION_DAYS),
  AUTH_VERIFICATION_CODE_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_VERIFICATION_CODE_RETENTION_DAYS),
  AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS),
  AUTH_LOGIN_ATTEMPT_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_LOGIN_ATTEMPT_RETENTION_DAYS),
  AUTH_SECURITY_EVENT_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_SECURITY_EVENT_RETENTION_DAYS),
  AUTH_REDIS_TRIGGER_AUTH_P95_MS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_REDIS_TRIGGER_AUTH_P95_MS),
  AUTH_REDIS_TRIGGER_AUTH_WRITE_IOPS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_REDIS_TRIGGER_AUTH_WRITE_IOPS),
  AUTH_REDIS_TRIGGER_THROTTLE_BYPASS_PER_HOUR: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_REDIS_TRIGGER_THROTTLE_BYPASS_PER_HOUR),
  AUTH_REDIS_DEGRADE_MODE: Joi.string().trim().default(AUTH_REDIS_DEGRADE_MODE),
  AUTH_CLEANUP_LAG_ALERT_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_AUTH_CLEANUP_LAG_ALERT_SECONDS),
  AUTH_RDS_POOL_UTILIZATION_ALERT_RATIO: Joi.number()
    .min(0)
    .default(DEFAULT_AUTH_RDS_POOL_UTILIZATION_ALERT_RATIO),
  LIFECYCLE_SWEEP_ENABLED: Joi.boolean()
    .truthy('1')
    .truthy('true')
    .truthy('yes')
    .truthy('on')
    .falsy('0')
    .falsy('false')
    .falsy('no')
    .falsy('off')
    .default(DEFAULT_LIFECYCLE_SWEEP_ENABLED),
  LIFECYCLE_SWEEP_INTERVAL_MS: Joi.number()
    .integer()
    .min(1_000)
    .default(DEFAULT_LIFECYCLE_SWEEP_INTERVAL_MS),
  [CHAT_REALTIME_ALLOWED_ORIGINS_ENV]: Joi.string().trim().optional(),
  [CHAT_REALTIME_TRUST_PROXY_ENV]: Joi.boolean()
    .truthy('1')
    .truthy('true')
    .truthy('yes')
    .truthy('on')
    .falsy('0')
    .falsy('false')
    .falsy('no')
    .falsy('off')
    .default(false),
  CHAT_REALTIME_DISPATCHER_ENABLED: Joi.boolean()
    .truthy('1')
    .truthy('true')
    .truthy('yes')
    .truthy('on')
    .falsy('0')
    .falsy('false')
    .falsy('no')
    .falsy('off')
    .default(DEFAULT_CHAT_REALTIME_DISPATCHER_ENABLED),
  CHAT_REALTIME_DISPATCHER_INTERVAL_MS: Joi.number()
    .integer()
    .min(100)
    .default(DEFAULT_CHAT_REALTIME_DISPATCHER_INTERVAL_MS),
  CHAT_REALTIME_DISPATCHER_BATCH_SIZE: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_DISPATCHER_BATCH_SIZE),
  CHAT_REALTIME_DISPATCHER_CLAIM_LEASE_MS: Joi.number()
    .integer()
    .min(1_000)
    .default(DEFAULT_CHAT_REALTIME_DISPATCHER_CLAIM_LEASE_MS),
  CHAT_REALTIME_DISPATCHER_RETRY_BASE_MS: Joi.number()
    .integer()
    .min(100)
    .default(DEFAULT_CHAT_REALTIME_DISPATCHER_RETRY_BASE_MS),
  CHAT_REALTIME_DISPATCHER_RETRY_MAX_MS: Joi.number()
    .integer()
    .min(1_000)
    .default(DEFAULT_CHAT_REALTIME_DISPATCHER_RETRY_MAX_MS),

  CHAT_REALTIME_MESSAGE_USER_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_MESSAGE_USER_LIMIT),
  CHAT_REALTIME_MESSAGE_USER_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_MESSAGE_USER_WINDOW_SECONDS),
  CHAT_REALTIME_MESSAGE_PAIR_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_MESSAGE_PAIR_LIMIT),
  CHAT_REALTIME_MESSAGE_PAIR_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_MESSAGE_PAIR_WINDOW_SECONDS),
  CHAT_REALTIME_MESSAGE_BURST_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_MESSAGE_BURST_LIMIT),
  CHAT_REALTIME_MESSAGE_BURST_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_MESSAGE_BURST_WINDOW_SECONDS),
  CHAT_REALTIME_TICKET_USER_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_TICKET_USER_LIMIT),
  CHAT_REALTIME_TICKET_USER_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_TICKET_USER_WINDOW_SECONDS),
  CHAT_REALTIME_TICKET_IP_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_TICKET_IP_LIMIT),
  CHAT_REALTIME_TICKET_IP_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_TICKET_IP_WINDOW_SECONDS),
  CHAT_REALTIME_WS_CONNECT_IP_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_LIMIT),
  CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_CONNECT_IP_WINDOW_SECONDS),
  CHAT_REALTIME_WS_CONNECT_USER_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_CONNECT_USER_LIMIT),
  CHAT_REALTIME_WS_CONNECT_USER_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_CONNECT_USER_WINDOW_SECONDS),
  CHAT_REALTIME_WS_CONCURRENT_USER_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_CONCURRENT_USER_LIMIT),
  CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_LIMIT),
  CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_SOCKET_WINDOW_SECONDS),
  CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_LIMIT),
  CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(DEFAULT_CHAT_REALTIME_WS_SUBSCRIBE_FAILURE_WINDOW_SECONDS),
  RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64: Joi.string().base64().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().base64().optional(),
  }),
  RETENTION_IDENTITY_KEY_VERSION: Joi.string().trim().default('local-v1'),
  RETENTION_VAULT_CHAT_BODY_ENCRYPTION_KEY_BASE64: Joi.string().base64().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().base64().optional(),
  }),
  RETENTION_VAULT_CHAT_BODY_KEY_VERSION: Joi.string().trim().default('local-v1'),
  [ROOMMATE_SEARCH_CURSOR_HMAC_SECRET_ENV]: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().trim().default(DEFAULT_ROOMMATE_SEARCH_CURSOR_HMAC_SECRET),
    }),
  [PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET_ENV]: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().trim().default(DEFAULT_PROFILE_DETAIL_ENTRY_TOKEN_HMAC_SECRET),
    }),
  [CHAT_THREAD_LIST_CURSOR_HMAC_SECRET_ENV]: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().trim().default(DEFAULT_CHAT_THREAD_LIST_CURSOR_HMAC_SECRET),
    }),
}).unknown(true);
