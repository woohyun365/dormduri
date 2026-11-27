import {
  legalDecisionResponseSchema,
  legalRequestRejectRequestSchema,
} from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ requestId }) => `/legal/requests/${requestId}/reject`,
  params: ['requestId'],
  access: 'session',
  body: legalRequestRejectRequestSchema,
  response: legalDecisionResponseSchema,
});
