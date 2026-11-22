import { recoveryCodesResponseSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/recovery-codes',
  access: 'session',
  body: null,
  response: recoveryCodesResponseSchema,
});
