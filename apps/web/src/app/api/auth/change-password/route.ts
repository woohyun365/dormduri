import type { ChangePasswordRequest } from '@repo/shared/auth-contract';
import { createAuthenticatedForwardPostHandler } from '../_post-route';

export const POST = createAuthenticatedForwardPostHandler<ChangePasswordRequest>(
  '/auth/change-password',
  { setAuthCookieFromAccessToken: true },
);
