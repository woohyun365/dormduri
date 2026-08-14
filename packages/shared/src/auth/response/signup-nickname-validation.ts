import { z } from 'zod';
import { displayIdentityNicknameSchema } from '../../user/identity/display.js';

export const signupNicknameValidationFailureCodeSchema = z.enum([
  'AUTH_SIGNUP_EMAIL_VERIFICATION_REQUIRED',
  'AUTH_SIGNUP_NICKNAME_INVALID',
  'AUTH_SIGNUP_NICKNAME_NOT_ALLOWED',
  'AUTH_NICKNAME_ALREADY_TAKEN',
  'AUTH_SIGNUP_NICKNAME_VALIDATION_THROTTLED',
]);

const signupNicknameValidationSuccessSchema = z.strictObject({
  success: z.literal(true),
  nickname: displayIdentityNicknameSchema,
});

const signupNicknameValidationFailureSchema = z.strictObject({
  success: z.literal(false),
  code: signupNicknameValidationFailureCodeSchema,
  error: z.string(),
  userActionable: z.boolean(),
  fieldErrors: z
    .strictObject({
      nickname: z.string().optional(),
    })
    .optional(),
  retryAfterSeconds: z.number().int().positive().optional(),
});

export const signupNicknameValidationResponseSchema = z.discriminatedUnion('success', [
  signupNicknameValidationSuccessSchema,
  signupNicknameValidationFailureSchema,
]);

export type SignupNicknameValidationFailureCode = z.infer<
  typeof signupNicknameValidationFailureCodeSchema
>;
export type SignupNicknameValidationResponse = z.infer<
  typeof signupNicknameValidationResponseSchema
>;
