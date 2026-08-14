import type { ChangePasswordRequest } from '@repo/shared/auth/contract';
import { changePasswordResponseSchema } from '@repo/shared/auth/response';
import { createAuthenticatedForwardPostHandler } from '@/auth/bff';

export const POST = createAuthenticatedForwardPostHandler<ChangePasswordRequest>(
  '/auth/change-password',
  {
    setAuthCookieFromAccessToken: true,
    responseSchema: changePasswordResponseSchema,
  },
);
