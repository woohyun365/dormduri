import { registrationRequestSchema, registrationResponseSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/registration',
  access: 'public',
  body: registrationRequestSchema,
  response: registrationResponseSchema,
  // TOTP secret and recovery codes go to the page once; the token stays in the cookie.
  onSuccess: ({ session, totp, recoveryCodes }) => ({
    body: { scope: session.scope, totp, recoveryCodes },
    issueSession: session.token,
  }),
});
