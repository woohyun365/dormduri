import { webAuthnChallengeResponseSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/reauthentication/options',
  access: 'session',
  body: null,
  response: webAuthnChallengeResponseSchema,
});
