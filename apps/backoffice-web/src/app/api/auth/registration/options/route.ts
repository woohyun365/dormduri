import {
  registrationOptionsRequestSchema,
  registrationOptionsResponseSchema,
} from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/registration/options',
  access: 'public',
  body: registrationOptionsRequestSchema,
  response: registrationOptionsResponseSchema,
});
