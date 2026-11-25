import { legalPublishRequestCreateSchema, legalRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ draftId }) => `/legal/drafts/${draftId}/publish-requests`,
  params: ['draftId'],
  access: 'session',
  body: legalPublishRequestCreateSchema,
  response: legalRequestSchema,
});
