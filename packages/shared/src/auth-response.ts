import { z } from 'zod';
import { authenticatedSessionUserSchema, type AuthenticatedSessionUser } from './user-contract.js';
export { sessionResponseSchema, type SessionResponse } from './session-contract.js';

export const genericErrorResponseSchema = z.strictObject({
  success: z.boolean(),
  error: z.string().optional(),
  code: z.string().optional(),
  userActionable: z.boolean().optional(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
  retryAfterSeconds: z.number().int().positive().optional(),
});

export const loginResponseSchema = genericErrorResponseSchema.extend({
  accessToken: z.string().optional(),
  user: authenticatedSessionUserSchema.optional(),
  locked: z.boolean().optional(),
  remainingSeconds: z.number().int().nonnegative().optional(),
});

export const verifyCodeResponseSchema = genericErrorResponseSchema;
export const signupResponseSchema = genericErrorResponseSchema.extend({
  user: authenticatedSessionUserSchema.optional(),
});
export const resetPasswordResponseSchema = genericErrorResponseSchema;

export const signupProfileValidationFieldErrorsSchema = z
  .strictObject({
    email: z.string().optional(),
    nickname: z.string().optional(),
    password: z.string().optional(),
  })
  .partial();

export const signupProfileValidationResponseSchema = genericErrorResponseSchema.extend({
  fieldErrors: signupProfileValidationFieldErrorsSchema.optional(),
});

export type GenericErrorResponse = z.infer<typeof genericErrorResponseSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
export type SignupProfileValidationFieldErrors = z.infer<
  typeof signupProfileValidationFieldErrorsSchema
>;
export type SignupProfileValidationResponse = z.infer<typeof signupProfileValidationResponseSchema>;
export type { AuthenticatedSessionUser };
