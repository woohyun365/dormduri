import { describe, expect, it } from 'vitest';
import {
  buildPublicProfileCompatibility,
  calcViewerMatchScore,
  canComputeMatchScore,
} from '@repo/shared/profile/compatibility-scoring';
import {
  isLifestyleCoreComplete,
  isRoommateConditionComplete,
  isSeasonProfileComplete,
  type LifestyleData,
} from '@repo/shared/lifestyle';

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

describe('matches score algorithm', () => {
  it('핵심 프로필 / 룸메 조건 / 시즌 프로필 complete helper를 분리한다', () => {
    expect(isLifestyleCoreComplete(COMPLETE_LIFESTYLE)).toBe(true);
    expect(isRoommateConditionComplete(COMPLETE_LIFESTYLE)).toBe(true);
    expect(isSeasonProfileComplete(COMPLETE_LIFESTYLE)).toBe(true);

    expect(
      isLifestyleCoreComplete({
        ...COMPLETE_LIFESTYLE,
        smokingBehavior: null,
      }),
    ).toBe(false);
    expect(
      isRoommateConditionComplete({
        ...COMPLETE_LIFESTYLE,
        smokingTolerance: null,
      }),
    ).toBe(false);
  });

  it('score 계산 가능 여부는 viewer/target 시즌 프로필 complete를 함께 본다', () => {
    expect(canComputeMatchScore(COMPLETE_LIFESTYLE, COMPLETE_LIFESTYLE)).toBe(true);
    expect(
      canComputeMatchScore(
        {
          ...COMPLETE_LIFESTYLE,
          smokingTolerance: null,
        },
        COMPLETE_LIFESTYLE,
      ),
    ).toBe(false);
    expect(
      canComputeMatchScore(COMPLETE_LIFESTYLE, {
        ...COMPLETE_LIFESTYLE,
        smokingBehavior: null,
      }),
    ).toBe(false);
  });

  it('viewer 기준 directional score를 계산한다', () => {
    const scoreA = calcViewerMatchScore(COMPLETE_LIFESTYLE, {
      ...COMPLETE_LIFESTYLE,
      cleanLevel: 'WHEN_DIRTY',
      cleanExpectation: 'FLEXIBLE',
    });
    const scoreB = calcViewerMatchScore(
      {
        ...COMPLETE_LIFESTYLE,
        cleanLevel: 'WHEN_DIRTY',
        cleanExpectation: 'FLEXIBLE',
      },
      COMPLETE_LIFESTYLE,
    );

    expect(scoreA).not.toBeNull();
    expect(scoreB).not.toBeNull();
    expect(scoreA).not.toBe(scoreB);
  });

  it('public compatibility breakdown은 overall score와 allowlist axis만 노출한다', () => {
    const compatibility = buildPublicProfileCompatibility(COMPLETE_LIFESTYLE, {
      ...COMPLETE_LIFESTYLE,
      cleanLevel: 'WHEN_DIRTY',
      cleanExpectation: 'FLEXIBLE',
      wakeTime: 'FLEXIBLE',
    });

    expect(compatibility.overallScore).toBe(
      calcViewerMatchScore(COMPLETE_LIFESTYLE, {
        ...COMPLETE_LIFESTYLE,
        cleanLevel: 'WHEN_DIRTY',
        cleanExpectation: 'FLEXIBLE',
        wakeTime: 'FLEXIBLE',
      }),
    );
    expect(compatibility.axes.map((axis) => axis.id)).toEqual([
      'SMOKING',
      'SLEEP_HABIT',
      'PHONE',
      'EARPHONE',
      'SLEEP_ENVIRONMENT',
      'SCREEN_USAGE',
      'CLEAN_LEVEL',
      'INDOOR_EATING',
      'BEDTIME',
      'WAKE_TIME',
      'TEMPERATURE',
      'RELATIONSHIP',
    ]);
    expect(compatibility.axes.map((axis) => axis.id)).not.toContain('DRINKING');
    expect(compatibility.dimensions.map((dimension) => dimension.id)).toEqual([
      'SMOKING',
      'SLEEP_RHYTHM',
      'SLEEP_HABIT',
      'SLEEP_ENVIRONMENT',
      'DEVICE_USAGE',
      'CLEAN_SPACE',
      'TEMPERATURE',
      'RELATIONSHIP_STYLE',
    ]);
    expect(
      compatibility.dimensions.find((dimension) => dimension.id === 'SLEEP_RHYTHM'),
    ).toMatchObject({
      axisIds: ['BEDTIME', 'WAKE_TIME'],
      bucket: 'HIGH',
    });
    expect(
      compatibility.dimensions.find((dimension) => dimension.id === 'SLEEP_HABIT'),
    ).toMatchObject({
      axisIds: ['SLEEP_HABIT'],
    });
    expect(
      compatibility.dimensions.find((dimension) => dimension.id === 'SLEEP_ENVIRONMENT'),
    ).toMatchObject({
      axisIds: ['SCREEN_USAGE', 'SLEEP_ENVIRONMENT'],
    });
    expect(
      compatibility.dimensions.find((dimension) => dimension.id === 'CLEAN_SPACE'),
    ).toMatchObject({
      axisIds: ['CLEAN_LEVEL', 'INDOOR_EATING'],
    });
    expect(
      compatibility.dimensions.find((dimension) => dimension.id === 'TEMPERATURE'),
    ).toMatchObject({
      axisIds: ['TEMPERATURE'],
    });
    expect(compatibility.hiddenAxisNotices).toEqual([{ code: 'DRINKING_EXCLUDED_BY_POLICY' }]);
    expect(compatibility.axes.find((axis) => axis.id === 'WAKE_TIME')).toMatchObject({
      score: null,
      bucket: 'UNKNOWN',
      comparison: { targetText: '수업에 따라 유동적', viewerText: '7~8시' },
    });
    expect(compatibility.axes.find((axis) => axis.id === 'SMOKING')).toMatchObject({
      comparison: { targetText: '비흡연', viewerText: '비흡연자가 좋아요' },
    });
    expect(JSON.stringify(compatibility)).not.toContain('drinkingFrequency');
    expect(JSON.stringify(compatibility)).not.toContain('drinkingTolerance');
    expect(JSON.stringify(compatibility)).not.toContain('targetCondition');
    expect(JSON.stringify(compatibility)).not.toContain('smokingBehavior');
    expect(JSON.stringify(compatibility)).not.toContain('smokingTolerance');
  });

  it('공개 호환성 bucket은 항목별 71/50, 축별 70/50 경계를 사용한다', () => {
    const viewer = {
      ...COMPLETE_LIFESTYLE,
      bedtime: 'BEFORE_22',
      wakeTime: 'BEFORE_07',
    } as const;
    const dimensionMedium = buildPublicProfileCompatibility(viewer, {
      ...COMPLETE_LIFESTYLE,
      bedtime: '22_24',
      wakeTime: '07_08',
    });
    const dimensionHigh = buildPublicProfileCompatibility(viewer, {
      ...COMPLETE_LIFESTYLE,
      bedtime: '22_24',
      wakeTime: 'BEFORE_07',
    });

    expect(dimensionMedium.axes.find((axis) => axis.id === 'BEDTIME')).toMatchObject({
      score: 67,
      bucket: 'MEDIUM',
    });
    expect(dimensionMedium.axes.find((axis) => axis.id === 'WAKE_TIME')).toMatchObject({
      score: 75,
      bucket: 'HIGH',
    });
    expect(
      buildPublicProfileCompatibility(
        { ...COMPLETE_LIFESTYLE, phoneTolerance: 'ANY' },
        { ...COMPLETE_LIFESTYLE, phoneBehavior: 'OFTEN' },
      ).axes.find((axis) => axis.id === 'PHONE'),
    ).toMatchObject({
      score: 70,
      bucket: 'MEDIUM',
    });
    expect(
      buildPublicProfileCompatibility(
        { ...COMPLETE_LIFESTYLE, earphoneExpectation: 'MUST' },
        { ...COMPLETE_LIFESTYLE, earphoneUsage: 'MOSTLY' },
      ).axes.find((axis) => axis.id === 'EARPHONE'),
    ).toMatchObject({
      score: 70,
      bucket: 'MEDIUM',
    });
    expect(
      dimensionMedium.dimensions.find((dimension) => dimension.id === 'SLEEP_RHYTHM'),
    ).toMatchObject({
      score: 69,
      bucket: 'MEDIUM',
    });
    expect(
      dimensionHigh.dimensions.find((dimension) => dimension.id === 'SLEEP_RHYTHM'),
    ).toMatchObject({
      score: 78,
      bucket: 'HIGH',
    });
  });

  it('코골이는 보통 잠귀 20점, 둔한 잠귀 60점으로 계산한다', () => {
    const normalNoiseCompatibility = buildPublicProfileCompatibility(
      { ...COMPLETE_LIFESTYLE, noiseSensitivity: 'NORMAL' },
      { ...COMPLETE_LIFESTYLE, sleepHabit: 'SNORING' },
    );
    const deepNoiseCompatibility = buildPublicProfileCompatibility(
      { ...COMPLETE_LIFESTYLE, noiseSensitivity: 'DEEP' },
      { ...COMPLETE_LIFESTYLE, sleepHabit: 'SNORING' },
    );

    expect(normalNoiseCompatibility.axes.find((axis) => axis.id === 'SLEEP_HABIT')).toMatchObject({
      score: 20,
      bucket: 'LOW',
    });
    expect(deepNoiseCompatibility.axes.find((axis) => axis.id === 'SLEEP_HABIT')).toMatchObject({
      score: 60,
      bucket: 'MEDIUM',
    });
  });

  it('실내 취식 허용 기준은 취침 시 화면 밝기와 같은 3단계 matrix를 사용한다', () => {
    const axisScore = (
      axisId: 'SCREEN_USAGE' | 'INDOOR_EATING',
      viewerOverrides: Partial<LifestyleData>,
      targetOverrides: Partial<LifestyleData>,
    ) =>
      buildPublicProfileCompatibility(
        { ...COMPLETE_LIFESTYLE, ...viewerOverrides },
        { ...COMPLETE_LIFESTYLE, ...targetOverrides },
      ).axes.find((axis) => axis.id === axisId)?.score;

    expect(
      axisScore('SCREEN_USAGE', { screenTolerance: 'NO_SCREEN' }, { screenUsage: 'NONE' }),
    ).toBe(100);
    expect(
      axisScore('INDOOR_EATING', { indoorEatingTolerance: 'NO_SMELL' }, { indoorEating: 'RARELY' }),
    ).toBe(100);
    expect(
      axisScore('SCREEN_USAGE', { screenTolerance: 'NO_SCREEN' }, { screenUsage: 'AUDIO' }),
    ).toBe(100);
    expect(
      axisScore('INDOOR_EATING', { indoorEatingTolerance: 'NO_SMELL' }, { indoorEating: 'SNACK' }),
    ).toBe(100);
    expect(
      axisScore('SCREEN_USAGE', { screenTolerance: 'NO_SCREEN' }, { screenUsage: 'SCREEN' }),
    ).toBe(0);
    expect(
      axisScore('INDOOR_EATING', { indoorEatingTolerance: 'NO_SMELL' }, { indoorEating: 'MEAL' }),
    ).toBe(0);

    expect(
      axisScore('SCREEN_USAGE', { screenTolerance: 'LOW_OK' }, { screenUsage: 'SCREEN' }),
    ).toBe(50);
    expect(
      axisScore('INDOOR_EATING', { indoorEatingTolerance: 'CLEAN_OK' }, { indoorEating: 'MEAL' }),
    ).toBe(50);

    expect(
      axisScore('SCREEN_USAGE', { screenTolerance: 'SCREEN_OK' }, { screenUsage: 'SCREEN' }),
    ).toBe(100);
    expect(
      axisScore('INDOOR_EATING', { indoorEatingTolerance: 'ANY' }, { indoorEating: 'MEAL' }),
    ).toBe(100);
  });

  it('viewer 또는 target 시즌 프로필이 incomplete면 score를 생성하지 않는다', () => {
    expect(
      calcViewerMatchScore(
        {
          ...COMPLETE_LIFESTYLE,
          phoneTolerance: null,
        },
        COMPLETE_LIFESTYLE,
      ),
    ).toBeNull();

    expect(
      calcViewerMatchScore(COMPLETE_LIFESTYLE, {
        ...COMPLETE_LIFESTYLE,
        screenUsage: null,
      }),
    ).toBeNull();
  });
});
