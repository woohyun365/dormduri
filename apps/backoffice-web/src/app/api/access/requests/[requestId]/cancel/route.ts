import { accessRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ requestId }) => `/access/requests/${requestId}/cancel`,
  params: ['requestId'],
  access: 'session',
  body: null,
  response: accessRequestSchema,
});
