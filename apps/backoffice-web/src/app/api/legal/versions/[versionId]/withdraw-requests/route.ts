import { legalRequestSchema, legalWithdrawRequestCreateSchema } from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

// Only approved general and significant versions can be withdrawn, and those always have UUID ids; a development seed
// version's slug id is a historical record or a first publication, which the API never withdraws.
export const POST = bffMutation({
  upstream: ({ versionId }) => `/legal/versions/${versionId}/withdraw-requests`,
  params: ['versionId'],
  access: 'session',
  body: legalWithdrawRequestCreateSchema,
  response: legalRequestSchema,
});
