import type { ReportReason } from '@repo/shared/social-safety/report';

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  SEXUAL_HARASSMENT: '성희롱/성적 불쾌감',
  THREAT: '협박/위협',
  PERSONAL_INFO_EXPOSURE: '개인정보 노출',
  GENDER_IMPERSONATION: '성별 사칭',
  FALSE_PROFILE: '허위 프로필',
  SPAM_OR_AD: '스팸/광고',
  HATE_OR_DISCRIMINATION: '혐오/차별',
  OTHER: '기타',
};

export function getReportReasonOptions(): readonly { value: ReportReason; label: string }[] {
  return (Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((value) => ({
    value,
    label: REPORT_REASON_LABELS[value],
  }));
}

export function getReportReasonLabel(reason: ReportReason): string {
  return REPORT_REASON_LABELS[reason];
}
