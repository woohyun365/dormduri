import {
  KNU_EMAIL_REGEX,
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX,
} from './constants.js';

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export function validateKnuEmailFormat(email: string): string {
  if (!email) return '이메일을 입력해주세요.';
  if (!KNU_EMAIL_REGEX.test(email.trim())) {
    return '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.';
  }
  return '';
}

export function validatePasswordStructure(password: string, email?: string): string {
  if (!password) return '비밀번호를 입력해주세요.';
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`;
  }
  if (!PASSWORD_REGEX.test(password)) {
    return '비밀번호는 영문과 숫자를 포함해야 합니다.';
  }
  if (email && password.toLowerCase() === email.toLowerCase()) {
    return '비밀번호는 이메일과 같을 수 없습니다.';
  }
  return '';
}

export function validateNicknameStructure(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '닉네임을 입력해주세요.';
  if (trimmed.length < NICKNAME_MIN_LENGTH) {
    return `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (trimmed.length > NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.`;
  }
  if (!NICKNAME_REGEX.test(trimmed)) {
    return '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.';
  }
  return '';
}
