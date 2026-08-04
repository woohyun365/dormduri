import { registerAs } from '@nestjs/config';
import { readNumberEnv } from './env.helpers.js';

export const DEFAULT_AUTH_CLEANUP_BATCH_SIZE = 500;
export const DEFAULT_AUTH_EXPIRED_SESSION_RETENTION_DAYS = 30;
export const DEFAULT_AUTH_VERIFICATION_CODE_RETENTION_DAYS = 7;
export const DEFAULT_AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS = 7;
export const DEFAULT_AUTH_LOGIN_ATTEMPT_RETENTION_DAYS = 30;
export const DEFAULT_AUTH_SECURITY_EVENT_RETENTION_DAYS = 90;

export default registerAs('authOperations', () => ({
  cleanupBatchSize: readNumberEnv(
    process.env,
    'AUTH_CLEANUP_BATCH_SIZE',
    DEFAULT_AUTH_CLEANUP_BATCH_SIZE,
    { min: 1 },
  ),
  expiredSessionRetentionDays: readNumberEnv(
    process.env,
    'AUTH_EXPIRED_SESSION_RETENTION_DAYS',
    DEFAULT_AUTH_EXPIRED_SESSION_RETENTION_DAYS,
    { min: 1 },
  ),
  verificationCodeRetentionDays: readNumberEnv(
    process.env,
    'AUTH_VERIFICATION_CODE_RETENTION_DAYS',
    DEFAULT_AUTH_VERIFICATION_CODE_RETENTION_DAYS,
    { min: 1 },
  ),
  verificationRequestLogRetentionDays: readNumberEnv(
    process.env,
    'AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS',
    DEFAULT_AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS,
    { min: 1 },
  ),
  loginAttemptRetentionDays: readNumberEnv(
    process.env,
    'AUTH_LOGIN_ATTEMPT_RETENTION_DAYS',
    DEFAULT_AUTH_LOGIN_ATTEMPT_RETENTION_DAYS,
    { min: 1 },
  ),
  securityEventRetentionDays: readNumberEnv(
    process.env,
    'AUTH_SECURITY_EVENT_RETENTION_DAYS',
    DEFAULT_AUTH_SECURITY_EVENT_RETENTION_DAYS,
    { min: 1 },
  ),
}));
