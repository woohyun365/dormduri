import { loginPasswordRequestSchema, loginPasswordResponseSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/login/password',
  access: 'public',
  body: loginPasswordRequestSchema,
  response: loginPasswordResponseSchema,
});
