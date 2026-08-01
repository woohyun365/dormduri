import { registerAs } from '@nestjs/config';
import { readNumberEnv, readStringEnv } from './env.helpers.js';

export const AUTH_REDIS_DEGRADE_MODE = 'postgres-local-fallback-alert' as const;
export const DEFAULT_AUTH_CLEANUP_BATCH_SIZE = 500;
export const DEFAULT_AUTH_EXPIRED_SESSION_RETENTION_DAYS = 30;
export const DEFAULT_AUTH_VERIFICATION_CODE_RETENTION_DAYS = 7;
export const DEFAULT_AUTH_VERIFICATION_REQUEST_LOG_RETENTION_DAYS = 7;
export const DEFAULT_AUTH_LOGIN_ATTEMPT_RETENTION_DAYS = 30;
export const DEFAULT_AUTH_SECURITY_EVENT_RETENTION_DAYS = 90;
export const DEFAULT_AUTH_REDIS_TRIGGER_AUTH_P95_MS = 250;
export const DEFAULT_AUTH_REDIS_TRIGGER_AUTH_WRITE_IOPS = 100;
export const DEFAULT_AUTH_REDIS_TRIGGER_THROTTLE_BYPASS_PER_HOUR = 1;
export const DEFAULT_AUTH_CLEANUP_LAG_ALERT_SECONDS = 24 * 60 * 60;
export const DEFAULT_AUTH_MAIL_OUTBOX_LAG_ALERT_SECONDS = 60;
export const DEFAULT_AUTH_RDS_POOL_UTILIZATION_ALERT_RATIO = 0.8;

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
  redisTriggerAuthP95Ms: readNumberEnv(
    process.env,
    'AUTH_REDIS_TRIGGER_AUTH_P95_MS',
    DEFAULT_AUTH_REDIS_TRIGGER_AUTH_P95_MS,
    { min: 1 },
  ),
  redisTriggerAuthWriteIops: readNumberEnv(
    process.env,
    'AUTH_REDIS_TRIGGER_AUTH_WRITE_IOPS',
    DEFAULT_AUTH_REDIS_TRIGGER_AUTH_WRITE_IOPS,
    { min: 1 },
  ),
  redisTriggerThrottleBypassPerHour: readNumberEnv(
    process.env,
    'AUTH_REDIS_TRIGGER_THROTTLE_BYPASS_PER_HOUR',
    DEFAULT_AUTH_REDIS_TRIGGER_THROTTLE_BYPASS_PER_HOUR,
    { min: 1 },
  ),
  redisDegradeMode: readStringEnv(process.env, 'AUTH_REDIS_DEGRADE_MODE', AUTH_REDIS_DEGRADE_MODE),
  cleanupLagAlertSeconds: readNumberEnv(
    process.env,
    'AUTH_CLEANUP_LAG_ALERT_SECONDS',
    DEFAULT_AUTH_CLEANUP_LAG_ALERT_SECONDS,
    { min: 1 },
  ),
  mailOutboxLagAlertSeconds: readNumberEnv(
    process.env,
    'AUTH_MAIL_OUTBOX_LAG_ALERT_SECONDS',
    DEFAULT_AUTH_MAIL_OUTBOX_LAG_ALERT_SECONDS,
    { min: 1 },
  ),
  rdsPoolUtilizationAlertRatio: readNumberEnv(
    process.env,
    'AUTH_RDS_POOL_UTILIZATION_ALERT_RATIO',
    DEFAULT_AUTH_RDS_POOL_UTILIZATION_ALERT_RATIO,
    { min: 0 },
  ),
}));
