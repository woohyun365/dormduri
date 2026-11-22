import {
  issuedSessionResponseSchema,
  loginRecoveryCodeRequestSchema,
} from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/login/recovery-code',
  access: 'public',
  body: loginRecoveryCodeRequestSchema,
  response: issuedSessionResponseSchema,
  onSuccess: ({ session }) => ({ body: { scope: session.scope }, issueSession: session.token }),
});
