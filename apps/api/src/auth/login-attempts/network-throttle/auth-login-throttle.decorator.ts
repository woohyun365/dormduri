import { SetMetadata } from '@nestjs/common';

export const AUTH_LOGIN_THROTTLE_ENABLED_METADATA = 'auth:login-throttle-enabled';

export const EnableAuthLoginThrottle = () =>
  SetMetadata(AUTH_LOGIN_THROTTLE_ENABLED_METADATA, true);
