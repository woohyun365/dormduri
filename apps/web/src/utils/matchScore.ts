import type { LifestyleData } from '@/types/lifestyle';
import { BEDTIME_ORDER, WAKE_ORDER, TEMPERATURE_ORDER } from '@/constants/lifestyle';

// === 가중치 티어 ===

const T1 = 5;
const T2 = 3;
const T3 = 2;
const T4 = 1;

// === TYPE A: Threshold (임계값) 행렬 ===

// Pair 1: smokingBehavior × smokingTolerance (T1)
const SMOKING_MATRIX: Record<string, Record<string, number>> = {
  NO: { NO_ONLY: 1.0, E_CIG_OK: 1.0, ANY: 1.0 },
  E_CIG: { NO_ONLY: 0.0, E_CIG_OK: 1.0, ANY: 1.0 },
  YES: { NO_ONLY: 0.0, E_CIG_OK: 0.0, ANY: 1.0 },
};

// Pair 2: drinkingFrequency × drinkingTolerance (T3)
const DRINKING_MATRIX: Record<string, Record<string, number>> = {
  NONE: { NONE_ONLY: 1.0, SOMETIMES_OK: 1.0, ANY: 1.0 },
  SOMETIMES: { NONE_ONLY: 0.0, SOMETIMES_OK: 1.0, ANY: 1.0 },
  OFTEN: { NONE_ONLY: 0.0, SOMETIMES_OK: 0.0, ANY: 1.0 },
};

// === TYPE B: Matrix (행렬) ===

// Pair 3: sleepHabit × noiseSensitivity (T1)
const SLEEP_HABIT_MATRIX: Record<string, Record<string, number>> = {
  NONE: { SENSITIVE: 1.0, NORMAL: 1.0, DEEP: 1.0 },
  TALKING: { SENSITIVE: 0.3, NORMAL: 0.8, DEEP: 1.0 },
  SNORING: { SENSITIVE: 0.0, NORMAL: 0.3, DEEP: 0.8 },
  GRINDING: { SENSITIVE: 0.0, NORMAL: 0.5, DEEP: 1.0 },
};

// Pair 4: phoneBehavior × phoneTolerance (T2)
const PHONE_MATRIX: Record<string, Record<string, number>> = {
  OUTSIDE: { OUTSIDE_ONLY: 1.0, BRIEF_OK: 1.0, ANY: 1.0 },
  BRIEF: { OUTSIDE_ONLY: 0.3, BRIEF_OK: 1.0, ANY: 1.0 },
  FREE: { OUTSIDE_ONLY: 0.0, BRIEF_OK: 0.3, ANY: 1.0 },
};

// Pair 5: earphoneUsage × earphoneExpectation (T2)
const EARPHONE_MATRIX: Record<string, Record<string, number>> = {
  ALWAYS: { MUST: 1.0, STUDY: 1.0, ANY: 1.0 },
  STUDY: { MUST: 0.5, STUDY: 1.0, ANY: 1.0 },
  QUIET: { MUST: 0.0, STUDY: 0.3, ANY: 1.0 },
  FREE: { MUST: 0.0, STUDY: 0.0, ANY: 1.0 },
};

// Pair 6: sleepEnvironment × sleepEnvPreference (T2) — 소리 축
const SLEEP_ENV_MATRIX: Record<string, Record<string, number>> = {
  QUIET: { NO_SPEAKER: 1.0, SPEAKER_OK: 1.0 },
  EARPHONE: { NO_SPEAKER: 1.0, SPEAKER_OK: 1.0 },
  LOW_SPEAKER: { NO_SPEAKER: 0.0, SPEAKER_OK: 1.0 },
};

// Pair 6b: screenUsage × screenTolerance (T2) — 빛 축
const SCREEN_USAGE_MATRIX: Record<string, Record<string, number>> = {
  NONE: { NO_SCREEN: 1.0, SCREEN_OK: 1.0 },
  AUDIO: { NO_SCREEN: 1.0, SCREEN_OK: 1.0 },
  SCREEN: { NO_SCREEN: 0.0, SCREEN_OK: 1.0 },
};

// Pair 7: cleanLevel × cleanExpectation (T3)
const CLEAN_MATRIX: Record<string, Record<string, number>> = {
  WEEKLY_3_UP: { STRICT: 1.0, BASIC: 1.0, FLEXIBLE: 1.0 },
  WEEKLY_1_2: { STRICT: 0.3, BASIC: 1.0, FLEXIBLE: 1.0 },
  WHEN_DIRTY: { STRICT: 0.0, BASIC: 0.3, FLEXIBLE: 1.0 },
};

// === 유틸 ===

function indexDistance(order: readonly string[], a: string, b: string): number {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return -1;
  return Math.abs(ia - ib);
}

// === 쌍 정의 ===

interface PairResult {
  score: number; // 0.0 ~ 1.0
  weight: number;
}

/** 교차 비교 쌍 (Pair 1-7): evaluator 조건 필드 × target 행동 필드 */
function scoreCrossPair(
  evaluatorField: string | null,
  targetField: string | null,
  matrix: Record<string, Record<string, number>>,
  weight: number,
): PairResult | null {
  if (evaluatorField === null || targetField === null) return null;
  const row = matrix[targetField];
  if (!row) return null;
  const score = row[evaluatorField];
  if (score === undefined) return null;
  return { score, weight };
}

/** 유사도 쌍 (Pair 8-10): 순서 배열 기반 거리 */
function scoreDistancePair(
  a: string | null,
  b: string | null,
  order: readonly string[],
  maxDist: number,
  weight: number,
): PairResult | null {
  if (a === null || b === null) return null;
  const dist = indexDistance(order, a, b);
  if (dist === -1) return null;
  return { score: 1.0 - dist / maxDist, weight };
}

/** 일치 쌍 (Pair 11-12) */
function scoreMatchPair(a: string | null, b: string | null, weight: number): PairResult | null {
  if (a === null || b === null) return null;
  return { score: a === b ? 1.0 : 0.0, weight };
}

// === perspectiveScore: evaluator 관점에서 target 평가 ===

function perspectiveScore(evaluator: LifestyleData, target: LifestyleData): number {
  const pairs: (PairResult | null)[] = [
    // Pair 1: smokingTolerance(evaluator) × smokingBehavior(target) - T1
    scoreCrossPair(evaluator.smokingTolerance, target.smokingBehavior, SMOKING_MATRIX, T1),
    // Pair 2: drinkingTolerance(evaluator) × drinkingFrequency(target) - T3
    scoreCrossPair(evaluator.drinkingTolerance, target.drinkingFrequency, DRINKING_MATRIX, T3),
    // Pair 3: noiseSensitivity(evaluator) × sleepHabit(target) - T1
    scoreCrossPair(evaluator.noiseSensitivity, target.sleepHabit, SLEEP_HABIT_MATRIX, T1),
    // Pair 4: phoneTolerance(evaluator) × phoneBehavior(target) - T2
    scoreCrossPair(evaluator.phoneTolerance, target.phoneBehavior, PHONE_MATRIX, T2),
    // Pair 5: earphoneExpectation(evaluator) × earphoneUsage(target) - T2
    scoreCrossPair(evaluator.earphoneExpectation, target.earphoneUsage, EARPHONE_MATRIX, T2),
    // Pair 6: sleepEnvPreference(evaluator) × sleepEnvironment(target) - T2 (소리)
    scoreCrossPair(evaluator.sleepEnvPreference, target.sleepEnvironment, SLEEP_ENV_MATRIX, T2),
    // Pair 6b: screenTolerance(evaluator) × screenUsage(target) - T2 (빛)
    scoreCrossPair(evaluator.screenTolerance, target.screenUsage, SCREEN_USAGE_MATRIX, T2),
    // Pair 7: cleanExpectation(evaluator) × cleanLevel(target) - T3
    scoreCrossPair(evaluator.cleanExpectation, target.cleanLevel, CLEAN_MATRIX, T3),
    // Pair 8: bedtime (유사도) - T3
    scoreDistancePair(evaluator.bedtime, target.bedtime, BEDTIME_ORDER, 3, T3),
    // Pair 9: wakeTime (유사도, FLEXIBLE 제외) - T4
    scoreWakeTimePair(evaluator.wakeTime, target.wakeTime),
    // Pair 10: temperatureSensitivity (유사도) - T2
    scoreDistancePair(
      evaluator.temperatureSensitivity,
      target.temperatureSensitivity,
      TEMPERATURE_ORDER,
      2,
      T2,
    ),
    // Pair 11: indoorEating (일치) - T4
    scoreMatchPair(evaluator.indoorEating, target.indoorEating, T4),
    // Pair 12: relationshipStyle (일치) - T4
    scoreMatchPair(evaluator.relationshipStyle, target.relationshipStyle, T4),
  ];

  let weightedSum = 0;
  let dynamicMax = 0;

  for (const pair of pairs) {
    if (pair === null) continue;
    weightedSum += pair.score * pair.weight;
    dynamicMax += pair.weight;
  }

  if (dynamicMax === 0) return 100;

  return Math.round((weightedSum / dynamicMax) * 100);
}

/** Pair 9: wakeTime (T4=1). FLEXIBLE이면 쌍 제외 */
function scoreWakeTimePair(a: string | null, b: string | null): PairResult | null {
  if (a === null || b === null) return null;
  if (a === 'FLEXIBLE' || b === 'FLEXIBLE') return null;
  const dist = indexDistance(WAKE_ORDER, a, b);
  if (dist === -1) return null;
  return { score: 1.0 - dist / 4, weight: T4 };
}

// === 메인 함수 ===

export function calcMatchScore(a: LifestyleData, b: LifestyleData): number {
  const aPerspective = perspectiveScore(a, b);
  const bPerspective = perspectiveScore(b, a);
  return Math.min(aPerspective, bPerspective);
}
