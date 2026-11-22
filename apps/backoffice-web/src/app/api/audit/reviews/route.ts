import {
  auditReviewRecordedResponseSchema,
  auditReviewRequestSchema,
} from '@repo/shared/backoffice';
import { bffMutation } from '@/bff/mutation-route';

export const POST = bffMutation({
  upstream: '/audit/reviews',
  access: 'session',
  body: auditReviewRequestSchema,
  response: auditReviewRecordedResponseSchema,
});
