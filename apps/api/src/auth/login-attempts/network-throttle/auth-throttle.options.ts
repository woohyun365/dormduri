import type { ConfigType } from '@nestjs/config';
import type { ThrottlerOptions } from '@nestjs/throttler';
import authConfig from '../../../config/auth.config.js';
import {
  AUTH_LOGIN_BURST_THROTTLER,
  AUTH_LOGIN_SUSTAINED_THROTTLER,
} from './login-throttle.policy.js';

type AuthThrottleSettings = Pick<
  ConfigType<typeof authConfig>,
  | 'authLoginBurstLimit'
  | 'authLoginBurstWindowSeconds'
  | 'authLoginSustainedLimit'
  | 'authLoginSustainedWindowSeconds'
  | 'authThrottleLimit'
>;

export function buildAuthThrottlerOptions(config: AuthThrottleSettings): ThrottlerOptions[] {
  return [
    {
      ttl: 60_000,
      limit: config.authThrottleLimit,
    },
    {
      name: AUTH_LOGIN_BURST_THROTTLER,
      ttl: config.authLoginBurstWindowSeconds * 1_000,
      limit: config.authLoginBurstLimit,
    },
    {
      name: AUTH_LOGIN_SUSTAINED_THROTTLER,
      ttl: config.authLoginSustainedWindowSeconds * 1_000,
      limit: config.authLoginSustainedLimit,
    },
  ];
}
