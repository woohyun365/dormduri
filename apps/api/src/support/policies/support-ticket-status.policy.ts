import type { SupportTicketStatus } from '@repo/shared/support';
import { supportErrors } from '../errors/support.errors.js';

const CLOSED_STATUSES = new Set<SupportTicketStatus>(['CLOSED']);

export function assertUserCanAppendSupportMessage(
  status: SupportTicketStatus,
): SupportTicketStatus {
  if (CLOSED_STATUSES.has(status)) {
    throw supportErrors.ticketClosed();
  }

  return 'WAITING_OPERATOR';
}

export function assertOperatorCanReplySupportTicket(status: SupportTicketStatus): void {
  if (status === 'CLOSED') {
    throw supportErrors.ticketClosed();
  }
}

export function isTerminalSupportTicketStatus(status: SupportTicketStatus): boolean {
  return status === 'RESOLVED' || status === 'CLOSED';
}
