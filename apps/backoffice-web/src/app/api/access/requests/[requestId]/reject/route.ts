import { accessRequestRejectRequestSchema, accessRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ requestId }) => `/access/requests/${requestId}/reject`,
  params: ['requestId'],
  access: 'session',
  body: accessRequestRejectRequestSchema,
  response: accessRequestSchema,
});
