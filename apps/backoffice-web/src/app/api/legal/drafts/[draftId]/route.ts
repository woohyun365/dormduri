import { legalDraftSchema, legalDraftUpdateRequestSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

// A draft save at the revision the editor read: the browser posts here, the backoffice API takes a PUT.
export const POST = bffMutation({
  upstream: ({ draftId }) => `/legal/drafts/${draftId}`,
  upstreamMethod: 'PUT',
  params: ['draftId'],
  access: 'session',
  body: legalDraftUpdateRequestSchema,
  response: legalDraftSchema,
});
