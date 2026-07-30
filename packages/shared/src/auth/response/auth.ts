import { z } from 'zod';
import {
  authenticatedSessionUserSchema,
  type AuthenticatedSessionUser,
} from '../../user/primitives.js';
import { genericErrorResponseSchema } from './base.js';

const opaqueAuthTokenSchema = z
  .string()
  .regex(/^v1\.[^.]+\.[A-Za-z0-9_-]{43}$/, 'opaque auth token 형식이어야 합니다.');
const verificationGrantExpirySchema = z.number().int().positive();

const authSessionIssueResponseFields = {
  accessToken: opaqueAuthTokenSchema.optional(),
  renewalToken: opaqueAuthTokenSchema.optional(),
  rememberMe: z.boolean().optional(),
};

export const loginResponseSchema = genericErrorResponseSchema.extend({
  ...authSessionIssueResponseFields,
  user: authenticatedSessionUserSchema.optional(),
  locked: z.boolean().optional(),
  remainingSeconds: z.number().int().nonnegative().optional(),
});

export const verifyCodeResponseSchema = genericErrorResponseSchema.extend({
  grantExpiresInSeconds: verificationGrantExpirySchema.optional(),
});
export const verifySignupCodeTransportResponseSchema = genericErrorResponseSchema
  .extend({
    signupGrant: opaqueAuthTokenSchema.optional(),
    grantExpiresInSeconds: verificationGrantExpirySchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.success && (!value.signupGrant || !value.grantExpiresInSeconds)) {
      context.addIssue({
        code: 'custom',
        message: 'Successful signup code verification requires a bounded grant.',
      });
    }
  });
export const verifyResetCodeTransportResponseSchema = genericErrorResponseSchema
  .extend({
    resetGrant: opaqueAuthTokenSchema.optional(),
    grantExpiresInSeconds: verificationGrantExpirySchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.success && (!value.resetGrant || !value.grantExpiresInSeconds)) {
      context.addIssue({
        code: 'custom',
        message: 'Successful reset code verification requires a bounded grant.',
      });
    }
  });
export const signupResponseSchema = genericErrorResponseSchema.extend({
  ...authSessionIssueResponseFields,
  user: authenticatedSessionUserSchema.optional(),
});
export const resetPasswordResponseSchema = genericErrorResponseSchema;
export const changePasswordResponseSchema = genericErrorResponseSchema.extend({
  ...authSessionIssueResponseFields,
});
export const authSessionRenewalFailureCodeSchema = z.enum([
  'AUTH_SESSION_RENEWAL_STALE',
  'AUTH_SESSION_RENEWAL_REQUIRED',
  'AUTH_SESSION_RENEWAL_REUSED',
]);
export const renewSessionStaleResponseSchema = z.strictObject({
  success: z.literal(false),
  code: z.literal('AUTH_SESSION_RENEWAL_STALE'),
  error: z.string().optional(),
  userActionable: z.boolean().optional(),
  retryAfterMilliseconds: z.number().int().positive(),
});
const renewSessionSuccessResponseSchema = z.strictObject({
  success: z.literal(true),
  accessToken: opaqueAuthTokenSchema,
  renewalToken: opaqueAuthTokenSchema,
  rememberMe: z.boolean(),
});
const renewSessionTerminalFailureResponseSchema = genericErrorResponseSchema.extend({
  success: z.literal(false),
  code: z.enum(['AUTH_SESSION_RENEWAL_REQUIRED', 'AUTH_SESSION_RENEWAL_REUSED']),
});
export const renewSessionResponseSchema = z.union([
  renewSessionSuccessResponseSchema,
  renewSessionStaleResponseSchema,
  renewSessionTerminalFailureResponseSchema,
]);

export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type VerifyCodeResponse = z.infer<typeof verifyCodeResponseSchema>;
export type VerifySignupCodeTransportResponse = z.infer<
  typeof verifySignupCodeTransportResponseSchema
>;
export type VerifyResetCodeTransportResponse = z.infer<
  typeof verifyResetCodeTransportResponseSchema
>;
export type SignupResponse = z.infer<typeof signupResponseSchema>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;
export type AuthSessionRenewalFailureCode = z.infer<typeof authSessionRenewalFailureCodeSchema>;
export type RenewSessionStaleResponse = z.infer<typeof renewSessionStaleResponseSchema>;
export type RenewSessionResponse = z.infer<typeof renewSessionResponseSchema>;
export type { AuthenticatedSessionUser };
