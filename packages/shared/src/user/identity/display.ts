import { z } from 'zod';

export const DISPLAY_IDENTITY_NICKNAME_MIN_LENGTH = 2;
export const DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH = 8;
export const DISPLAY_IDENTITY_NICKNAME_REGEX = /^[가-힣a-zA-Z0-9]+$/u;

export const displayIdentityNicknameSchema = z.string().trim().min(1);
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

export function normalizeDisplayIdentityNickname(nickname: string): string {
  return nickname.trim().toLowerCase();
}

export function validateDisplayIdentityNicknameStructure(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '닉네임을 입력해주세요.';
  if (trimmed.length < DISPLAY_IDENTITY_NICKNAME_MIN_LENGTH) {
    return `닉네임은 ${DISPLAY_IDENTITY_NICKNAME_MIN_LENGTH}자 이상이어야 합니다.`;
  }
  if (trimmed.length > DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH) {
    return `닉네임은 ${DISPLAY_IDENTITY_NICKNAME_MAX_LENGTH}자 이하여야 합니다.`;
  }
  if (!DISPLAY_IDENTITY_NICKNAME_REGEX.test(trimmed)) {
    return '닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.';
  }
  return '';
}
