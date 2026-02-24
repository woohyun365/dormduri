import type { ReportReason } from '@/types/report';

export const REPORT_REASONS: Record<ReportReason, string> = {
  SPAM: '스팸/광고',
  FAKE_INFO: '허위 정보',
  OFFENSIVE: '불쾌한 내용',
  SCAM: '사기 시도',
  OTHER: '기타',
};

export const REPORT_DETAIL_MAX_LENGTH = 200;
