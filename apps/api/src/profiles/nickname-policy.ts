const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function hasNicknameCooldown(nicknameChangedAt: Date | null, now: Date): boolean {
  if (!nicknameChangedAt) {
    return false;
  }

  return now.getTime() < nicknameChangedAt.getTime() + THIRTY_DAYS_MS;
}
