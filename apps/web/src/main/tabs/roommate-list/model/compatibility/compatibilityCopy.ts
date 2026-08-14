import type {
  PublicProfileCompatibilityAxisId,
  PublicProfileCompatibilityBucket,
  PublicProfileCompatibilityDimensionId,
} from '@repo/shared/profile/contract';

export type CompatibilityBucketTone = 'high' | 'medium' | 'low' | 'unknown';

const AXIS_LABELS: Record<PublicProfileCompatibilityAxisId, string> = {
  SMOKING: '흡연',
  SLEEP_HABIT: '잠버릇',
  PHONE: '실내 통화',
  EARPHONE: '영상 시청 시 소리',
  SLEEP_ENVIRONMENT: '취침 시 스피커 사용',
  SCREEN_USAGE: '취침 시 화면 밝기',
  CLEAN_LEVEL: '청소 습관',
  INDOOR_EATING: '실내 취식',
  BEDTIME: '취침',
  WAKE_TIME: '기상',
  TEMPERATURE: '추위·더위 체질',
  RELATIONSHIP: '친밀도',
};

const AXIS_DESCRIPTIONS: Record<PublicProfileCompatibilityAxisId, string> = {
  SMOKING: '흡연 습관과 허용 기준을 비교해요.',
  SLEEP_HABIT: '상대 잠버릇과 나의 잠귀 민감도를 비교해요.',
  PHONE: '실내 통화 습관과 허용 기준을 비교해요.',
  EARPHONE: '영상 시청 시 소리 습관과 기대 기준을 비교해요.',
  SLEEP_ENVIRONMENT: '잠들 때 스피커 사용 방식과 나의 허용 기준을 비교해요.',
  SCREEN_USAGE: '잠들 때 화면 밝기와 나의 허용 기준을 비교해요.',
  CLEAN_LEVEL: '정리 빈도와 청소 기대치를 비교해요.',
  INDOOR_EATING: '실내 취식 습관과 허용 기준을 비교해요.',
  BEDTIME: '잠드는 시간대가 얼마나 가까운지 봐요.',
  WAKE_TIME: '일어나는 시간대가 얼마나 가까운지 봐요.',
  TEMPERATURE: '더위·추위를 타는 정도가 비슷한지 봐요.',
  RELATIONSHIP: '룸메이트와 지내는 방식을 비교해요.',
};

const DIMENSION_LABELS: Record<PublicProfileCompatibilityDimensionId, string> = {
  SMOKING: '흡연',
  SLEEP_RHYTHM: '수면 리듬',
  SLEEP_HABIT: '잠버릇',
  SLEEP_ENVIRONMENT: '수면 환경',
  DEVICE_USAGE: '통화·미디어',
  CLEAN_SPACE: '청소 루틴',
  TEMPERATURE: '온도 조절',
  RELATIONSHIP_STYLE: '친밀도',
};

const DIMENSION_DESCRIPTIONS: Record<PublicProfileCompatibilityDimensionId, string> = {
  SMOKING: '상대 흡연 여부를 확인해요.',
  SLEEP_RHYTHM: '수면·기상 시간을 확인해요.',
  SLEEP_HABIT: '상대의 잠버릇과 나의 잠귀를 비교해요.',
  SLEEP_ENVIRONMENT: '잠들 때 화면·스피커 사용을 조율해요.',
  DEVICE_USAGE: '실내 통화·이어폰 습관을 조율해요.',
  CLEAN_SPACE: '청소 빈도·실내 취식을 조율해요.',
  TEMPERATURE: '에어컨·난방 민감도를 확인해요.',
  RELATIONSHIP_STYLE: '룸메이트와 지내는 방식을 확인해요.',
};

const BUCKET_LABELS: Record<PublicProfileCompatibilityBucket, string> = {
  HIGH: '잘 맞음',
  MEDIUM: '조율 가능',
  LOW: '서로 다름',
  UNKNOWN: '정보 없음',
};

const BUCKET_TONES: Record<PublicProfileCompatibilityBucket, CompatibilityBucketTone> = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
};

export const COMPATIBILITY_PRIVACY_NOTE = '상세 적합도는 공개 가능한 생활패턴 축만 사용해요.';

export function compatibilityAxisLabel(id: PublicProfileCompatibilityAxisId): string {
  return AXIS_LABELS[id];
}

export function compatibilityAxisDescription(id: PublicProfileCompatibilityAxisId): string {
  return AXIS_DESCRIPTIONS[id];
}

export function compatibilityDimensionLabel(id: PublicProfileCompatibilityDimensionId): string {
  return DIMENSION_LABELS[id];
}

export function compatibilityDimensionDescription(
  id: PublicProfileCompatibilityDimensionId,
): string {
  return DIMENSION_DESCRIPTIONS[id];
}

export function compatibilityBucketLabel(bucket: PublicProfileCompatibilityBucket): string {
  return BUCKET_LABELS[bucket];
}

export function compatibilityBucketTone(
  bucket: PublicProfileCompatibilityBucket,
): CompatibilityBucketTone {
  return BUCKET_TONES[bucket];
}

export function compatibilityScoreLabel(score: number | null): string {
  return typeof score === 'number' ? `${score}점` : '점수 없음';
}

export function compatibilityOverallScoreLabel(score: number): string {
  return `매칭점수 ${score}점`;
}
