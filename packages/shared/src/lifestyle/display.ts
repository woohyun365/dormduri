import type { LifestyleData } from './schema.js';

export type LifestyleDisplayField = keyof LifestyleData;

const LIFESTYLE_DISPLAY_FIELD_NAMES: Record<LifestyleDisplayField, string> = {
  bedtime: '취침 시간',
  wakeTime: '기상 시간',
  sleepHabit: '잠버릇',
  sleepEnvironment: '잠들 때 소리',
  screenUsage: '잠들 때 화면',
  noiseSensitivity: '잠귀',
  smokingBehavior: '흡연 여부',
  indoorEating: '실내 취식',
  phoneBehavior: '실내 통화',
  earphoneUsage: '이어폰 사용',
  cleanLevel: '방 청소',
  drinkingFrequency: '음주 빈도',
  relationshipStyle: '관계 스타일',
  temperatureSensitivity: '온도 민감도',
  smokingTolerance: '흡연 여부',
  phoneTolerance: '실내 통화 여부',
  earphoneExpectation: '이어폰 사용 여부',
  sleepEnvPreference: '잘 때 스피커 볼륨',
  screenTolerance: '잘 때 화면 밝기',
  indoorEatingTolerance: '실내 취식',
  cleanExpectation: '방 청소',
  drinkingTolerance: '음주',
};

const LIFESTYLE_DISPLAY_OPTION_LABELS: Record<LifestyleDisplayField, Record<string, string>> = {
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
    QUIET: '안 틀어요',
    EARPHONE: '이어폰 사용',
    LOW_SPEAKER: '스피커로 작게',
  },
  screenUsage: {
    NONE: '안 봐요',
    AUDIO: '음악만 들어요',
    SCREEN: '화면을 봐요',
  },
  noiseSensitivity: {
    SENSITIVE: '민감',
    NORMAL: '보통',
    DEEP: '둔함',
  },
  smokingBehavior: {
    NO: '비흡연',
    E_CIG: '전자담배만',
    YES: '흡연',
  },
  indoorEating: {
    RARELY: '잘 안 먹어요',
    SNACK: '간식은 먹어요',
    MEAL: '배달·간편식도 먹어요',
  },
  phoneBehavior: {
    RARELY: '잘 안 해요',
    SOMETIMES: '가끔 해요',
    OFTEN: '자주 해요',
  },
  earphoneUsage: {
    ALWAYS: '항상 이어폰',
    MOSTLY: '주로 이어폰',
    MOSTLY_SPEAKER: '주로 스피커',
    ALWAYS_SPEAKER: '항상 스피커',
  },
  cleanLevel: {
    WHEN_DIRTY: '몰아서 정리하는 편이에요',
    WEEKLY_1_2: '눈에 띄면 정리해요',
    WEEKLY_3_UP: '바로 정리하는 편이에요',
  },
  drinkingFrequency: {
    NONE: '아예 안 해요',
    RARELY: '거의 안 해요',
    SOMETIMES: '가끔 마셔요',
    OFTEN: '즐기는 편이에요',
  },
  relationshipStyle: {
    CLOSE: '친하게 지내요',
    CASUAL: '각자 생활해요',
  },
  temperatureSensitivity: {
    COLD: '추위 타요',
    NORMAL: '보통',
    HOT: '더위 타요',
  },
  smokingTolerance: {
    NO_ONLY: '비흡연자가 좋아요',
    E_CIG_OK: '전담까지는 OK',
    ANY: '상관없음',
  },
  phoneTolerance: {
    OUTSIDE_ONLY: '안 했으면 좋겠어요',
    BRIEF_OK: '가끔·짧게는 괜찮아요',
    ANY: '상관없어요',
  },
  earphoneExpectation: {
    MUST: '소리는 이어폰으로 들어줬으면 좋겠어요',
    LOW_VOLUME_OK: '작게 틀면 괜찮아요',
    ANY: '상관없어요',
  },
  sleepEnvPreference: {
    NO_SPEAKER: '안 틀었으면 좋겠어요',
    SPEAKER_OK: '작은 소리는 괜찮아요',
  },
  screenTolerance: {
    NO_SCREEN: '안 켰으면 좋겠어요',
    LOW_OK: '밝기 낮추면 괜찮아요',
    SCREEN_OK: '상관없어요',
  },
  indoorEatingTolerance: {
    NO_SMELL: '안 먹었으면 좋겠어요',
    CLEAN_OK: '환기·정리 잘하면 OK',
    ANY: '상관없어요',
  },
  cleanExpectation: {
    STRICT: '바로 정리하는 게 좋아요',
    BASIC: '눈에 띄면 정리하면 괜찮아요',
    FLEXIBLE: '몰아서 해도 괜찮아요',
  },
  drinkingTolerance: {
    LOW_ONLY: '아예/거의 안 마시는 사람이 좋아요',
    ANY: '상관없어요',
  },
};

export function formatLifestyleFieldName(field: LifestyleDisplayField): string {
  return LIFESTYLE_DISPLAY_FIELD_NAMES[field];
}

export function formatLifestyleOptionLabel(
  field: LifestyleDisplayField,
  value: string | null | undefined,
  fallback: string = '-',
): string {
  if (!value) return '미입력';
  return LIFESTYLE_DISPLAY_OPTION_LABELS[field][value] ?? fallback;
}
