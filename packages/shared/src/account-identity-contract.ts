import { z } from 'zod';
import { userAcademicIdentitySchema } from './academic-identity-contract.js';
import { userDisplayIdentitySchema } from './display-identity-contract.js';

export const accountIdentityInvariantSchema = z.enum([
  'USER_DISPLAY_IDENTITY_REQUIRED',
  'USER_ACADEMIC_IDENTITY_REQUIRED',
]);

export const accountIdentityIncompleteErrorSchema = z.strictObject({
  success: z.literal(false).optional(),
  code: z.literal('ACCOUNT_IDENTITY_INCOMPLETE'),
  error: z.string(),
  invariant: accountIdentityInvariantSchema,
  context: z.string().optional(),
});

export const accountIdentitySchema = z.strictObject({
  displayIdentity: userDisplayIdentitySchema,
  academicIdentity: userAcademicIdentitySchema,
});

export type AccountIdentityInvariant = z.infer<typeof accountIdentityInvariantSchema>;
export type AccountIdentityIncompleteError = z.infer<typeof accountIdentityIncompleteErrorSchema>;
export type AccountIdentity = z.infer<typeof accountIdentitySchema>;
