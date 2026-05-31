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
