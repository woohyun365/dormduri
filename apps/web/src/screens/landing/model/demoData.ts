import type { LifestyleData, LifestyleDisplayField } from '@repo/shared/lifestyle';
import type { PublicProfileCompatibilityAxisId } from '@repo/shared/profile';

// Example data: the example visitor the community post fills in, and the comparison pairs the
// statement's answer sheets lay together. Everyone here is an example, not a real user.

export type ViewerField =
  'bedtime' | 'wakeTime' | 'noiseSensitivity' | 'phoneTolerance' | 'cleanExpectation';
export type ViewerAnswers = Pick<LifestyleData, ViewerField>;

// "나": a fixed example visitor.
export const exampleViewer: ViewerAnswers = {
  bedtime: '24_02',
  wakeTime: '08_09',
  noiseSensitivity: 'SENSITIVE',
  phoneTolerance: 'BRIEF_OK',
  cleanExpectation: 'BASIC',
};

export interface ComparePair {
  readonly axis: PublicProfileCompatibilityAxisId;
  /** My answer (the viewer side). */
  readonly mine: LifestyleDisplayField;
  /** The other person's answer (the target side). */
  readonly theirs: LifestyleDisplayField;
}

// The app's public comparison pairs (packages/shared profile compatibility-scoring, the displayFields
// of each public axis), in survey order: my answer against the other person's. 내 잠귀 meets 상대 잠버릇,
// my smoking condition 상대 흡연 여부, 취침 시간 meets 취침 시간. Drinking is scored but never shown
// (DRINKING_EXCLUDED_BY_POLICY), so it has no pair here. comparePairs.test.ts holds this to shared.
export const comparePairs: readonly ComparePair[] = [
  { axis: 'BEDTIME', mine: 'bedtime', theirs: 'bedtime' },
  { axis: 'WAKE_TIME', mine: 'wakeTime', theirs: 'wakeTime' },
  { axis: 'SLEEP_HABIT', mine: 'noiseSensitivity', theirs: 'sleepHabit' },
  { axis: 'SLEEP_ENVIRONMENT', mine: 'sleepEnvPreference', theirs: 'sleepEnvironment' },
  { axis: 'SCREEN_USAGE', mine: 'screenTolerance', theirs: 'screenUsage' },
  { axis: 'SMOKING', mine: 'smokingTolerance', theirs: 'smokingBehavior' },
  { axis: 'INDOOR_EATING', mine: 'indoorEatingTolerance', theirs: 'indoorEating' },
  { axis: 'PHONE', mine: 'phoneTolerance', theirs: 'phoneBehavior' },
  { axis: 'EARPHONE', mine: 'earphoneExpectation', theirs: 'earphoneUsage' },
  { axis: 'CLEAN_LEVEL', mine: 'cleanExpectation', theirs: 'cleanLevel' },
  { axis: 'RELATIONSHIP', mine: 'relationshipStyle', theirs: 'relationshipStyle' },
  { axis: 'TEMPERATURE', mine: 'temperatureSensitivity', theirs: 'temperatureSensitivity' },
];
