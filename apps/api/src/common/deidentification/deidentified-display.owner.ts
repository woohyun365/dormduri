import type { PublicProfileTombstoneReason } from '@repo/shared/profile-contract';

export const DEIDENTIFIED_USER_DISPLAY_NAME = '탈퇴한 사용자';
export const PROFILE_UNAVAILABLE_DISPLAY_NAME = '프로필 확인 불가';

export function isDeletedOrDeidentified(input: { deletedAt?: Date | null } | null | undefined) {
  return Boolean(input?.deletedAt);
}

export function resolveProfileDisplayName(input: {
  deletedOrDeidentified?: boolean;
  deletedAt?: Date | null;
  displayName?: string | null;
}): string {
  if (input.deletedOrDeidentified || input.deletedAt) {
    return DEIDENTIFIED_USER_DISPLAY_NAME;
  }

  return input.displayName ?? PROFILE_UNAVAILABLE_DISPLAY_NAME;
}

export function resolveProfileTombstoneDisplayName(input: {
  reason: PublicProfileTombstoneReason;
  displayName?: string | null;
}): string {
  if (input.reason === 'TARGET_DELETED_OR_DEIDENTIFIED') {
    return DEIDENTIFIED_USER_DISPLAY_NAME;
  }

  return input.displayName ?? PROFILE_UNAVAILABLE_DISPLAY_NAME;
}

export function resolvePublicCounterpartNickname(input: {
  deletedAt?: Date | null;
  nicknameSnapshot?: string | null;
}): string {
  return resolveProfileDisplayName({
    deletedAt: input.deletedAt,
    displayName: input.nicknameSnapshot,
  });
}
