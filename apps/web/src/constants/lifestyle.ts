import type { LifestyleData } from '@/types/lifestyle';

export const LIFESTYLE_FIELD_NAMES: Record<keyof LifestyleData, string> = {
  smoker: '흡연 여부',
  sleepHabit: '잠버릇',
  indoorEating: '실내 취식',
  bedtime: '취침 시간',
  wakeTime: '기상 시간',
  noiseSensitivity: '소음 민감도',
  cleanliness: '청결도',
  relationshipStyle: '관계 성향',
};

export const LIFESTYLE_LABELS: Record<keyof LifestyleData, Record<string, string>> = {
  smoker: { NO: '비흡연', YES: '흡연' },
  sleepHabit: { NONE: '없음', TALKING: '잠꼬대', SNORING: '코골이', GRINDING: '이갈이' },
  indoorEating: { NO: '싫어요', OK: '상관없어요', VENTILATE: '환기하면 OK' },
  bedtime: {
    BEFORE_22: '22시 이전',
    '22_24': '22~24시',
    '24_02': '24~02시',
    AFTER_02: '02시 이후',
  },
  wakeTime: { BEFORE_06: '6시 이전', '06_08': '6~8시', '08_10': '8~10시', AFTER_10: '10시 이후' },
  noiseSensitivity: { LOW: '둔감한 편', MID: '보통', HIGH: '민감한 편' },
  cleanliness: { LOW: '자유로운 편', MID: '보통', HIGH: '깔끔한 편' },
  relationshipStyle: { CLOSE: '친하게 지내요', CASUAL: '각자 생활' },
};

export function getLifestyleLabel(field: keyof LifestyleData, value: string | null): string {
  if (!value) return '미입력';
  return LIFESTYLE_LABELS[field][value] ?? '-';
}

// 정렬 순서 (matchScore 계산용) — satisfies로 LifestyleData 값과 타입 연결
export const BEDTIME_ORDER = [
  'BEFORE_22',
  '22_24',
  '24_02',
  'AFTER_02',
] as const satisfies readonly NonNullable<LifestyleData['bedtime']>[];
export const WAKE_ORDER = [
  'BEFORE_06',
  '06_08',
  '08_10',
  'AFTER_10',
] as const satisfies readonly NonNullable<LifestyleData['wakeTime']>[];
export const NOISE_ORDER = ['LOW', 'MID', 'HIGH'] as const satisfies readonly NonNullable<
  LifestyleData['noiseSensitivity']
>[];
export const CLEAN_ORDER = ['LOW', 'MID', 'HIGH'] as const satisfies readonly NonNullable<
  LifestyleData['cleanliness']
>[];
