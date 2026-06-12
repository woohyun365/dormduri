import { describe, expect, it } from 'vitest';
import {
  assertOperatorCanReplySupportTicket,
  assertUserCanAppendSupportMessage,
  isTerminalSupportTicketStatus,
} from './support-ticket-status.policy.js';

describe('support ticket status policy', () => {
  it('사용자 follow-up은 CLOSED 외 상태를 WAITING_OPERATOR로 전환한다', () => {
    expect(assertUserCanAppendSupportMessage('OPEN')).toBe('WAITING_OPERATOR');
    expect(assertUserCanAppendSupportMessage('WAITING_USER')).toBe('WAITING_OPERATOR');
    expect(assertUserCanAppendSupportMessage('RESOLVED')).toBe('WAITING_OPERATOR');
  });

  it('CLOSED ticket에는 사용자/운영자 메시지를 추가하지 않는다', () => {
    for (const action of [
      () => assertUserCanAppendSupportMessage('CLOSED'),
      () => assertOperatorCanReplySupportTicket('CLOSED'),
    ]) {
      expect(action).toThrow();
      try {
        action();
      } catch (error: unknown) {
        const httpError = error as {
          getResponse: () => { code?: string; error?: string };
        };
        expect(typeof httpError.getResponse).toBe('function');
        expect(httpError.getResponse()).toMatchObject({
          code: 'SUPPORT_TICKET_CLOSED',
          error: '종료된 문의에는 메시지를 추가할 수 없습니다.',
        });
      }
    }
  });

  it('RESOLVED와 CLOSED를 terminal status로 분류한다', () => {
    expect(isTerminalSupportTicketStatus('RESOLVED')).toBe(true);
    expect(isTerminalSupportTicketStatus('CLOSED')).toBe(true);
    expect(isTerminalSupportTicketStatus('WAITING_OPERATOR')).toBe(false);
  });
});
