import { emailRequestSchema } from '@repo/shared/auth/contract';
import { createStrictForwardPostHandler } from '@/auth/bff';

export const POST = createStrictForwardPostHandler({
  path: '/auth/send-signup-code',
  schema: emailRequestSchema,
  invalidCode: 'INVALID_SIGNUP_CODE_REQUEST',
});
