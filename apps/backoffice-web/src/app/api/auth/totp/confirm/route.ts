import { totpConfirmRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/totp/confirm',
  access: 'session',
  body: totpConfirmRequestSchema,
  response: null,
});
