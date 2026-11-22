import { issuedTotpSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/totp',
  access: 'session',
  body: null,
  response: issuedTotpSchema,
});
