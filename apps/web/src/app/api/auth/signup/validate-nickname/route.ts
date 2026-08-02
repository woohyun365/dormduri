import { AUTH_VERIFICATION_GRANT_HEADER } from '@repo/shared/auth/contract';
import { signupNicknameValidationRequestSchema } from '@repo/shared/auth/contract';
import {
  clearVerificationGrantCookie,
  createStrictForwardPostHandler,
  getVerificationGrantCookie,
} from '@/auth/bff';

export const POST = createStrictForwardPostHandler({
  path: '/auth/signup/validate-nickname',
  schema: signupNicknameValidationRequestSchema,
  invalidCode: 'INVALID_SIGNUP_NICKNAME_REQUEST',
  allowedResponseFields: ['nickname'],
  getAdditionalHeaders: (request) => ({
    [AUTH_VERIFICATION_GRANT_HEADER]: getVerificationGrantCookie(request, 'signup') ?? undefined,
  }),
  onResponse: (response, upstreamBody) => {
    if (upstreamBody.code === 'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED') {
      clearVerificationGrantCookie(response, 'signup');
    }
  },
});
