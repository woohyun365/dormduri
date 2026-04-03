import { z } from 'zod';
import { lifestyleSchema } from './lifestyle.js';

export const genderSchema = z.enum(['M', 'F']);
export const campusSchema = z.enum(['CHUNCHEON', 'SAMCHEOK', 'DOGYE']);

export const emailRequestSchema = z.strictObject({
  email: z.string(),
});

export const verificationCodeRequestSchema = z.strictObject({
  email: z.string(),
  code: z.string(),
});

export const loginRequestSchema = z.strictObject({
  email: z.string(),
  password: z.string(),
  rememberMe: z.boolean().optional(),
});

export const signupRequestSchema = z.strictObject({
  email: z.string(),
  password: z.string(),
  nickname: z.string(),
  gender: genderSchema,
  campus: campusSchema,
  lifestyle: lifestyleSchema,
  intro: z.string(),
});

export const resetPasswordRequestSchema = z.strictObject({
  email: z.string(),
  newPassword: z.string(),
});

export type EmailRequest = z.infer<typeof emailRequestSchema>;
export type VerificationCodeRequest = z.infer<typeof verificationCodeRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
