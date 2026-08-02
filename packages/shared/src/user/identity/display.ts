import { z } from 'zod';

export const DISPLAY_IDENTITY_NICKNAME_MIN_LENGTH = 2;
export const DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH = 8;
const HANGUL_NICKNAME_REGEX = /^(?=.*[가-힣])[가-힣0-9]+$/u;
const LATIN_NICKNAME_REGEX = /^(?=.*[A-Za-z])[A-Za-z0-9]+$/u;
const HANGUL_CHARACTER_REGEX = /[가-힣]/u;
const LATIN_CHARACTER_REGEX = /[A-Za-z]/u;
const DIGITS_ONLY_REGEX = /^[0-9]+$/u;

export type DisplayIdentityNicknameScript = 'HANGUL' | 'LATIN';
export type DisplayIdentityNicknameParseErrorCode =
  | 'REQUIRED'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'MIXED_SCRIPT'
  | 'INVALID_CHARACTERS'
  | 'DIGITS_ONLY';

export type ParsedDisplayIdentityNickname =
  | {
      ok: true;
      value: string;
      normalized: string;
      script: DisplayIdentityNicknameScript;
    }
  | {
      ok: false;
      code: DisplayIdentityNicknameParseErrorCode;
      message: string;
    };

export const displayIdentityNicknameSchema = z
  .string()
  .transform(canonicalizeDisplayIdentityNickname)
  .pipe(z.string().min(1));
export const displayIdentityNicknameSourceSchema = z.literal('USER_DISPLAY_IDENTITY');
export const displayIdentityEditUnavailableReasonSchema = z.enum([
  'CURRENT_SEASON_REGISTRATION_LOCK',
  'NICKNAME_COOLDOWN_ACTIVE',
]);

export const userDisplayIdentitySchema = z.strictObject({
  userId: z.string(),
  nickname: z.string(),
  nicknameSource: displayIdentityNicknameSourceSchema,
  nicknameChangedAt: z.string().nullable(),
});

export type DisplayIdentityNicknameSource = z.infer<typeof displayIdentityNicknameSourceSchema>;
export type DisplayIdentityEditUnavailableReason = z.infer<
  typeof displayIdentityEditUnavailableReasonSchema
>;
export type UserDisplayIdentity = z.infer<typeof userDisplayIdentitySchema>;

export function canonicalizeDisplayIdentityNickname(nickname: string): string {
  return nickname.trim().normalize('NFKC');
}

export function normalizeDisplayIdentityNickname(nickname: string): string {
  return canonicalizeDisplayIdentityNickname(nickname).toLowerCase();
}

export function parseDisplayIdentityNickname(value: string): ParsedDisplayIdentityNickname {
  const canonicalValue = canonicalizeDisplayIdentityNickname(value);
  if (!canonicalValue) {
    return {
      ok: false,
      code: 'REQUIRED',
      message: '닉네임을 입력해주세요.',
    };
  }
  if (canonicalValue.length < DISPLAY_IDENTITY_NICKNAME_MIN_LENGTH) {
    return {
      ok: false,
      code: 'TOO_SHORT',
      message: `닉네임은 ${DISPLAY_IDENTITY_NICKNAME_MIN_LENGTH}자 이상이어야 합니다.`,
    };
  }
  if (canonicalValue.length > DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH) {
    return {
      ok: false,
      code: 'TOO_LONG',
      message: `닉네임은 ${DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH}자 이하여야 합니다.`,
    };
  }

  const hasHangul = HANGUL_CHARACTER_REGEX.test(canonicalValue);
  const hasLatin = LATIN_CHARACTER_REGEX.test(canonicalValue);
  if (hasHangul && hasLatin) {
    return {
      ok: false,
      code: 'MIXED_SCRIPT',
      message: '한글과 영문은 함께 사용할 수 없어요.',
    };
  }
  if (DIGITS_ONLY_REGEX.test(canonicalValue)) {
    return {
      ok: false,
      code: 'DIGITS_ONLY',
      message: '닉네임에는 한글 또는 영문이 한 글자 이상 필요해요.',
    };
  }

  const script = HANGUL_NICKNAME_REGEX.test(canonicalValue)
    ? 'HANGUL'
    : LATIN_NICKNAME_REGEX.test(canonicalValue)
      ? 'LATIN'
      : null;
  if (!script) {
    return {
      ok: false,
      code: 'INVALID_CHARACTERS',
      message: '닉네임은 한글 또는 영문으로 입력해 주세요.',
    };
  }

  return {
    ok: true,
    value: canonicalValue,
    normalized: canonicalValue.toLowerCase(),
    script,
  };
}

export function validateDisplayIdentityNicknameStructure(value: string): string {
  const result = parseDisplayIdentityNickname(value);
  return result.ok ? '' : result.message;
}
