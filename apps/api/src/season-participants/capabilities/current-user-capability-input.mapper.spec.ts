import { describe, expect, it } from 'vitest';
import { buildCurrentUserCapabilityInput } from './current-user-capability-input.mapper.js';
import { toOperatedDormitoryIdSet } from '../public-target-policy/index.js';
import type { CurrentSeasonParticipantRecord } from '../application/season-participants.service.js';

function makeParticipant(
  overrides: Partial<CurrentSeasonParticipantRecord> = {},
): CurrentSeasonParticipantRecord {
  return {
    id: 'participant-1',
    seasonId: 'season-1',
    userId: 'user-1',
    participationIntent: 'REGISTERED',
    registeredAt: new Date('2026-02-01T00:00:00.000Z'),
    declinedAt: null,
    dormitoryId: 'dasan',
    dormitorySelectionState: 'ASSIGNED',
    participantStatus: 'ACTIVE',
    campusCodeSnapshot: 'CHUNCHEON',
    genderSnapshot: 'M',
    joinedAt: new Date('2026-02-01T00:00:00.000Z'),
    activatedAt: new Date('2026-02-01T00:00:00.000Z'),
    matchedAt: null,
    withdrawnAt: null,
    expiredAt: null,
    hiddenByAdminAt: null,
    hiddenReasonCode: null,
    hiddenReasonDetail: null,
    deactivatedAt: null,
    createdAt: new Date('2026-02-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    profile: null,
    ...overrides,
  };
}

describe('current-user-capability-input.mapper', () => {
  it('capability input을 같은 source들에서 일관되게 계산한다', () => {
    const seasonContext = {
      operatedDormitories: [
        { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
        { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-02-12' },
      ],
    };

    const result = buildCurrentUserCapabilityInput({
      campusOperated: true,
      seasonState: 'SEASON_MATCHING',
      participant: makeParticipant(),
      participantMatched: false,
      seasonProfileComplete: true,
      selection: {
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      operatedDormitoryIds: toOperatedDormitoryIdSet(seasonContext),
      currentDormitoryCanMatch: true,
      nicknameLockedBySeason: true,
      nicknameCooldownActive: false,
    });

    expect(result).toMatchObject({
      participantRegistered: true,
      hasOperatedAssignedDormitory: true,
      hasSelectableDormitories: true,
      currentDormitoryCanMatch: true,
      participantMatched: false,
    });
  });
});
