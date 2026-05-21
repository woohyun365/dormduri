import Joi from 'joi';
import { DEFAULT_NODE_ENV, DEFAULT_PORT } from './app.config.js';
import {
  DEFAULT_AUTH_THROTTLE_LIMIT,
  DEFAULT_CODE_REQUEST_BACKSTOP_LIMIT,
  DEFAULT_CODE_REQUEST_BACKSTOP_WINDOW_SECONDS,
  DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS,
  DEFAULT_JWT_SECRET,
  DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
} from './auth.config.js';
import {
  DEFAULT_DATABASE_ADAPTER_CONNECT_TIMEOUT_MS,
  DEFAULT_DATABASE_ADAPTER_IDLE_TIMEOUT_MS,
  DEFAULT_DATABASE_APPLICATION_NAME,
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
  JWT_SECRET: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().trim().default(DEFAULT_JWT_SECRET),
    }),
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
  RETENTION_IDENTITY_ENCRYPTION_KEY_BASE64: Joi.string().base64().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().base64().optional(),
  }),
  RETENTION_IDENTITY_KEY_VERSION: Joi.string().trim().default('local-v1'),
  RETENTION_CHAT_BODY_ENCRYPTION_KEY_BASE64: Joi.string().base64().when('NODE_ENV', {
    is: 'production',
    then: Joi.required(),
    otherwise: Joi.string().base64().optional(),
  }),
  RETENTION_CHAT_BODY_KEY_VERSION: Joi.string().trim().default('local-v1'),
}).unknown(true);
