import type { EmailRequest } from '@repo/shared/auth/contract';
import { createForwardPostHandler } from '../_post-route';

export const POST = createForwardPostHandler<EmailRequest>('/auth/send-reset-code');
