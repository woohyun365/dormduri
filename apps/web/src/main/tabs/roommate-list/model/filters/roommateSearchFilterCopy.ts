import { LIFESTYLE_FIELD_NAMES, LIFESTYLE_LABELS } from '@/constants/lifestyle';
import type { LifestyleData } from '@/types/lifestyle';
import type { RoommateSearchFilterOperator } from '@repo/shared/roommate-search/contract';
import type {
  RoommateSearchCriteriaFilterKey,
  RoommateSearchMbtiTraitKey,
  RoommateSearchScalarFilterKey,
} from '../search/roommateSearchQuery';

interface RoommateSearchFilterFieldCopy {
  readonly title: string;
  readonly chipLabel: string;
  readonly helperText?: string;
}

const SCALAR_FILTER_LIFESTYLE_FIELDS = {
  smokingBehavior: 'smokingBehavior',
  bedtime: 'bedtime',
  wakeTime: 'wakeTime',
  noiseSensitivity: 'noiseSensitivity',
  cleanLevel: 'cleanLevel',
  sleepHabit: 'sleepHabit',
  indoorEating: 'indoorEating',
  relationshipStyle: 'relationshipStyle',
} as const satisfies Record<RoommateSearchScalarFilterKey, keyof LifestyleData>;

const FIELD_COPY = {
  smokingBehavior: {
    title: '원하는 상대의 흡연 여부',
    chipLabel: LIFESTYLE_FIELD_NAMES.smokingBehavior,
  },
  bedtime: {
    title: '원하는 상대의 취침 시간',
    chipLabel: LIFESTYLE_FIELD_NAMES.bedtime,
  },
  wakeTime: {
    title: '원하는 상대의 기상 시간',
    chipLabel: LIFESTYLE_FIELD_NAMES.wakeTime,
  },
  noiseSensitivity: {
    title: '원하는 상대의 잠귀 밝음 정도',
    chipLabel: LIFESTYLE_FIELD_NAMES.noiseSensitivity,
  },
  cleanLevel: {
    title: '원하는 상대의 방 정리 습관',
    chipLabel: '방 정리',
  },
  sleepHabit: {
    title: '원하는 상대의 잠버릇',
    chipLabel: LIFESTYLE_FIELD_NAMES.sleepHabit,
  },
  indoorEating: {
    title: '원하는 상대의 실내 취식 습관',
    chipLabel: LIFESTYLE_FIELD_NAMES.indoorEating,
  },
  relationshipStyle: {
    title: '원하는 상대의 관계 스타일',
    chipLabel: LIFESTYLE_FIELD_NAMES.relationshipStyle,
  },
  college: {
    title: '원하는 상대의 단과대',
    chipLabel: '단과대',
  },
  grade: {
    title: '원하는 상대의 학년',
    chipLabel: '학년',
  },
  mbtiTraits: {
    title: '원하는 상대의 MBTI 성향',
    chipLabel: 'MBTI 성향',
  },
  ageBand: {
    title: '원하는 상대의 나이대',
    chipLabel: '나이대',
    helperText: '한국식 나이 기준으로 보여주며, 필터는 함께 표시된 출생연도 범위로 적용돼요.',
  },
  minScore: {
    title: '원하는 매칭점수 기준',
    chipLabel: '매칭점수',
  },
} as const satisfies Record<RoommateSearchCriteriaFilterKey, RoommateSearchFilterFieldCopy>;

const SLEEP_HABIT_FILTER_LABELS: Record<string, string> = {
  NONE: '잠버릇 없음',
  TALKING: '잠버릇 있음',
  SNORING: '잠버릇 있음',
  GRINDING: '잠버릇 있음',
  HAS: '잠버릇 있음',
};

const RELATIONSHIP_STYLE_FILTER_LABELS: Record<string, string> = {
  CLOSE: '친하게 지내요',
  CASUAL: '각자 생활해요',
};

export function getRoommateSearchFilterFieldCopy(
  key: RoommateSearchCriteriaFilterKey,
): RoommateSearchFilterFieldCopy {
  return FIELD_COPY[key];
}

export function formatRoommateSearchFilterOptionLabel(
  key: RoommateSearchCriteriaFilterKey,
  code: string,
  fallback: string,
): string {
  if (key === 'sleepHabit') {
    return SLEEP_HABIT_FILTER_LABELS[code] ?? fallback;
  }

  if (key === 'relationshipStyle') {
    return RELATIONSHIP_STYLE_FILTER_LABELS[code] ?? fallback;
  }

  if (isScalarFilterKey(key)) {
    const lifestyleField = SCALAR_FILTER_LIFESTYLE_FIELDS[key];
    return LIFESTYLE_LABELS[lifestyleField][code] ?? fallback;
  }

  if (key === 'grade') {
    return code === '4+' ? '4학년 이상' : `${code}학년`;
  }

  if (key === 'ageBand') {
    return fallback !== code ? fallback : code === '25_PLUS' ? '25세 이상' : `${code}세`;
  }

  if (key === 'minScore') {
    return `${code}점 이상`;
  }

  return fallback;
}

export function formatRoommateSearchOperatorLabel(operator: RoommateSearchFilterOperator): string {
  return operator === 'EXCLUDE' ? '선택한 값 빼고 보기' : '선택한 값만 보기';
}

export function formatRoommateSearchMbtiTraitLabel(trait: RoommateSearchMbtiTraitKey): string {
  const labels: Record<RoommateSearchMbtiTraitKey, string> = {
    energy: '에너지 방향',
    perception: '정보 수집 방식',
    decision: '의사 결정 방식',
    lifestyle: '생활 리듬',
  };
  return labels[trait];
}

function isScalarFilterKey(
  key: RoommateSearchCriteriaFilterKey,
): key is RoommateSearchScalarFilterKey {
  return key in SCALAR_FILTER_LIFESTYLE_FIELDS;
}
