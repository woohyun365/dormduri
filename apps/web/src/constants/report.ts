import type { ReportReason } from '@/types/report';

export const REPORT_REASONS: Record<ReportReason, string> = {
  SEXUAL_HARASSMENT: '성희롱/성적 수치심',
  THREAT: '협박/위협',
  PERSONAL_INFO_EXPOSURE: '타인 개인정보 유포',
  GENDER_IMPERSONATION: '성별 사칭',
  FALSE_PROFILE: '허위 프로필',
  SPAM_OR_AD: '스팸/광고',
  HATE_OR_DISCRIMINATION: '혐오/차별 표현',
  OTHER: '기타',
};

export const REPORT_DETAIL_MAX_LENGTH = 200;
