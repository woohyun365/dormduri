import type { CurrentSeasonParticipantRecord } from '../participants/season-participant-records.js';
import { currentParticipant, now } from '../test-support/season-participants.spec-fixtures.js';
import {
  isParticipantInactive,
  isParticipantRegistrationLocked,
} from './season-participation-capability.policy.js';

function participant(
  overrides: Partial<CurrentSeasonParticipantRecord> = {},
): CurrentSeasonParticipantRecord {
  return currentParticipant(overrides) as CurrentSeasonParticipantRecord;
}

describe('season-participation-capability.policy', () => {
  it.each([
    [
      'declined',
      {
        participationIntent: 'DECLINED',
        declinedAt: now,
      } satisfies Partial<CurrentSeasonParticipantRecord>,
    ],
    [
      'withdrawn',
      {
        participantStatus: 'WITHDRAWN',
        withdrawnAt: now,
      } satisfies Partial<CurrentSeasonParticipantRecord>,
    ],
    [
      'expired status',
      { participantStatus: 'EXPIRED' } satisfies Partial<CurrentSeasonParticipantRecord>,
    ],
    ['expired timestamp', { expiredAt: now } satisfies Partial<CurrentSeasonParticipantRecord>],
  ])('%s participant는 registration locked 상태다', (_caseName, overrides) => {
    expect(isParticipantRegistrationLocked(participant(overrides))).toBe(true);
  });

  it.each([
    [
      'hidden projection',
      { hiddenByAdminAt: now } satisfies Partial<CurrentSeasonParticipantRecord>,
    ],
    [
      'deactivated projection',
      { deactivatedAt: now } satisfies Partial<CurrentSeasonParticipantRecord>,
    ],
  ])('%s participant는 inactive projection 상태다', (_caseName, overrides) => {
    expect(isParticipantInactive(participant(overrides))).toBe(true);
  });
});
