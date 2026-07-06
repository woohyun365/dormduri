import type {
  PublicProfileCompatibilityAxisId,
  PublicProfileCompatibilityBucket,
  PublicProfileCompatibilityHiddenNoticeCode,
} from '@repo/shared/profile/contract';

export type CompatibilityBucketTone = 'high' | 'medium' | 'low' | 'unknown';

const AXIS_LABELS: Record<PublicProfileCompatibilityAxisId, string> = {
  SMOKING: '흡연',
  SLEEP_HABIT: '잠버릇',
  PHONE: '통화',
  EARPHONE: '이어폰',
  SLEEP_ENVIRONMENT: '수면 환경',
  SCREEN_USAGE: '화면 사용',
  CLEAN_LEVEL: '청소',
  INDOOR_EATING: '실내 취식',
  BEDTIME: '취침 시간',
  WAKE_TIME: '기상 시간',
  TEMPERATURE: '온도',
  RELATIONSHIP: '관계 스타일',
};

const BUCKET_LABELS: Record<PublicProfileCompatibilityBucket, string> = {
  HIGH: '잘 맞음',
  MEDIUM: '조율 가능',
  LOW: '주의 필요',
  UNKNOWN: '정보 없음',
};

const BUCKET_TONES: Record<PublicProfileCompatibilityBucket, CompatibilityBucketTone> = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown',
};

const HIDDEN_NOTICE_LABELS: Record<PublicProfileCompatibilityHiddenNoticeCode, string> = {
  DRINKING_EXCLUDED_BY_POLICY: '일부 민감 항목은 정책상 상세 적합도 축에서 제외했어요.',
};

export const COMPATIBILITY_PRIVACY_NOTE =
  '상세 적합도는 공개 가능한 생활패턴 축만 사용하며, 민감 항목이나 상대의 룸메 조건 원본값은 보여주지 않아요.';

export function compatibilityAxisLabel(id: PublicProfileCompatibilityAxisId): string {
  return AXIS_LABELS[id];
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
  return `전체 적합도 ${score}점`;
}

export function compatibilityHiddenNoticeLabel(
  code: PublicProfileCompatibilityHiddenNoticeCode,
): string {
  return HIDDEN_NOTICE_LABELS[code];
}
