import type { LifestyleData } from '@repo/shared/lifestyle';
import type {
  PublicProfileCompatibility,
  PublicProfileCompatibilityAxisId,
  PublicProfileCompatibilityBucket,
  PublicProfileCompatibilityHiddenNoticeCode,
} from '@repo/shared/profile/contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';

const BEDTIME_ORDER = ['BEFORE_22', '22_24', '24_02', 'AFTER_02'] as const;
const WAKE_ORDER = ['BEFORE_07', '07_08', '08_09', '09_10', 'AFTER_10'] as const;
const TEMPERATURE_ORDER = ['COLD', 'NORMAL', 'HOT'] as const;

const T1 = 5;
const T2 = 3;
const T3 = 2;
const T4 = 1;

const SMOKING_MATRIX: Record<string, Record<string, number>> = {
  NO: { NO_ONLY: 1.0, E_CIG_OK: 1.0, ANY: 1.0 },
  E_CIG: { NO_ONLY: 0.0, E_CIG_OK: 1.0, ANY: 1.0 },
  YES: { NO_ONLY: 0.0, E_CIG_OK: 0.0, ANY: 1.0 },
};

const DRINKING_MATRIX: Record<string, Record<string, number>> = {
  NONE: { LOW_ONLY: 1.0, ANY: 1.0 },
  RARELY: { LOW_ONLY: 0.67, ANY: 1.0 },
  SOMETIMES: { LOW_ONLY: 0.33, ANY: 1.0 },
  OFTEN: { LOW_ONLY: 0.0, ANY: 1.0 },
};

const SLEEP_HABIT_MATRIX: Record<string, Record<string, number>> = {
  NONE: { SENSITIVE: 1.0, NORMAL: 1.0, DEEP: 1.0 },
  TALKING: { SENSITIVE: 0.3, NORMAL: 0.8, DEEP: 1.0 },
  SNORING: { SENSITIVE: 0.0, NORMAL: 0.3, DEEP: 0.8 },
  GRINDING: { SENSITIVE: 0.0, NORMAL: 0.5, DEEP: 1.0 },
};

const PHONE_MATRIX: Record<string, Record<string, number>> = {
  RARELY: { OUTSIDE_ONLY: 1.0, BRIEF_OK: 1.0, ANY: 1.0 },
  SOMETIMES: { OUTSIDE_ONLY: 0.0, BRIEF_OK: 1.0, ANY: 1.0 },
  OFTEN: { OUTSIDE_ONLY: 0.0, BRIEF_OK: 0.3, ANY: 0.7 },
};

const EARPHONE_MATRIX: Record<string, Record<string, number>> = {
  ALWAYS: { MUST: 1.0, STUDY: 1.0, ANY: 1.0 },
  MOSTLY: { MUST: 0.7, STUDY: 1.0, ANY: 1.0 },
  MOSTLY_SPEAKER: { MUST: 0.0, STUDY: 0.7, ANY: 1.0 },
  ALWAYS_SPEAKER: { MUST: 0.0, STUDY: 0.3, ANY: 1.0 },
};

const SLEEP_ENV_MATRIX: Record<string, Record<string, number>> = {
  QUIET: { NO_SPEAKER: 1.0, SPEAKER_OK: 1.0 },
  EARPHONE: { NO_SPEAKER: 1.0, SPEAKER_OK: 1.0 },
  LOW_SPEAKER: { NO_SPEAKER: 0.0, SPEAKER_OK: 1.0 },
};

const SCREEN_USAGE_MATRIX: Record<string, Record<string, number>> = {
  NONE: { NO_SCREEN: 1.0, LOW_OK: 1.0, SCREEN_OK: 1.0 },
  AUDIO: { NO_SCREEN: 1.0, LOW_OK: 1.0, SCREEN_OK: 1.0 },
  SCREEN: { NO_SCREEN: 0.0, LOW_OK: 0.5, SCREEN_OK: 1.0 },
};

const CLEAN_MATRIX: Record<string, Record<string, number>> = {
  WEEKLY_3_UP: { STRICT: 1.0, BASIC: 1.0, FLEXIBLE: 1.0 },
  WEEKLY_1_2: { STRICT: 0.3, BASIC: 1.0, FLEXIBLE: 1.0 },
  WHEN_DIRTY: { STRICT: 0.0, BASIC: 0.3, FLEXIBLE: 1.0 },
};

const INDOOR_EATING_MATRIX: Record<string, Record<string, number>> = {
  RARELY: { NO_SMELL: 1.0, CLEAN_OK: 1.0, ANY: 1.0 },
  SNACK: { NO_SMELL: 1.0, CLEAN_OK: 1.0, ANY: 1.0 },
  MEAL: { NO_SMELL: 0.0, CLEAN_OK: 0.5, ANY: 1.0 },
};

interface PairResult {
  score: number;
  weight: number;
}

interface CompatibilityPairDefinition {
  result: PairResult | null;
  publicAxisId?: PublicProfileCompatibilityAxisId;
  hiddenNoticeCode?: PublicProfileCompatibilityHiddenNoticeCode;
}

function indexDistance(order: readonly string[], a: string, b: string): number {
  const ia = order.indexOf(a);
  const ib = order.indexOf(b);
  if (ia === -1 || ib === -1) return -1;
  return Math.abs(ia - ib);
}

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

function scoreMatchPair(a: string | null, b: string | null, weight: number): PairResult | null {
  if (a === null || b === null) return null;
  return { score: a === b ? 1.0 : 0.0, weight };
}

function scoreWakeTimePair(a: string | null, b: string | null): PairResult | null {
  if (a === null || b === null) return null;
  if (a === 'FLEXIBLE' || b === 'FLEXIBLE') return null;
  const dist = indexDistance(WAKE_ORDER, a, b);
  if (dist === -1) return null;
  return { score: 1.0 - dist / 4, weight: T4 };
}

function buildCompatibilityPairDefinitions(
  evaluator: LifestyleData,
  target: LifestyleData,
): CompatibilityPairDefinition[] {
  return [
    {
      publicAxisId: 'SMOKING',
      result: scoreCrossPair(
        evaluator.smokingTolerance,
        target.smokingBehavior,
        SMOKING_MATRIX,
        T1,
      ),
    },
    {
      hiddenNoticeCode: 'DRINKING_EXCLUDED_BY_POLICY',
      result: scoreCrossPair(
        evaluator.drinkingTolerance,
        target.drinkingFrequency,
        DRINKING_MATRIX,
        T3,
      ),
    },
    {
      publicAxisId: 'SLEEP_HABIT',
      result: scoreCrossPair(evaluator.noiseSensitivity, target.sleepHabit, SLEEP_HABIT_MATRIX, T1),
    },
    {
      publicAxisId: 'PHONE',
      result: scoreCrossPair(evaluator.phoneTolerance, target.phoneBehavior, PHONE_MATRIX, T2),
    },
    {
      publicAxisId: 'EARPHONE',
      result: scoreCrossPair(
        evaluator.earphoneExpectation,
        target.earphoneUsage,
        EARPHONE_MATRIX,
        T2,
      ),
    },
    {
      publicAxisId: 'SLEEP_ENVIRONMENT',
      result: scoreCrossPair(
        evaluator.sleepEnvPreference,
        target.sleepEnvironment,
        SLEEP_ENV_MATRIX,
        T2,
      ),
    },
    {
      publicAxisId: 'SCREEN_USAGE',
      result: scoreCrossPair(
        evaluator.screenTolerance,
        target.screenUsage,
        SCREEN_USAGE_MATRIX,
        T2,
      ),
    },
    {
      publicAxisId: 'CLEAN_LEVEL',
      result: scoreCrossPair(evaluator.cleanExpectation, target.cleanLevel, CLEAN_MATRIX, T3),
    },
    {
      publicAxisId: 'INDOOR_EATING',
      result: scoreCrossPair(
        evaluator.indoorEatingTolerance,
        target.indoorEating,
        INDOOR_EATING_MATRIX,
        T3,
      ),
    },
    {
      publicAxisId: 'BEDTIME',
      result: scoreDistancePair(evaluator.bedtime, target.bedtime, BEDTIME_ORDER, 3, T3),
    },
    {
      publicAxisId: 'WAKE_TIME',
      result: scoreWakeTimePair(evaluator.wakeTime, target.wakeTime),
    },
    {
      publicAxisId: 'TEMPERATURE',
      result: scoreDistancePair(
        evaluator.temperatureSensitivity,
        target.temperatureSensitivity,
        TEMPERATURE_ORDER,
        2,
        T2,
      ),
    },
    {
      publicAxisId: 'RELATIONSHIP',
      result: scoreMatchPair(evaluator.relationshipStyle, target.relationshipStyle, T4),
    },
  ];
}

function calculateWeightedScore(definitions: readonly CompatibilityPairDefinition[]): number {
  let weightedSum = 0;
  let dynamicMax = 0;

  for (const definition of definitions) {
    if (!definition.result) continue;
    weightedSum += definition.result.score * definition.result.weight;
    dynamicMax += definition.result.weight;
  }

  if (dynamicMax === 0) return 100;
  return Math.round((weightedSum / dynamicMax) * 100);
}

function toCompatibilityAxisScore(result: PairResult | null): number | null {
  return result ? Math.round(result.score * 100) : null;
}

function toCompatibilityBucket(score: number | null): PublicProfileCompatibilityBucket {
  if (score === null) return 'UNKNOWN';
  if (score >= 80) return 'HIGH';
  if (score >= 50) return 'MEDIUM';
  return 'LOW';
}

export function perspectiveMatchScore(evaluator: LifestyleData, target: LifestyleData): number {
  return calculateWeightedScore(buildCompatibilityPairDefinitions(evaluator, target));
}

export function buildPublicProfileCompatibility(
  viewerLifestyle: LifestyleData,
  targetLifestyle: LifestyleData,
): PublicProfileCompatibility {
  const definitions = buildCompatibilityPairDefinitions(viewerLifestyle, targetLifestyle);
  const hiddenNoticeCodes = new Set<PublicProfileCompatibilityHiddenNoticeCode>();

  for (const definition of definitions) {
    if (definition.hiddenNoticeCode) {
      hiddenNoticeCodes.add(definition.hiddenNoticeCode);
    }
  }

  return {
    overallScore: calculateWeightedScore(definitions),
    axes: definitions
      .filter(
        (
          definition,
        ): definition is CompatibilityPairDefinition & {
          publicAxisId: PublicProfileCompatibilityAxisId;
        } => Boolean(definition.publicAxisId),
      )
      .map((definition) => {
        const score = toCompatibilityAxisScore(definition.result);
        return {
          id: definition.publicAxisId,
          score,
          bucket: toCompatibilityBucket(score),
        };
      }),
    hiddenAxisNotices: Array.from(hiddenNoticeCodes, (code) => ({ code })),
  };
}

export function canComputeMatchScore(
  viewerLifestyle: LifestyleData,
  targetLifestyle: LifestyleData,
): boolean {
  return isSeasonProfileComplete(viewerLifestyle) && isSeasonProfileComplete(targetLifestyle);
}

export function calcViewerMatchScore(
  viewerLifestyle: LifestyleData,
  targetLifestyle: LifestyleData,
): number | null {
  if (!canComputeMatchScore(viewerLifestyle, targetLifestyle)) {
    return null;
  }

  return perspectiveMatchScore(viewerLifestyle, targetLifestyle);
}
