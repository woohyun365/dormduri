import {
  reauthenticationRequestSchema,
  reauthenticationResponseSchema,
} from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/reauthentication',
  access: 'session',
  body: reauthenticationRequestSchema,
  response: reauthenticationResponseSchema,
});
