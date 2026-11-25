import { legalDraftDiscardRequestSchema, legalDraftSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ draftId }) => `/legal/drafts/${draftId}/discard`,
  params: ['draftId'],
  access: 'session',
  body: legalDraftDiscardRequestSchema,
  response: legalDraftSchema,
});
