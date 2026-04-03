import type { SignupProfileValidationRequest } from '@repo/shared/auth-contract';
import { createForwardPostHandler } from '../_post-route';

export const POST = createForwardPostHandler<SignupProfileValidationRequest>(
  '/auth/validate-signup-profile',
);
