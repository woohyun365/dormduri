import type { SignupDraftValidationRequest } from '@repo/shared/auth-contract';
import { createForwardPostHandler } from '../_post-route';

export const POST = createForwardPostHandler<SignupDraftValidationRequest>(
  '/auth/validate-signup-draft',
);
