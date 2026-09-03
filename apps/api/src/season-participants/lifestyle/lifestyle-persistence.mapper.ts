import type { LifestyleData } from '@repo/shared/lifestyle';
import { lifestyleSchema } from '@repo/shared/lifestyle';

export const lifestyleFieldNames = [
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'screenUsage',
  'noiseSensitivity',
  'smokingBehavior',
  'indoorEating',
  'phoneBehavior',
  'earphoneUsage',
  'cleanLevel',
  'drinkingFrequency',
  'relationshipStyle',
  'temperatureSensitivity',
  'smokingTolerance',
  'phoneTolerance',
  'earphoneExpectation',
  'sleepEnvPreference',
  'screenTolerance',
  'indoorEatingTolerance',
  'cleanExpectation',
  'drinkingTolerance',
] as const satisfies readonly (keyof LifestyleData)[];

export const lifestyleColumnSelect = Object.fromEntries(
  lifestyleFieldNames.map((field) => [field, true]),
) as {
  [K in (typeof lifestyleFieldNames)[number]]: true;
};

export type LifestyleColumns = {
  [K in (typeof lifestyleFieldNames)[number]]: unknown;
};

export type StoredLifestyleBedtime =
  'BEFORE_22' | 'BETWEEN_22_24' | 'BETWEEN_24_02' | 'AFTER_02' | null;
export type StoredLifestyleWakeTime =
  | 'BEFORE_07'
  | 'BETWEEN_07_08'
  | 'BETWEEN_08_09'
  | 'BETWEEN_09_10'
  | 'AFTER_10'
  | 'FLEXIBLE'
  | null;

export interface StoredLifestyleColumns {
  bedtime: StoredLifestyleBedtime;
  wakeTime: StoredLifestyleWakeTime;
  sleepHabit: LifestyleData['sleepHabit'];
  sleepEnvironment: LifestyleData['sleepEnvironment'];
  screenUsage: LifestyleData['screenUsage'];
  noiseSensitivity: LifestyleData['noiseSensitivity'];
  smokingBehavior: LifestyleData['smokingBehavior'];
  indoorEating: LifestyleData['indoorEating'];
  phoneBehavior: LifestyleData['phoneBehavior'];
  earphoneUsage: LifestyleData['earphoneUsage'];
  cleanLevel: LifestyleData['cleanLevel'];
  drinkingFrequency: LifestyleData['drinkingFrequency'];
  relationshipStyle: LifestyleData['relationshipStyle'];
  temperatureSensitivity: LifestyleData['temperatureSensitivity'];
  smokingTolerance: LifestyleData['smokingTolerance'];
  phoneTolerance: LifestyleData['phoneTolerance'];
  earphoneExpectation: LifestyleData['earphoneExpectation'];
  sleepEnvPreference: LifestyleData['sleepEnvPreference'];
  screenTolerance: LifestyleData['screenTolerance'];
  indoorEatingTolerance: LifestyleData['indoorEatingTolerance'];
  cleanExpectation: LifestyleData['cleanExpectation'];
  drinkingTolerance: LifestyleData['drinkingTolerance'];
}

export type StoredCompleteLifestyleColumns = {
  [K in keyof StoredLifestyleColumns]: Exclude<StoredLifestyleColumns[K], null>;
};

export function toStoredBedtime(value: LifestyleData['bedtime']): StoredLifestyleBedtime {
  switch (value) {
    case '22_24':
      return 'BETWEEN_22_24';
    case '24_02':
      return 'BETWEEN_24_02';
    default:
      return value;
  }
}

function fromPrismaBedtime(value: unknown) {
  switch (value) {
    case 'BETWEEN_22_24':
      return '22_24';
    case 'BETWEEN_24_02':
      return '24_02';
    default:
      return value;
  }
}

export function toStoredWakeTime(value: LifestyleData['wakeTime']): StoredLifestyleWakeTime {
  switch (value) {
    case '07_08':
      return 'BETWEEN_07_08';
    case '08_09':
      return 'BETWEEN_08_09';
    case '09_10':
      return 'BETWEEN_09_10';
    default:
      return value;
  }
}

function fromPrismaWakeTime(value: unknown) {
  switch (value) {
    case 'BETWEEN_07_08':
      return '07_08';
    case 'BETWEEN_08_09':
      return '08_09';
    case 'BETWEEN_09_10':
      return '09_10';
    default:
      return value;
  }
}

export function pickLifestyleColumns(input: Record<string, unknown>): LifestyleData {
  return {
    bedtime: fromPrismaBedtime(input.bedtime) as LifestyleData['bedtime'],
    wakeTime: fromPrismaWakeTime(input.wakeTime) as LifestyleData['wakeTime'],
    sleepHabit: input.sleepHabit as LifestyleData['sleepHabit'],
    sleepEnvironment: input.sleepEnvironment as LifestyleData['sleepEnvironment'],
    screenUsage: input.screenUsage as LifestyleData['screenUsage'],
    noiseSensitivity: input.noiseSensitivity as LifestyleData['noiseSensitivity'],
    smokingBehavior: input.smokingBehavior as LifestyleData['smokingBehavior'],
    indoorEating: input.indoorEating as LifestyleData['indoorEating'],
    phoneBehavior: input.phoneBehavior as LifestyleData['phoneBehavior'],
    earphoneUsage: input.earphoneUsage as LifestyleData['earphoneUsage'],
    cleanLevel: input.cleanLevel as LifestyleData['cleanLevel'],
    drinkingFrequency: input.drinkingFrequency as LifestyleData['drinkingFrequency'],
    relationshipStyle: input.relationshipStyle as LifestyleData['relationshipStyle'],
    temperatureSensitivity: input.temperatureSensitivity as LifestyleData['temperatureSensitivity'],
    smokingTolerance: input.smokingTolerance as LifestyleData['smokingTolerance'],
    phoneTolerance: input.phoneTolerance as LifestyleData['phoneTolerance'],
    earphoneExpectation: input.earphoneExpectation as LifestyleData['earphoneExpectation'],
    sleepEnvPreference: input.sleepEnvPreference as LifestyleData['sleepEnvPreference'],
    screenTolerance: input.screenTolerance as LifestyleData['screenTolerance'],
    indoorEatingTolerance: input.indoorEatingTolerance as LifestyleData['indoorEatingTolerance'],
    cleanExpectation: input.cleanExpectation as LifestyleData['cleanExpectation'],
    drinkingTolerance: input.drinkingTolerance as LifestyleData['drinkingTolerance'],
  };
}

export function toStoredLifestyleFieldValue<K extends keyof LifestyleData>(
  field: K,
  value: LifestyleData[K],
) {
  if (field === 'bedtime') {
    return toStoredBedtime(value as LifestyleData['bedtime']);
  }
  if (field === 'wakeTime') {
    return toStoredWakeTime(value as LifestyleData['wakeTime']);
  }

  return value;
}

export function toLifestyleColumnData(lifestyle: LifestyleData): StoredLifestyleColumns {
  return {
    bedtime: toStoredBedtime(lifestyle.bedtime),
    wakeTime: toStoredWakeTime(lifestyle.wakeTime),
    sleepHabit: lifestyle.sleepHabit,
    sleepEnvironment: lifestyle.sleepEnvironment,
    screenUsage: lifestyle.screenUsage,
    noiseSensitivity: lifestyle.noiseSensitivity,
    smokingBehavior: lifestyle.smokingBehavior,
    indoorEating: lifestyle.indoorEating,
    phoneBehavior: lifestyle.phoneBehavior,
    earphoneUsage: lifestyle.earphoneUsage,
    cleanLevel: lifestyle.cleanLevel,
    drinkingFrequency: lifestyle.drinkingFrequency,
    relationshipStyle: lifestyle.relationshipStyle,
    temperatureSensitivity: lifestyle.temperatureSensitivity,
    smokingTolerance: lifestyle.smokingTolerance,
    phoneTolerance: lifestyle.phoneTolerance,
    earphoneExpectation: lifestyle.earphoneExpectation,
    sleepEnvPreference: lifestyle.sleepEnvPreference,
    screenTolerance: lifestyle.screenTolerance,
    indoorEatingTolerance: lifestyle.indoorEatingTolerance,
    cleanExpectation: lifestyle.cleanExpectation,
    drinkingTolerance: lifestyle.drinkingTolerance,
  };
}

export function toCompleteLifestyleColumnData(
  lifestyle: LifestyleData,
): StoredCompleteLifestyleColumns {
  const raw = toLifestyleColumnData(lifestyle);

  if (Object.values(raw).some((value) => value === null)) {
    throw new Error('[lifestyle.persistence] complete lifestyle is required');
  }

  return raw as StoredCompleteLifestyleColumns;
}

export function toLifestyleFromColumns(input: unknown): LifestyleData | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const parsed = lifestyleSchema.safeParse(pickLifestyleColumns(input as Record<string, unknown>));
  return parsed.success ? parsed.data : null;
}
