export { campusSchema, genderSchema } from './identity-contract.js';
export type { Campus, Gender } from './identity-contract.js';
export {
  emailRequestSchema,
  verificationCodeRequestSchema,
  loginRequestSchema,
  signupProfileValidationRequestSchema,
  signupRequestSchema,
  resetPasswordRequestSchema,
} from './auth-contract-requests.js';
export type {
  EmailRequest,
  VerificationCodeRequest,
  LoginRequest,
  SignupProfileValidationRequest,
  SignupRequest,
  ResetPasswordRequest,
} from './auth-contract-requests.js';
