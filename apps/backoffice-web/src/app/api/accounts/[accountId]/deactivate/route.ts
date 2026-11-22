import { accountDeactivateRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ accountId }) => `/accounts/${accountId}/deactivate`,
  params: ['accountId'],
  access: 'session',
  body: accountDeactivateRequestSchema,
  response: null,
});
