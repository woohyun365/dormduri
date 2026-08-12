import { defineEnvKeys } from '../../../config/environment/env-key.definition.js';
import { numberEnv, type EnvSchemaDefinition } from '../../../config/environment/joi-helpers.js';
import {
  DEFAULT_AUTH_CLEANUP_BATCH_SIZE,
  DEFAULT_AUTH_EXPIRED_SESSION_RETENTION_DAYS,
  DEFAULT_AUTH_LOGIN_ATTEMPT_RETENTION_DAYS,
  DEFAULT_AUTH_SECURITY_EVENT_RETENTION_DAYS,
  DEFAULT_AUTH_VERIFICATION_CODE_RETENTION_DAYS,
  DEFAULT_AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS,
} from './auth-operations.config.js';

export const authOperationsEnvSchema = {
  AUTH_CLEANUP_BATCH_SIZE: numberEnv(DEFAULT_AUTH_CLEANUP_BATCH_SIZE, { min: 1 }),
  AUTH_EXPIRED_SESSION_RETENTION_DAYS: numberEnv(DEFAULT_AUTH_EXPIRED_SESSION_RETENTION_DAYS, {
    min: 1,
  }),
  AUTH_VERIFICATION_CODE_RETENTION_DAYS: numberEnv(DEFAULT_AUTH_VERIFICATION_CODE_RETENTION_DAYS, {
    min: 1,
  }),
  AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS: numberEnv(
    DEFAULT_AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS,
    { min: 1 },
  ),
  AUTH_LOGIN_ATTEMPT_RETENTION_DAYS: numberEnv(DEFAULT_AUTH_LOGIN_ATTEMPT_RETENTION_DAYS, {
    min: 1,
  }),
  AUTH_SECURITY_EVENT_RETENTION_DAYS: numberEnv(DEFAULT_AUTH_SECURITY_EVENT_RETENTION_DAYS, {
    min: 1,
  }),
} satisfies EnvSchemaDefinition;

export const authOperationsEnvKeys = defineEnvKeys([
  {
    key: 'AUTH_CLEANUP_BATCH_SIZE',
    owner: 'auth-operations',
    category: 'retention',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Auth cleanup batch size.',
  },
  {
    key: 'AUTH_EXPIRED_SESSION_RETENTION_DAYS',
    owner: 'auth-operations',
    category: 'retention',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Expired session retention days.',
  },
  {
    key: 'AUTH_VERIFICATION_CODE_RETENTION_DAYS',
    owner: 'auth-operations',
    category: 'retention',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Verification code retention days.',
  },
  {
    key: 'AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS',
    owner: 'auth-operations',
    category: 'retention',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Verification request log retention days.',
  },
  {
    key: 'AUTH_LOGIN_ATTEMPT_RETENTION_DAYS',
    owner: 'auth-operations',
    category: 'retention',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Login attempt retention days.',
  },
  {
    key: 'AUTH_SECURITY_EVENT_RETENTION_DAYS',
    owner: 'auth-operations',
    category: 'retention',
    source: 'process-env',
    defaultPolicy: 'safe-local-default',
    description: 'Security event retention days.',
  },
] as const);
