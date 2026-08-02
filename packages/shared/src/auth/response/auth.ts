import { z } from 'zod';
import {
  authenticatedSessionUserSchema,
  type AuthenticatedSessionUser,
} from '../../user/primitives.js';
import { opaqueAuthTokenSchema } from '../contract/primitives.js';
import { genericErrorResponseSchema } from './base.js';

const verificationGrantExpirySchema = z.number().int().positive();
export const AUTH_RESET_RESTART_REQUIRED_CODE = 'AUTH_RESET_RESTART_REQUIRED' as const;
export const AUTH_ACCOUNT_CREATED_LOGIN_REQUIRED_CODE =
  'AUTH_ACCOUNT_CREATED_LOGIN_REQUIRED' as const;
export const AUTH_PASSWORD_CHANGED_LOGIN_REQUIRED_CODE =
  'AUTH_PASSWORD_CHANGED_LOGIN_REQUIRED' as const;

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
export const signupFailureCodeSchema = z.enum([
  'AUTH_INVALID_EMAIL_FORMAT',
  'AUTH_SIGNUP_COLLEGE_UNAVAILABLE',
  'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
  'AUTH_PASSWORD_POLICY_VIOLATION',
  'AUTH_NICKNAME_ALREADY_TAKEN',
  'AUTH_SIGNUP_VALIDATION_FAILED',
  'AUTH_EMAIL_ALREADY_REGISTERED',
  'AUTH_LEGAL_ACCEPTANCE_STALE',
  'AUTH_ACCOUNT_CREATED_LOGIN_REQUIRED',
  'AUTH_SIGNUP_SUBMISSION_THROTTLED',
]);
export const signupFailureResponseSchema = genericErrorResponseSchema.extend({
  success: z.literal(false),
  code: signupFailureCodeSchema,
});
export const signupSuccessResponseSchema = z.strictObject({
  success: z.literal(true),
  accessToken: opaqueAuthTokenSchema,
  renewalToken: opaqueAuthTokenSchema,
  rememberMe: z.boolean(),
  user: authenticatedSessionUserSchema,
});
export const signupResponseSchema = z.discriminatedUnion('success', [
  signupSuccessResponseSchema,
  signupFailureResponseSchema,
]);
export const resetPasswordResponseSchema = genericErrorResponseSchema;
export const changePasswordFailureCodeSchema = z.enum([
  'AUTH_REAUTHENTICATION_REQUIRED',
  'AUTH_CURRENT_PASSWORD_INVALID',
  'AUTH_PASSWORD_POLICY_VIOLATION',
  'AUTH_PASSWORD_UNCHANGED',
  'AUTH_PASSWORD_CHANGED_LOGIN_REQUIRED',
  'AUTH_CHANGE_PASSWORD_THROTTLED',
]);
export const changePasswordFailureResponseSchema = genericErrorResponseSchema.extend({
  success: z.literal(false),
  code: changePasswordFailureCodeSchema,
});
export const changePasswordSuccessResponseSchema = z.strictObject({
  success: z.literal(true),
  accessToken: opaqueAuthTokenSchema,
  renewalToken: opaqueAuthTokenSchema,
  rememberMe: z.boolean(),
});
export const changePasswordResponseSchema = z.discriminatedUnion('success', [
  changePasswordSuccessResponseSchema,
  changePasswordFailureResponseSchema,
]);
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
export type SignupFailureCode = z.infer<typeof signupFailureCodeSchema>;
export type SignupFailureResponse = z.infer<typeof signupFailureResponseSchema>;
export type ResetPasswordResponse = z.infer<typeof resetPasswordResponseSchema>;
export type ChangePasswordResponse = z.infer<typeof changePasswordResponseSchema>;
export type ChangePasswordFailureCode = z.infer<typeof changePasswordFailureCodeSchema>;
export type ChangePasswordFailureResponse = z.infer<typeof changePasswordFailureResponseSchema>;
export type AuthSessionRenewalFailureCode = z.infer<typeof authSessionRenewalFailureCodeSchema>;
export type RenewSessionStaleResponse = z.infer<typeof renewSessionStaleResponseSchema>;
export type RenewSessionResponse = z.infer<typeof renewSessionResponseSchema>;
export type { AuthenticatedSessionUser };
