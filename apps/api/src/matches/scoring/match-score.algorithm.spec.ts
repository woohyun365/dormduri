import { describe, expect, it } from 'vitest';
import { calcViewerMatchScore, canComputeMatchScore } from './match-score.algorithm.js';
import {
  isLifestyleCoreComplete,
  isRoommateConditionComplete,
  isSeasonProfileComplete,
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
