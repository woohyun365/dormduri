import { z } from 'zod';
import { campusSchema, genderSchema } from './identity-contract.js';
import {
  emailSchema,
  nicknameSchema,
  passwordSchema,
  verificationCodeSchema,
} from './auth-contract-primitives.js';

export const emailRequestSchema = z.strictObject({
  email: emailSchema,
});

export const verificationCodeRequestSchema = z.strictObject({
  email: emailSchema,
  code: verificationCodeSchema,
});

export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  rememberMe: z.boolean().optional(),
});

export const signupDraftValidationRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  nickname: nicknameSchema,
});

export const signupRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  nickname: nicknameSchema,
  gender: genderSchema,
  campus: campusSchema,
});

export const resetPasswordRequestSchema = z.strictObject({
  email: emailSchema,
  newPassword: passwordSchema,
});

export type EmailRequest = z.infer<typeof emailRequestSchema>;
export type VerificationCodeRequest = z.infer<typeof verificationCodeRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SignupDraftValidationRequest = z.infer<typeof signupDraftValidationRequestSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
