import { KNU_EMAIL_REGEX, PASSWORD_MIN_LENGTH, PASSWORD_REGEX } from '@/constants/auth';

export function validateKnuEmail(email: string): string {
  if (!email) return '이메일을 입력해주세요.';
  if (!KNU_EMAIL_REGEX.test(email)) return '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.';
  return '';
}

export function validatePassword(password: string): string {
  if (!password) return '비밀번호를 입력해주세요.';
  if (password.length < PASSWORD_MIN_LENGTH) return '비밀번호는 8자 이상이어야 합니다.';
  if (!PASSWORD_REGEX.test(password)) return '비밀번호는 영문과 숫자를 포함해야 합니다.';
  return '';
}

export function validatePasswordConfirm(password: string, confirm: string): string {
  if (password !== confirm) return '비밀번호가 일치하지 않습니다.';
  return '';
}
