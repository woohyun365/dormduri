import { validateKnuEmailFormat, validatePasswordStructure } from '@repo/shared/auth/policy';
import { validateDisplayIdentityNicknameStructure } from '@repo/shared/user/identity';

export function validateKnuEmail(email: string): string {
  return validateKnuEmailFormat(email);
}

export function validatePassword(password: string, email?: string): string {
  return validatePasswordStructure(password, email);
}

export function validatePasswordConfirm(password: string, confirm: string): string {
  if (password !== confirm) return '비밀번호가 일치하지 않습니다.';
  return '';
}

export function validateNickname(value: string): string {
  return validateDisplayIdentityNicknameStructure(value);
}
