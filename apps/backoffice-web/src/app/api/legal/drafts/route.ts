import { legalDraftCreateRequestSchema, legalDraftSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

// A new legal draft from the editor or a JSON file (backoffice-api README §8).
export const POST = bffMutation({
  upstream: '/legal/drafts',
  access: 'session',
  body: legalDraftCreateRequestSchema,
  response: legalDraftSchema,
});
