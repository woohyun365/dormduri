import { accessRequestApproveRequestSchema, accessRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ requestId }) => `/access/requests/${requestId}/approve`,
  params: ['requestId'],
  access: 'session',
  body: accessRequestApproveRequestSchema,
  response: accessRequestSchema,
});
