import type { SignupDraftValidationRequest } from '@repo/shared/auth-contract';
import { createForwardPostHandler } from '../_post-route';

// Deprecated BFF compatibility route for the old signup-profile naming.
// Backend canonical route is /auth/validate-signup-draft; keep this only until React signup UI migrates.
export const POST = createForwardPostHandler<SignupDraftValidationRequest>(
  '/auth/validate-signup-draft',
);
