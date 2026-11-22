import {
  invitationCreateRequestSchema,
  invitationCreatedResponseSchema,
} from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/accounts/invitations',
  access: 'session',
  body: invitationCreateRequestSchema,
  response: invitationCreatedResponseSchema,
});
