import { accessRequestCreateRequestSchema, accessRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/access/requests',
  access: 'session',
  body: accessRequestCreateRequestSchema,
  response: accessRequestSchema,
});
