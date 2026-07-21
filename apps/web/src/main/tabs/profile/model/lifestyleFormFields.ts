import {
  CORE_LIFESTYLE_FIELDS,
  LIFESTYLE_FIELD_OPTIONS,
  ROOMMATE_CONDITION_FIELDS,
  formatLifestyleFieldName,
  formatLifestyleOptionLabel,
  type LifestyleData,
} from '@repo/shared/lifestyle';

export const SLEEP_LIFESTYLE_FIELDS = [
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'screenUsage',
  'noiseSensitivity',
] as const satisfies readonly (keyof LifestyleData)[];

export const LIVING_LIFESTYLE_FIELDS = CORE_LIFESTYLE_FIELDS.filter(
  (field) => !SLEEP_LIFESTYLE_FIELDS.includes(field as (typeof SLEEP_LIFESTYLE_FIELDS)[number]),
);

export const CONDITION_LIFESTYLE_FIELDS = ROOMMATE_CONDITION_FIELDS;

export const BEDTIME_ORDER = LIFESTYLE_FIELD_OPTIONS.bedtime;
export const WAKE_TIME_ORDER = LIFESTYLE_FIELD_OPTIONS.wakeTime.filter(
  (value) => value !== 'FLEXIBLE',
);
export const TEMPERATURE_SENSITIVITY_ORDER = LIFESTYLE_FIELD_OPTIONS.temperatureSensitivity;

export function getLifestyleFormOptions(field: keyof LifestyleData) {
  return LIFESTYLE_FIELD_OPTIONS[field].map((value) => ({
    value,
    label: formatLifestyleOptionLabel(field, value),
  }));
}

export { formatLifestyleFieldName, formatLifestyleOptionLabel };
