import type { LifestyleData } from '@/types/lifestyle';

// === 카테고리 분류 ===

export const SLEEP_FIELDS: (keyof LifestyleData)[] = [
  'bedtime',
  'wakeTime',
  'sleepHabit',
  'sleepEnvironment',
  'noiseSensitivity',
];

export const LIVING_FIELDS: (keyof LifestyleData)[] = [
  'smokingBehavior',
  'indoorEating',
  'phoneBehavior',
  'earphoneUsage',
  'cleanLevel',
  'drinkingFrequency',
  'relationshipStyle',
  'temperatureSensitivity',
];

export const CONDITION_FIELDS: (keyof LifestyleData)[] = [
  'smokingTolerance',
  'phoneTolerance',
  'earphoneExpectation',
  'sleepEnvPreference',
  'cleanExpectation',
  'drinkingTolerance',
];

// === 필드 이름 (19개) ===

export const LIFESTYLE_FIELD_NAMES: Record<keyof LifestyleData, string> = {
  // 수면 패턴
  bedtime: '취침 시간',
  wakeTime: '기상 시간',
  sleepHabit: '잠버릇',
  sleepEnvironment: '수면 환경',
  noiseSensitivity: '잠귀',

  // 생활 패턴
  smokingBehavior: '흡연 여부',
  indoorEating: '실내 취식',
  phoneBehavior: '방에서 통화·게임',
  earphoneUsage: '이어폰 사용',
  cleanLevel: '청소 빈도',
  drinkingFrequency: '음주 빈도',
  relationshipStyle: '관계 스타일',
  temperatureSensitivity: '온도 민감도',

  // 원하는 룸메 조건
  smokingTolerance: '상대 흡연 허용',
  phoneTolerance: '상대 통화·게임 허용',
  earphoneExpectation: '이어폰 기대',
  sleepEnvPreference: '취침 소리 허용',
  cleanExpectation: '청결 기대',
  drinkingTolerance: '음주 허용',
};

// === 필드 라벨 (옵션별 표시 텍스트) ===

export const LIFESTYLE_LABELS: Record<keyof LifestyleData, Record<string, string>> = {
  // 수면 패턴
  bedtime: {
    BEFORE_22: '22시 이전',
    '22_24': '22~24시',
    '24_02': '24~02시',
    AFTER_02: '02시 이후',
  },
  wakeTime: {
    BEFORE_07: '7시 이전',
    '07_08': '7~8시',
    '08_09': '8~9시',
    '09_10': '9~10시',
    AFTER_10: '10시 이후',
    FLEXIBLE: '수업에 따라 유동적',
  },
  sleepHabit: {
    NONE: '없음',
    TALKING: '잠꼬대',
    SNORING: '코골이',
    GRINDING: '이갈이',
  },
  sleepEnvironment: {
    QUIET: '조용히',
    EARPHONE: '이어폰으로',
    LOW_SPEAKER: '작은 소리 스피커',
  },
  noiseSensitivity: {
    SENSITIVE: '민감',
    NORMAL: '보통',
    DEEP: '둔함',
  },

  // 생활 패턴
  smokingBehavior: {
    NO: '비흡연',
    E_CIG: '전자담배',
    YES: '흡연',
  },
  indoorEating: {
    NO: '싫어요',
    OK: '상관없어요',
    VENTILATE: '환기하면 OK',
  },
  phoneBehavior: {
    OUTSIDE: '밖에서',
    BRIEF: '짧게만',
    FREE: '자유롭게',
  },
  earphoneUsage: {
    ALWAYS: '항상',
    STUDY: '공부·게임 시',
    QUIET: '작게 틀기',
    FREE: '자유',
  },
  cleanLevel: {
    WHEN_DIRTY: '더러울 때',
    WEEKLY_1_2: '1~2회/주',
    WEEKLY_3_UP: '3회+/주',
  },
  drinkingFrequency: {
    NONE: '안 함',
    SOMETIMES: '가끔',
    OFTEN: '자주',
  },
  relationshipStyle: {
    CLOSE: '친하게 지내요',
    CASUAL: '각자 생활',
  },
  temperatureSensitivity: {
    COLD: '추위 타요',
    NORMAL: '보통',
    HOT: '더위 타요',
  },

  // 원하는 룸메 조건
  smokingTolerance: {
    NO_ONLY: '비흡연만',
    E_CIG_OK: '전담까지 OK',
    ANY: '상관없음',
  },
  phoneTolerance: {
    OUTSIDE_ONLY: '밖에서만',
    BRIEF_OK: '짧게면 OK',
    ANY: '상관없음',
  },
  earphoneExpectation: {
    MUST: '꼭 사용',
    STUDY: '공부·게임 시 사용',
    ANY: '상관없음',
  },
  sleepEnvPreference: {
    QUIET_ONLY: '조용히만',
    EARPHONE_OK: '이어폰까지 OK',
    LOW_SPEAKER_OK: '작은 소리도 OK',
  },
  cleanExpectation: {
    STRICT: '주기 맞춤',
    BASIC: '기본 유지',
    FLEXIBLE: '유연',
  },
  drinkingTolerance: {
    NONE_ONLY: '안 마시는 사람만',
    SOMETIMES_OK: '가끔까지 OK',
    ANY: '상관없음',
  },
};

export function getLifestyleLabel(field: keyof LifestyleData, value: string | null): string {
  if (!value) return '미입력';
  return LIFESTYLE_LABELS[field][value] ?? '-';
}

// === 정렬 순서 (matchScore 계산용) ===

export const BEDTIME_ORDER = [
  'BEFORE_22',
  '22_24',
  '24_02',
  'AFTER_02',
] as const satisfies readonly NonNullable<LifestyleData['bedtime']>[];

export const WAKE_ORDER = [
  'BEFORE_07',
  '07_08',
  '08_09',
  '09_10',
  'AFTER_10',
] as const satisfies readonly NonNullable<Exclude<LifestyleData['wakeTime'], 'FLEXIBLE'>>[];

export const TEMPERATURE_ORDER = ['COLD', 'NORMAL', 'HOT'] as const satisfies readonly NonNullable<
  LifestyleData['temperatureSensitivity']
>[];
