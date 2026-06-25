import { signupDraftValidationRequestSchema } from '@repo/shared/auth/contract';
import { createStrictForwardPostHandler } from '@/auth/bff';

export const POST = createStrictForwardPostHandler({
  path: '/auth/validate-signup-draft',
  schema: signupDraftValidationRequestSchema,
  invalidCode: 'INVALID_SIGNUP_DRAFT_REQUEST',
});
