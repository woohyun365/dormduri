import { badRequestError, conflictError, notFoundError } from '../../platform/http/api-error.js';

export const supportErrors = {
  ticketNotFound() {
    return notFoundError('SUPPORT_TICKET_NOT_FOUND', '문의 티켓을 찾을 수 없습니다.');
  },
  ticketClosed() {
    return conflictError('SUPPORT_TICKET_CLOSED', '종료된 문의에는 메시지를 추가할 수 없습니다.');
  },
  relatedReportRequired() {
    return badRequestError(
      'SUPPORT_RELATED_REPORT_REQUIRED',
      '신고 처리 이의 신청에는 신고 접수 ID가 필요합니다.',
    );
  },
  relatedReportNotFound() {
    return notFoundError(
      'SUPPORT_RELATED_REPORT_NOT_FOUND',
      '연결할 수 있는 신고 내역을 찾을 수 없습니다.',
    );
  },
  relatedEnforcementNoticeNotFound() {
    return notFoundError(
      'SUPPORT_RELATED_ENFORCEMENT_NOTICE_NOT_FOUND',
      '연결할 수 있는 이용 제한 내역을 찾을 수 없습니다.',
    );
  },
  invalidTicketTransition() {
    return conflictError(
      'SUPPORT_TICKET_INVALID_TRANSITION',
      '문의 상태 전환이 올바르지 않습니다.',
    );
  },
  faqNotFound() {
    return notFoundError('SUPPORT_FAQ_NOT_FOUND', 'FAQ를 찾을 수 없습니다.');
  },
} as const;
