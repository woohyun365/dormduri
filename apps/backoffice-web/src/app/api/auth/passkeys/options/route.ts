import { webAuthnChallengeResponseSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/passkeys/options',
  access: 'session',
  body: null,
  response: webAuthnChallengeResponseSchema,
});
