import { z } from 'zod';
import { authenticatedSessionUserSchema, type AuthenticatedSessionUser } from './user-contract.js';
import { genericErrorResponseSchema } from './auth-response-base.js';

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

export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
export type { AuthenticatedSessionUser };
