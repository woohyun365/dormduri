export const KNU_EMAIL_DOMAIN = '@kangwon.ac.kr';
export const KNU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@kangwon\.ac\.kr$/;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_REGEX = /(?=.*[a-zA-Z])(?=.*\d)/u;

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 8;
export const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]+$/u;

export const SIGNUP_VERIFICATION_CODE_TTL_SECONDS = 600;
export const RESET_PASSWORD_VERIFICATION_CODE_TTL_SECONDS = 600;
export const SIGNUP_VERIFIED_PROOF_TTL_SECONDS = 60 * 30;

export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_LOCKOUT_SECONDS = 60 * 5;

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
