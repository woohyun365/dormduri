import { z } from 'zod';
import { isCollegeAvailableForCampus } from '../../college/index.js';
import { campusSchema, genderSchema } from '../../identity/primitives.js';
import { signupLegalAcceptancesSchema } from '../../legal/contract.js';
import { userAcademicIdentitySchema } from '../../user/identity/academic.js';
import { displayIdentityNicknameSchema } from '../../user/identity/display.js';
import {
  emailSchema,
  opaqueAuthTokenSchema,
  passwordSchema,
  verificationCodeSchema,
} from './primitives.js';

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

export const signupNicknameValidationRequestSchema = z.strictObject({
  nickname: displayIdentityNicknameSchema,
});

export const signupRequestSchema = z
  .strictObject({
    email: emailSchema,
    password: passwordSchema,
    nickname: displayIdentityNicknameSchema,
    gender: genderSchema,
    campus: campusSchema,
    legalAcceptances: signupLegalAcceptancesSchema,
  })
  .extend(userAcademicIdentitySchema.shape)
  .superRefine((input, context) => {
    if (!isCollegeAvailableForCampus(input.campus, input.collegeCode)) {
      context.addIssue({
        code: 'custom',
        path: ['collegeCode'],
        message: '선택한 캠퍼스의 단과대를 다시 선택해주세요.',
      });
    }
  });

export const resetPasswordRequestSchema = z.strictObject({
  newPassword: passwordSchema,
});

export const changePasswordRequestSchema = z.strictObject({
  currentPassword: passwordSchema,
  newPassword: passwordSchema,
});

export const renewSessionRequestSchema = z.strictObject({
  renewalToken: z.string().min(1),
});

export const logoutRequestSchema = z.strictObject({
  renewalToken: opaqueAuthTokenSchema.optional(),
});

export type EmailRequest = z.infer<typeof emailRequestSchema>;
export type VerificationCodeRequest = z.infer<typeof verificationCodeRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type SignupNicknameValidationRequest = z.infer<typeof signupNicknameValidationRequestSchema>;
export type SignupRequest = z.infer<typeof signupRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
export type RenewSessionRequest = z.infer<typeof renewSessionRequestSchema>;
export type LogoutRequest = z.infer<typeof logoutRequestSchema>;

export const AUTH_VERIFICATION_GRANT_HEADER = 'X-Auth-Verification-Grant';
