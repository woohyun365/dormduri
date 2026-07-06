import { describe, expect, it } from 'vitest';
import {
  buildDirectionalMatchScoreProjection,
  buildPublicProfileCompatibility,
  shouldExposePublicMatchScore,
} from './match-score-projection.js';

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

describe('match-score-projection', () => {
  it('viewer/target 시즌 프로필이 complete면 directional score를 반환한다', () => {
    const result = buildDirectionalMatchScoreProjection(COMPLETE_LIFESTYLE, COMPLETE_LIFESTYLE);

    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });

  it('viewer 또는 target 시즌 프로필이 incomplete면 score를 만들지 않는다', () => {
    expect(
      buildDirectionalMatchScoreProjection(COMPLETE_LIFESTYLE, {
        ...COMPLETE_LIFESTYLE,
        smokingBehavior: null,
      }),
    ).toBeNull();

    expect(
      buildDirectionalMatchScoreProjection(
        {
          ...COMPLETE_LIFESTYLE,
          smokingTolerance: null,
        },
        COMPLETE_LIFESTYLE,
      ),
    ).toBeNull();
  });

  it('scoreVisible=true일 때 public compatibility를 생성하고 false면 닫는다', () => {
    const compatibility = buildPublicProfileCompatibility({
      viewerLifestyle: COMPLETE_LIFESTYLE,
      targetLifestyle: COMPLETE_LIFESTYLE,
      scoreVisible: true,
    });

    expect(compatibility).toMatchObject({
      overallScore: buildDirectionalMatchScoreProjection(COMPLETE_LIFESTYLE, COMPLETE_LIFESTYLE),
      hiddenAxisNotices: [{ code: 'DRINKING_EXCLUDED_BY_POLICY' }],
    });
    expect(compatibility?.axes.map((axis) => axis.id)).not.toContain('DRINKING');

    expect(
      buildPublicProfileCompatibility({
        viewerLifestyle: COMPLETE_LIFESTYLE,
        targetLifestyle: COMPLETE_LIFESTYLE,
        scoreVisible: false,
      }),
    ).toBeNull();
  });

  it('SEASON_POST_MATCH에서는 score-visible matched partner에게만 점수를 노출한다', () => {
    expect(
      shouldExposePublicMatchScore({
        seasonState: 'SEASON_POST_MATCH',
        scoreVisible: true,
        resultReadContext: 'CURRENT_MATCHED_PARTNER',
      }),
    ).toBe(true);

    expect(
      shouldExposePublicMatchScore({
        seasonState: 'SEASON_POST_MATCH',
        scoreVisible: true,
        resultReadContext: 'NONE',
      }),
    ).toBe(false);
  });

  it('OFF_SEASON과 scoreVisible=false surface에는 점수를 노출하지 않는다', () => {
    expect(
      shouldExposePublicMatchScore({
        seasonState: 'OFF_SEASON',
        scoreVisible: true,
        resultReadContext: 'CURRENT_MATCHED_PARTNER',
      }),
    ).toBe(false);

    expect(
      shouldExposePublicMatchScore({
        seasonState: 'SEASON_MATCHING',
        scoreVisible: false,
        resultReadContext: 'NONE',
      }),
    ).toBe(false);
  });
});
