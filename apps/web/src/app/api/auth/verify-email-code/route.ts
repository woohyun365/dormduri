import { verificationCodeRequestSchema } from '@repo/shared/auth/contract';
import { createStrictForwardPostHandler } from '@/auth/bff';

export const POST = createStrictForwardPostHandler({
  path: '/auth/verify-email-code',
  schema: verificationCodeRequestSchema,
  invalidCode: 'INVALID_VERIFY_EMAIL_CODE_REQUEST',
});
