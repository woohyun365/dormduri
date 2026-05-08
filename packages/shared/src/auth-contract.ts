import { z } from 'zod';
export { campusSchema, genderSchema } from './identity-contract.js';
export type { Campus, Gender } from './identity-contract.js';
import { lifestyleSchema } from './lifestyle.js';
import { campusSchema, genderSchema } from './identity-contract.js';

const emailSchema = z.email().trim().toLowerCase();
const verificationCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/);
const passwordSchema = z.string().min(1);
const nicknameSchema = z.string().trim().min(1);

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

export const signupProfileValidationRequestSchema = z.strictObject({
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
  lifestyle: lifestyleSchema,
  intro: z.string().trim(),
});

export const resetPasswordRequestSchema = z.strictObject({
  email: emailSchema,
  newPassword: passwordSchema,
});

export type EmailRequest = z.infer<typeof emailRequestSchema>;
export type VerificationCodeRequest = z.infer<typeof verificationCodeRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SignupProfileValidationRequest = z.infer<typeof signupProfileValidationRequestSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
