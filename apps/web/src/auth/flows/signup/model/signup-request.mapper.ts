import {
  signupRequestSchema,
  type Campus,
  type Gender,
  type SignupRequest,
} from '@repo/shared/auth';
import type { SignupLegalAcceptances } from '@repo/shared/legal';
import type { CollegeCode } from '@repo/shared/college';

export interface SignupRequestMapperInput {
  readonly email: string;
  readonly password: string;
  readonly nickname: string;
  readonly gender: Gender;
  readonly campus: Campus;
  readonly collegeCode: CollegeCode;
  readonly birthYear: number;
  readonly legalAcceptances: SignupLegalAcceptances;
}

export function createSignupRequest(input: SignupRequestMapperInput): SignupRequest {
  return signupRequestSchema.parse({
    email: input.email,
    password: input.password,
    nickname: input.nickname,
    gender: input.gender,
    campus: input.campus,
    collegeCode: input.collegeCode,
    birthYear: input.birthYear,
    legalAcceptances: input.legalAcceptances,
  });
}
