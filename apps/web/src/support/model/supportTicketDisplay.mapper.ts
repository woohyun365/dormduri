import type {
  SupportAppealCategory,
  SupportMessageSenderType,
  SupportTicketCategory,
  SupportTicketResponse,
  SupportTicketStatus,
} from '@repo/shared/support';

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ko-KR', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

export const SUPPORT_CATEGORY_LABEL: Record<SupportTicketCategory, string> = {
  ACCOUNT: '계정/인증',
  SEASON: '시즌/기숙사',
  MATCHING: '매칭/채팅',
  REPORT_OR_BLOCK: '신고/차단',
  APPEAL: '이의 신청',
  BUG: '버그',
  OTHER: '기타',
};

export const SUPPORT_APPEAL_CATEGORY_LABEL: Record<SupportAppealCategory, string> = {
  SANCTION: '제재 이의',
  TEMPORARY_RESTRICTION: '임시 제한 이의',
  REPORT_RESULT: '신고 처리 이의',
  CONTENT_ACTION: '콘텐츠 조치 이의',
};

export const SUPPORT_STATUS_LABEL: Record<SupportTicketStatus, string> = {
  OPEN: '접수',
  WAITING_USER: '추가 확인 필요',
  WAITING_OPERATOR: '운영자 확인 중',
  RESOLVED: '답변 완료',
  CLOSED: '종료',
};

export const SUPPORT_SENDER_LABEL: Record<SupportMessageSenderType, string> = {
  USER: '나',
  OPERATOR: '운영팀',
  SYSTEM: '시스템',
};

export const SUPPORT_TICKET_FORM_CATEGORIES: ReadonlyArray<{
  value: SupportTicketCategory;
  label: string;
}> = [
  { value: 'ACCOUNT', label: SUPPORT_CATEGORY_LABEL.ACCOUNT },
  { value: 'SEASON', label: SUPPORT_CATEGORY_LABEL.SEASON },
  { value: 'MATCHING', label: SUPPORT_CATEGORY_LABEL.MATCHING },
  { value: 'REPORT_OR_BLOCK', label: SUPPORT_CATEGORY_LABEL.REPORT_OR_BLOCK },
  { value: 'APPEAL', label: SUPPORT_CATEGORY_LABEL.APPEAL },
  { value: 'BUG', label: SUPPORT_CATEGORY_LABEL.BUG },
  { value: 'OTHER', label: SUPPORT_CATEGORY_LABEL.OTHER },
];

export const SUPPORT_APPEAL_FORM_CATEGORIES: ReadonlyArray<{
  value: SupportAppealCategory;
  label: string;
}> = [
  { value: 'SANCTION', label: SUPPORT_APPEAL_CATEGORY_LABEL.SANCTION },
  { value: 'TEMPORARY_RESTRICTION', label: SUPPORT_APPEAL_CATEGORY_LABEL.TEMPORARY_RESTRICTION },
  { value: 'REPORT_RESULT', label: SUPPORT_APPEAL_CATEGORY_LABEL.REPORT_RESULT },
  { value: 'CONTENT_ACTION', label: SUPPORT_APPEAL_CATEGORY_LABEL.CONTENT_ACTION },
];

export type SupportTicketListItemViewModel = Readonly<{
  id: string;
  categoryLabel: string;
  statusLabel: string;
  subject: string;
  lastMessageAtLabel: string;
  canAppendMessage: boolean;
}>;

export function formatSupportDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return DATE_TIME_FORMATTER.format(date).replace(/\. /g, '.').replace(/\.$/, '');
}

export function canAppendSupportMessage(status: SupportTicketStatus): boolean {
  return status !== 'CLOSED';
}

export function toSupportTicketListItemViewModel(
  ticket: SupportTicketResponse,
): SupportTicketListItemViewModel {
  return {
    id: ticket.id,
    categoryLabel: SUPPORT_CATEGORY_LABEL[ticket.category],
    statusLabel: SUPPORT_STATUS_LABEL[ticket.status],
    subject: ticket.subject,
    lastMessageAtLabel: formatSupportDate(ticket.lastMessageAt),
    canAppendMessage: canAppendSupportMessage(ticket.status),
  };
}
