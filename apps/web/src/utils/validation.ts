import {
  KNU_EMAIL_REGEX,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_REGEX,
  NICKNAME_REGEX,
  RESERVED_NICKNAME_KO,
  RESERVED_NICKNAME_EN,
} from '@/constants/auth';
import { NICKNAME_MIN, NICKNAME_MAX } from '@/constants/ui';

export function validateKnuEmail(email: string): string {
  if (!email) return '이메일을 입력해주세요.';
  if (!KNU_EMAIL_REGEX.test(email)) return '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.';
  return '';
}

export function validatePassword(password: string, email?: string): string {
  if (!password) return '비밀번호를 입력해주세요.';
  if (password.length < PASSWORD_MIN_LENGTH)
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  if (password.length > PASSWORD_MAX_LENGTH)
    return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`;
  if (!PASSWORD_REGEX.test(password)) return '비밀번호는 영문과 숫자를 포함해야 합니다.';
  if (email && password.toLowerCase() === email.toLowerCase())
    return '비밀번호는 이메일과 같을 수 없습니다.';
  return '';
}

export function validatePasswordConfirm(password: string, confirm: string): string {
  if (password !== confirm) return '비밀번호가 일치하지 않습니다.';
  return '';
}

export function validateNickname(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '닉네임을 입력해주세요.';
  if (trimmed.length < NICKNAME_MIN) return `닉네임은 ${NICKNAME_MIN}자 이상이어야 합니다.`;
  if (trimmed.length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자 이하여야 합니다.`;
  if (!NICKNAME_REGEX.test(trimmed)) return '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.';
  const lower = trimmed.toLowerCase();
  if (RESERVED_NICKNAME_KO.some((word) => lower.includes(word))) {
    return '사용할 수 없는 단어가 포함되어 있습니다.';
  }
  if (RESERVED_NICKNAME_EN.some((word) => lower === word)) {
    return '사용할 수 없는 단어가 포함되어 있습니다.';
  }
  return '';
}
