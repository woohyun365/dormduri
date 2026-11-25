import {
  legalDecisionResponseSchema,
  legalRequestApproveRequestSchema,
} from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ requestId }) => `/legal/requests/${requestId}/approve`,
  params: ['requestId'],
  access: 'session',
  body: legalRequestApproveRequestSchema,
  response: legalDecisionResponseSchema,
});
