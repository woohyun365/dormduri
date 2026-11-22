import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: ({ invitationId }) => `/accounts/invitations/${invitationId}/revoke`,
  params: ['invitationId'],
  access: 'session',
  body: null,
  response: null,
});
