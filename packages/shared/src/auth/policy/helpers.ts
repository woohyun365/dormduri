import {
  KNU_EMAIL_REGEX,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_PRINTABLE_ASCII_REGEX,
} from './constants.js';

export type PasswordStructureErrorCode =
  | 'REQUIRED'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'WHITESPACE_NOT_ALLOWED'
  | 'INVALID_CHARACTERS'
  | 'MATCHES_EMAIL';

export type PasswordStructureResult =
  | { ok: true }
  | {
      ok: false;
      code: PasswordStructureErrorCode;
      message: string;
    };

const PASSWORD_WHITESPACE_REGEX = /\p{White_Space}/u;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function passwordMatchesEmailIdentity(password: string, email: string): boolean {
  if (!password || !email) return false;

  const passwordKey = password.toLowerCase();
  const emailKey = normalizeEmail(email);
  const emailLocalPart = emailKey.split('@', 1)[0] ?? '';

  return passwordKey === emailKey || (emailLocalPart.length > 0 && passwordKey === emailLocalPart);
}

export function validateKnuEmailFormat(email: string): string {
  if (!email) return '이메일을 입력해주세요.';
  if (!KNU_EMAIL_REGEX.test(email.trim())) {
    return '강원대학교 이메일(@kangwon.ac.kr)을 입력해주세요.';
  }
  return '';
}

function parsePasswordTransportStructure(password: string): PasswordStructureResult {
  if (!password) {
    return {
      ok: false,
      code: 'REQUIRED',
      message: '비밀번호를 입력해주세요.',
    };
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return {
      ok: false,
      code: 'TOO_LONG',
      message: `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`,
    };
  }
  if (PASSWORD_WHITESPACE_REGEX.test(password)) {
    return {
      ok: false,
      code: 'WHITESPACE_NOT_ALLOWED',
      message: '공백 없이 입력해 주세요.',
    };
  }
  if (!PASSWORD_PRINTABLE_ASCII_REGEX.test(password)) {
    return {
      ok: false,
      code: 'INVALID_CHARACTERS',
      message: '영문·숫자·기호만 사용할 수 있어요.',
    };
  }

  return { ok: true };
}

export function parseNewPasswordStructure(
  password: string,
  email?: string,
): PasswordStructureResult {
  const transportResult = parsePasswordTransportStructure(password);
  if (!transportResult.ok) return transportResult;

  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      code: 'TOO_SHORT',
      message: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`,
    };
  }
  if (email && passwordMatchesEmailIdentity(password, email)) {
    return {
      ok: false,
      code: 'MATCHES_EMAIL',
      message: '이메일 정보와 다른 비밀번호를 입력해 주세요.',
    };
  }

  return { ok: true };
}

export function parseLoginPasswordInput(password: string): PasswordStructureResult {
  return parsePasswordTransportStructure(password);
}

export function validatePasswordStructure(password: string, email?: string): string {
  const result = parseNewPasswordStructure(password, email);
  return result.ok ? '' : result.message;
}
