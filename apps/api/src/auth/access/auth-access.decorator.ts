import { SetMetadata, applyDecorators } from '@nestjs/common';
import type { AuthCapability } from './auth-capability.js';

export const AUTH_ACCESS_METADATA_KEY = 'auth:access';
export const AUTH_REQUIRED_CAPABILITIES_METADATA_KEY = 'auth:required-capabilities';

export type AuthAccessMode = 'public' | 'optional' | 'protected';

export function Public() {
  return SetMetadata(AUTH_ACCESS_METADATA_KEY, 'public' satisfies AuthAccessMode);
}

export function OptionalAuth() {
  return SetMetadata(AUTH_ACCESS_METADATA_KEY, 'optional' satisfies AuthAccessMode);
}

export function RequireCapability(...capabilities: readonly AuthCapability[]) {
  return applyDecorators(
    SetMetadata(AUTH_ACCESS_METADATA_KEY, 'protected' satisfies AuthAccessMode),
    SetMetadata(AUTH_REQUIRED_CAPABILITIES_METADATA_KEY, [...capabilities]),
  );
}
