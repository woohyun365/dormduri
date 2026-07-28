import type { Campus } from '@repo/shared/auth';
import type { CollegeCode } from '@repo/shared/college';

export interface SignupAccountData {
  nickname: string;
  password: string;
  passwordConfirm: string;
  gender: 'M' | 'F' | null;
  campus: Campus | null;
  collegeCode: CollegeCode | null;
  birthYear: number | null;
}
