import { conflictError, notFoundError } from '../../platform/http/api-error.js';

export const supportErrors = {
  ticketNotFound() {
    return notFoundError('SUPPORT_TICKET_NOT_FOUND', '문의 티켓을 찾을 수 없습니다.');
  },
  ticketClosed() {
    return conflictError('SUPPORT_TICKET_CLOSED', '종료된 문의에는 메시지를 추가할 수 없습니다.');
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
