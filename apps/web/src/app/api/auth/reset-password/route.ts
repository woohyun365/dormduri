import type { ResetPasswordRequest } from '@repo/shared/auth-contract';
import { createForwardPostHandler } from '../_post-route';

export const POST = createForwardPostHandler<ResetPasswordRequest>('/auth/reset-password');
