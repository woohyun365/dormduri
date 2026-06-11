import type { LocalDateString } from '@repo/shared/date';

const DAY_MS = 24 * 60 * 60 * 1000;
const MATCH_REQUEST_TTL_DAYS = 5;

export function addDays(referenceAt: Date, days: number) {
  return new Date(referenceAt.getTime() + days * DAY_MS);
}

export function resolveDormitoryRoomSelectionEnd(roomSelectionDate: LocalDateString) {
  return new Date(`${roomSelectionDate}T23:59:59+09:00`);
}

export function resolveMatchRequestExpiresAt(createdAt: Date, roomSelectionDate: LocalDateString) {
  const ttlExpiresAt = addDays(createdAt, MATCH_REQUEST_TTL_DAYS);
  const roomSelectionEndsAt = resolveDormitoryRoomSelectionEnd(roomSelectionDate);

  return ttlExpiresAt.getTime() <= roomSelectionEndsAt.getTime()
    ? ttlExpiresAt
    : roomSelectionEndsAt;
}

export function isCooldownActive(terminalAt: Date, now: Date, cooldownDays: number = 2) {
  return now.getTime() < addDays(terminalAt, cooldownDays).getTime();
}
