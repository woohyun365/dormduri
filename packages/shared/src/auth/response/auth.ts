import { z } from 'zod';
import {
  authenticatedSessionUserSchema,
  type AuthenticatedSessionUser,
} from '../../user/primitives.js';
import { genericErrorResponseSchema } from './base.js';

const opaqueAuthTokenSchema = z
  .string()
  .regex(/^v1\.[^.]+\.[A-Za-z0-9_-]{43}$/, 'opaque auth token 형식이어야 합니다.');

export const loginResponseSchema = genericErrorResponseSchema.extend({
  accessToken: opaqueAuthTokenSchema.optional(),
  renewalToken: opaqueAuthTokenSchema.optional(),
  rememberMe: z.boolean().optional(),
  user: authenticatedSessionUserSchema.optional(),
  locked: z.boolean().optional(),
  remainingSeconds: z.number().int().nonnegative().optional(),
});

export const verifyCodeResponseSchema = genericErrorResponseSchema;
export const signupResponseSchema = genericErrorResponseSchema.extend({
  user: authenticatedSessionUserSchema.optional(),
});
export const resetPasswordResponseSchema = genericErrorResponseSchema;
export const changePasswordResponseSchema = genericErrorResponseSchema.extend({
  accessToken: opaqueAuthTokenSchema.optional(),
  renewalToken: opaqueAuthTokenSchema.optional(),
  rememberMe: z.boolean().optional(),
});
export const renewSessionResponseSchema = genericErrorResponseSchema.extend({
  accessToken: opaqueAuthTokenSchema.optional(),
  renewalToken: opaqueAuthTokenSchema.optional(),
  rememberMe: z.boolean().optional(),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;
export type RenewSessionResponse = z.infer<typeof renewSessionResponseSchema>;
export type { AuthenticatedSessionUser };
