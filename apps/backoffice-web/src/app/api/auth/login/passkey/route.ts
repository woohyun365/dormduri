import { issuedSessionResponseSchema, loginPasskeyRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/login/passkey',
  access: 'public',
  body: loginPasskeyRequestSchema,
  response: issuedSessionResponseSchema,
  onSuccess: ({ session }) => ({ body: { scope: session.scope }, issueSession: session.token }),
});
