import type { VerificationCodeRequest } from '@repo/shared/auth-contract';
import { createForwardPostHandler } from '../_post-route';

export const POST = createForwardPostHandler<VerificationCodeRequest>('/auth/verify-reset-code');
