import { registerAs } from '@nestjs/config';
import { readBooleanEnv, readNumberEnv, readStringEnv } from './env.helpers.js';

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
const isProduction = nodeEnv === 'production';

export const DEFAULT_VERIFICATION_CODE_HMAC_SECRET = 'local-verification-code-hmac-secret';
export const DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET = 'local-auth-persistence-hmac-secret';
export const DEFAULT_AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64 =
  'bG9jYWwtYXV0aC1tYWlsLWVudmVsb3BlLWtleS0zMmI=';
export const DEFAULT_AUTH_MAIL_ENVELOPE_KEY_VERSION = 'local-v1';
export const DEFAULT_AUTH_MAIL_DISPATCHER_ENABLED = true;
export const DEFAULT_AUTH_MAIL_DISPATCHER_INTERVAL_MS = 1_000;
export const DEFAULT_AUTH_MAIL_DISPATCHER_BATCH_SIZE = 20;
export const DEFAULT_AUTH_MAIL_DISPATCHER_CLAIM_LEASE_MS = 30_000;
export const DEFAULT_AUTH_MAIL_SEND_TIMEOUT_MS = 5_000;
export const DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS = isProduction ? 30 : 5;
export const DEFAULT_CODE_REQUEST_BACKSTOP_WINDOW_SECONDS = 60 * 10;
export const DEFAULT_CODE_REQUEST_BACKSTOP_LIMIT = isProduction ? 5 : 20;
export const DEFAULT_AUTH_THROTTLE_LIMIT = isProduction ? 60 : 300;
export const DEFAULT_AUTH_LOGIN_BURST_LIMIT = 30;
export const DEFAULT_AUTH_LOGIN_BURST_WINDOW_SECONDS = 60;
export const DEFAULT_AUTH_LOGIN_SUSTAINED_LIMIT = 120;
export const DEFAULT_AUTH_LOGIN_SUSTAINED_WINDOW_SECONDS = 10 * 60;
export const DEFAULT_AUTH_RENEWAL_PREVIOUS_TOKEN_GRACE_ENABLED = true;

export default registerAs('auth', () => ({
  verificationCodeHmacSecret: readStringEnv(
    process.env,
    'VERIFICATION_CODE_HMAC_SECRET',
    DEFAULT_VERIFICATION_CODE_HMAC_SECRET,
  ),
  persistenceHmacSecret: readStringEnv(
    process.env,
    'AUTH_PERSISTENCE_HMAC_SECRET',
    DEFAULT_AUTH_PERSISTENCE_HMAC_SECRET,
  ),
  mailEnvelopeEncryptionKeyBase64: readStringEnv(
    process.env,
    'AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64',
    DEFAULT_AUTH_MAIL_ENVELOPE_ENCRYPTION_KEY_BASE64,
  ),
  mailEnvelopeKeyVersion: readStringEnv(
    process.env,
    'AUTH_MAIL_ENVELOPE_KEY_VERSION',
    DEFAULT_AUTH_MAIL_ENVELOPE_KEY_VERSION,
  ),
  mailDispatcherEnabled: readBooleanEnv(
    process.env,
    'AUTH_MAIL_DISPATCHER_ENABLED',
    DEFAULT_AUTH_MAIL_DISPATCHER_ENABLED,
  ),
  mailDispatcherIntervalMs: readNumberEnv(
    process.env,
    'AUTH_MAIL_DISPATCHER_INTERVAL_MS',
    DEFAULT_AUTH_MAIL_DISPATCHER_INTERVAL_MS,
    { min: 100 },
  ),
  mailDispatcherBatchSize: readNumberEnv(
    process.env,
    'AUTH_MAIL_DISPATCHER_BATCH_SIZE',
    DEFAULT_AUTH_MAIL_DISPATCHER_BATCH_SIZE,
    { min: 1 },
  ),
  mailDispatcherClaimLeaseMs: readNumberEnv(
    process.env,
    'AUTH_MAIL_DISPATCHER_CLAIM_LEASE_MS',
    DEFAULT_AUTH_MAIL_DISPATCHER_CLAIM_LEASE_MS,
    { min: 1_000 },
  ),
  mailSendTimeoutMs: readNumberEnv(
    process.env,
    'AUTH_MAIL_SEND_TIMEOUT_MS',
    DEFAULT_AUTH_MAIL_SEND_TIMEOUT_MS,
    { min: 100 },
  ),
  codeRequestCooldownSeconds: readNumberEnv(
    process.env,
    'CODE_REQUEST_COOLDOWN_SECONDS',
    DEFAULT_CODE_REQUEST_COOLDOWN_SECONDS,
    { min: 1 },
  ),
  codeRequestBackstopWindowSeconds: readNumberEnv(
    process.env,
    'CODE_REQUEST_BACKSTOP_WINDOW_SECONDS',
    DEFAULT_CODE_REQUEST_BACKSTOP_WINDOW_SECONDS,
    { min: 1 },
  ),
  codeRequestBackstopLimit: readNumberEnv(
    process.env,
    'CODE_REQUEST_BACKSTOP_LIMIT',
    DEFAULT_CODE_REQUEST_BACKSTOP_LIMIT,
    { min: 1 },
  ),
  authThrottleLimit: readNumberEnv(
    process.env,
    'AUTH_THROTTLE_LIMIT',
    DEFAULT_AUTH_THROTTLE_LIMIT,
    { min: 1 },
  ),
  authLoginBurstLimit: readNumberEnv(
    process.env,
    'AUTH_LOGIN_BURST_LIMIT',
    DEFAULT_AUTH_LOGIN_BURST_LIMIT,
    { min: 1 },
  ),
  authLoginBurstWindowSeconds: readNumberEnv(
    process.env,
    'AUTH_LOGIN_BURST_WINDOW_SECONDS',
    DEFAULT_AUTH_LOGIN_BURST_WINDOW_SECONDS,
    { min: 1 },
  ),
  authLoginSustainedLimit: readNumberEnv(
    process.env,
    'AUTH_LOGIN_SUSTAINED_LIMIT',
    DEFAULT_AUTH_LOGIN_SUSTAINED_LIMIT,
    { min: 1 },
  ),
  authLoginSustainedWindowSeconds: readNumberEnv(
    process.env,
    'AUTH_LOGIN_SUSTAINED_WINDOW_SECONDS',
    DEFAULT_AUTH_LOGIN_SUSTAINED_WINDOW_SECONDS,
    { min: 1 },
  ),
  renewalPreviousTokenGraceEnabled: readBooleanEnv(
    process.env,
    'AUTH_RENEWAL_PREVIOUS_TOKEN_GRACE_ENABLED',
    DEFAULT_AUTH_RENEWAL_PREVIOUS_TOKEN_GRACE_ENABLED,
  ),
}));
