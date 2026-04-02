import type { Campus } from '@/types/profile';

export const KNU_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@kangwon\.ac\.kr$/;
export const VERIFICATION_CODE_TTL = 180;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_REGEX = /(?=.*[a-zA-Z])(?=.*\d)/;

export const LOGIN_FAILURE_LIMIT = 5;
export const LOGIN_LOCKOUT_SECONDS = 300;

export const NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]+$/;
export const RESERVED_NICKNAME_KO = ['관리자', '운영자', '운영팀', '테스트'];
export const RESERVED_NICKNAME_EN = ['admin', 'system', 'test', 'demo'];

export const CAMPUS_OPTIONS: { value: Campus; label: string }[] = [
  { value: 'CHUNCHEON', label: '춘천캠퍼스' },
  { value: 'SAMCHEOK', label: '삼척캠퍼스' },
  { value: 'DOGYE', label: '도계캠퍼스' },
];
