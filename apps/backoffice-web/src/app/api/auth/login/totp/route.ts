import { issuedSessionResponseSchema, loginTotpRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/login/totp',
  access: 'public',
  body: loginTotpRequestSchema,
  response: issuedSessionResponseSchema,
  onSuccess: ({ session }) => ({ body: { scope: session.scope }, issueSession: session.token }),
});
