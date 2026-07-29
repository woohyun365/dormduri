import { registerAs } from '@nestjs/config';
import { readBooleanEnv, readNumberEnv, readStringEnv } from './env.helpers.js';

const nodeEnv = process.env.NODE_ENV?.trim() || 'development';
const isProduction = nodeEnv === 'production';

export const DEFAULT_VERIFICATION_CODE_HMAC_SECRET = 'local-verification-code-hmac-secret';
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
