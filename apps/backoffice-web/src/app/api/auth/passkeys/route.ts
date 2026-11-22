import {
  passkeyRegisteredResponseSchema,
  passkeyRegistrationRequestSchema,
} from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/auth/passkeys',
  access: 'session',
  body: passkeyRegistrationRequestSchema,
  response: passkeyRegisteredResponseSchema,
});
