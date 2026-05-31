import { z } from 'zod';

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
