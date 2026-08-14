import type { LifestyleData } from '@repo/shared/lifestyle';
import type { SeasonProfileDraftRequest } from '@repo/shared/season/participation';
import { toCompleteLifestyleColumnData as mapCompleteLifestyleColumnData } from '../../../../src/season-participants/lifestyle/lifestyle-persistence.mapper.js';

export const DEFAULT_LIFESTYLE = {
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
  phoneTolerance: 'BRIEF_OK',
  earphoneExpectation: 'MUST',
  sleepEnvPreference: 'NO_SPEAKER',
  screenTolerance: 'LOW_OK',
  indoorEatingTolerance: 'NO_SMELL',
  cleanExpectation: 'STRICT',
  drinkingTolerance: 'LOW_ONLY',
} as const;

export function toCompleteLifestyleColumnData(lifestyle: LifestyleData = DEFAULT_LIFESTYLE) {
  return mapCompleteLifestyleColumnData(lifestyle);
}

export function buildCompleteSeasonProfileDraft(
  intro = '완성된 시즌 프로필',
): SeasonProfileDraftRequest {
  return {
    lifestyle: DEFAULT_LIFESTYLE,
    intro,
    additional: {
      grade: '3',
      mbti: 'INTJ',
    },
  };
}

export function buildIncompleteSeasonProfileDraft(
  intro = '미완성 시즌 프로필',
): SeasonProfileDraftRequest {
  return {
    ...buildCompleteSeasonProfileDraft(intro),
    lifestyle: {
      ...DEFAULT_LIFESTYLE,
      drinkingTolerance: null,
    },
  };
}
