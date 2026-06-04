import {
  buildPublicTargetPolicyTargetInput,
  buildPublicTargetPolicyViewerInput,
  toOperatedDormitoryIdSet,
} from './public-target-policy-input.mapper.js';
import type { CurrentSeasonParticipantRecord } from '../application/season-participants.service.js';

const COMPLETE_LIFESTYLE = {
  bedtime: '22_24',
  wakeTime: '07_08',
  sleepHabit: 'NONE',
  sleepEnvironment: 'QUIET',
  screenUsage: 'NONE',
  noiseSensitivity: 'NORMAL',
  smokingBehavior: 'NO',
  indoorEating: 'SNACK',
  phoneBehavior: 'SOMETIMES',
  earphoneUsage: 'MOSTLY',
  cleanLevel: 'WEEKLY_3_UP',
  drinkingFrequency: 'NONE',
  relationshipStyle: 'CLOSE',
  temperatureSensitivity: 'NORMAL',
  smokingTolerance: 'NO_ONLY',
  indoorEatingTolerance: 'NO_SMELL',
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
} as const;

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
    profile: { participantId: 'participant-1', lifestyle: COMPLETE_LIFESTYLE } as never,
    ...overrides,
  };
}

const seasonContext = {
  state: 'SEASON_MATCHING' as const,
  operatedDormitories: [
    { dormitoryId: 'dasan', isOperated: true, roomSelectionDate: '2026-02-11' },
    { dormitoryId: 'saerom', isOperated: true, roomSelectionDate: '2026-02-12' },
  ],
  schedule: {
    preparationStart: '2026-01-01',
    matchingStart: '2026-01-28',
    matchingEnd: '2026-02-12',
    seasonEnd: '2026-02-28',
  },
};

describe('public-target-policy-input.mapper', () => {
  it('viewer public target policy input은 matched partner와 roomSelection window를 분리해 유지한다', () => {
    const result = buildPublicTargetPolicyViewerInput({
      campusOperated: true,
      seasonState: 'SEASON_MATCHING',
      participant: makeParticipant(),
      matched: true,
      seasonProfileComplete: false,
      matchedPartnerParticipantId: 'participant-2',
      selection: {
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      operatedDormitoryIds: toOperatedDormitoryIdSet(seasonContext),
      currentDormitoryCanMatch: true,
    });

    expect(result).toEqual({
      campusOperated: true,
      seasonState: 'SEASON_MATCHING',
      registered: true,
      matched: true,
      seasonProfileComplete: false,
      matchedPartnerParticipantId: 'participant-2',
      selectionState: 'ASSIGNED',
      dormitoryId: 'dasan',
      hasOperatedAssignedDormitory: true,
      currentDormitoryCanMatch: true,
    });
  });

  it('target public target policy input은 OFF_SEASON이어도 hidden/deactivated target을 visible로 되살리지 않는다', () => {
    const operatedDormitoryIds = toOperatedDormitoryIdSet(seasonContext);
    const result = buildPublicTargetPolicyTargetInput({
      operatedDormitoryIds,
      participant: makeParticipant({
        hiddenByAdminAt: new Date('2026-02-01T00:00:00.000Z'),
      }),
      matched: false,
      selection: {
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      registrationSnapshotExists: true,
    });

    expect(result.visible).toBe(false);
    expect(result.hasOperatedAssignedDormitory).toBe(true);
    expect(result.hasSeasonProfile).toBe(true);
  });

  it('profile 없는 registered target은 visibility 축은 열고 profile completeness 축에서 거부되게 분리한다', () => {
    const operatedDormitoryIds = toOperatedDormitoryIdSet(seasonContext);
    const result = buildPublicTargetPolicyTargetInput({
      operatedDormitoryIds,
      participant: makeParticipant({
        profile: null,
      }),
      matched: false,
      selection: {
        dormitoryId: 'dasan',
        dormitorySelectionState: 'ASSIGNED',
      },
      registrationSnapshotExists: true,
    });

    expect(result.visible).toBe(true);
    expect(result.registered).toBe(true);
    expect(result.hasSeasonProfile).toBe(false);
    expect(result.seasonProfileComplete).toBe(false);
  });
});
