import { z } from 'zod';
import { authenticatedSessionUserSchema } from '../../user/primitives.js';

export const apiSessionRejectionReasonSchema = z.enum([
  'MISSING_TOKEN',
  'MALFORMED_TOKEN',
  'SESSION_NOT_FOUND',
  'SESSION_REVOKED',
  'ACCESS_EXPIRED',
  'SESSION_EXPIRED',
  'ACCOUNT_DELETED',
  'ACCOUNT_IDENTITY_INCOMPLETE',
]);

export const apiSessionResponseSchema = z.discriminatedUnion('authenticated', [
  z.strictObject({
    authenticated: z.literal(true),
    user: authenticatedSessionUserSchema,
  }),
  z.strictObject({
    authenticated: z.literal(false),
    reason: apiSessionRejectionReasonSchema,
  }),
]);

export const browserSessionResolutionSchema = z.discriminatedUnion('status', [
  z.strictObject({
    status: z.literal('authenticated'),
    user: authenticatedSessionUserSchema,
  }),
  z.strictObject({
    status: z.literal('unauthenticated'),
  }),
  z.strictObject({
    status: z.literal('unavailable'),
    code: z.literal('AUTH_SESSION_UNAVAILABLE'),
  }),
]);

export type ApiSessionRejectionReason = z.infer<typeof apiSessionRejectionReasonSchema>;
export type ApiSessionResponse = z.infer<typeof apiSessionResponseSchema>;
export type BrowserSessionResolution = z.infer<typeof browserSessionResolutionSchema>;
