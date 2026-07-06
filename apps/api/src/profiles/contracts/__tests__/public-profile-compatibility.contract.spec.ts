import { describe, expect, it } from 'vitest';
import {
  publicProfileCompatibilitySchema,
  publicProfileSchema,
  type PublicProfileCompatibility,
} from '@repo/shared/profile/contract';

const compatibilityFixture = {
  overallScore: 92,
  axes: [
    { id: 'SMOKING', score: 100, bucket: 'HIGH' },
    { id: 'CLEAN_LEVEL', score: 30, bucket: 'LOW' },
  ],
  hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
} satisfies PublicProfileCompatibility;

const fullProfileFixture = {
  id: 'user-2',
  detailState: 'FULL',
  sourceProfile: 'SEASON_PARTICIPANT_PROFILE',
  relation: { type: 'GENERAL' },
  exposure: {
    listSummaryVisible: true,
    detailViewable: true,
    canViewFull: true,
    scoreVisible: true,
  },
  actions: {
    canBookmark: true,
    canRequestMatch: true,
    canStartChat: true,
    unavailableReasons: [],
  },
  resultRead: { resultReadable: false, context: 'NONE' },
  nickname: '상대',
  intro: '소개',
  additional: { college: 'IT', grade: '3', mbti: 'INTJ', birthYear: 2002 },
  gender: 'M',
  campus: 'CHUNCHEON',
  lifestyle: {
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
    relationshipStyle: 'CLOSE',
    temperatureSensitivity: 'NORMAL',
  },
  matchScore: 92,
  compatibility: compatibilityFixture,
} as const;

const tombstoneFixture = {
  id: 'user-removed',
  detailState: 'TOMBSTONE',
  relation: { type: 'GENERAL' },
  exposure: {
    listSummaryVisible: false,
    detailViewable: true,
    canViewFull: false,
    scoreVisible: false,
  },
  actions: {
    canBookmark: false,
    canRequestMatch: false,
    canStartChat: false,
    unavailableReasons: ['TARGET_DELETED_OR_DEIDENTIFIED'],
  },
  resultRead: { resultReadable: false, context: 'NONE' },
  tombstone: {
    reason: 'TARGET_NO_LONGER_DISCOVERABLE',
    displayName: '상대 프로필',
    message: '현재는 상대 프로필 상세 정보를 볼 수 없어요.',
  },
} as const;

describe('PublicProfileCompatibility contract', () => {
  it('FULL detail에서 allowlist compatibility payload만 허용한다', () => {
    expect(publicProfileSchema.safeParse(fullProfileFixture).success).toBe(true);
  });

  it('FULL compatibility는 scoreVisible=true matchScore와 같은 overallScore가 필요하다', () => {
    expect(
      publicProfileSchema.safeParse({
        ...fullProfileFixture,
        matchScore: undefined,
      }).success,
    ).toBe(false);

    expect(
      publicProfileSchema.safeParse({
        ...fullProfileFixture,
        exposure: { ...fullProfileFixture.exposure, scoreVisible: false },
      }).success,
    ).toBe(false);

    expect(
      publicProfileSchema.safeParse({
        ...fullProfileFixture,
        compatibility: { ...compatibilityFixture, overallScore: 91 },
      }).success,
    ).toBe(false);
  });

  it('TOMBSTONE detail에는 compatibility를 허용하지 않는다', () => {
    expect(
      publicProfileSchema.safeParse({
        ...tombstoneFixture,
        compatibility: compatibilityFixture,
      }).success,
    ).toBe(false);
  });

  it('compatibility axis의 hidden/raw/debug field를 거부한다', () => {
    const invalidKeys = [
      'viewerValue',
      'targetValue',
      'targetCondition',
      'drinkingFrequency',
      'drinkingTolerance',
      'fieldKey',
      'matrixKey',
    ] as const;

    for (const key of invalidKeys) {
      expect(
        publicProfileCompatibilitySchema.safeParse({
          ...compatibilityFixture,
          axes: [{ ...compatibilityFixture.axes[0], [key]: 'raw-value' }],
        }).success,
      ).toBe(false);
    }
  });

  it('hidden notice code allowlist 밖의 값을 거부한다', () => {
    expect(
      publicProfileCompatibilitySchema.safeParse({
        ...compatibilityFixture,
        hiddenAxisNotices: [{ code: 'DRINKING_FREQUENCY_NONE' }],
      }).success,
    ).toBe(false);
  });
});
