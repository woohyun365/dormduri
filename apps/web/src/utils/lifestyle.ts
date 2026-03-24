import type { LifestyleData } from '@/types/lifestyle';
import { CONDITION_FIELDS, SLEEP_FIELDS, LIVING_FIELDS } from '@/constants/lifestyle';

/** 룸메 조건 8개 전부 non-null → true (UI 게이팅 기준) */
export function isConditionComplete(lifestyle: LifestyleData): boolean {
  return CONDITION_FIELDS.every((field) => lifestyle[field] !== null);
}

/** 필수 15필드 non-null → true (수면 6 + 생활 8 + drinkingTolerance) */
export function isLifestyleRequiredComplete(lifestyle: LifestyleData): boolean {
  const requiredFields: (keyof LifestyleData)[] = [
    ...SLEEP_FIELDS,
    ...LIVING_FIELDS,
    'drinkingTolerance',
  ];
  return requiredFields.every((field) => lifestyle[field] !== null);
}
