import type {
  SupportTicketDetailResponse,
  SupportTicketListResponse,
  SupportTicketResponse,
} from '@repo/shared/support-contract';
import type {
  SupportTicketMessageRecord,
  SupportTicketRecord,
} from '../repositories/support-ticket.repository.js';
import { encodeSupportTicketCursor } from '../queries/support-ticket-list.cursor.js';

function toIso(value: Date): string {
  return value.toISOString();
}

export function toSupportTicketResponse(record: SupportTicketRecord): SupportTicketResponse {
  return {
    id: record.id,
    category: record.category,
    subject: record.subject,
    status: record.status,
    relatedEntityId: record.relatedEntityId,
    appealCategory: record.appealCategory,
    emailReplyConsent: record.emailReplyConsent,
    lastMessageAt: toIso(record.lastMessageAt),
    closedAt: record.closedAt ? toIso(record.closedAt) : null,
    createdAt: toIso(record.createdAt),
    updatedAt: toIso(record.updatedAt),
  };
}

export function toSupportTicketMessageResponse(record: SupportTicketMessageRecord) {
  return {
    id: record.id,
    ticketId: record.ticketId,
    senderType: record.senderType,
    body: record.body,
    createdAt: toIso(record.createdAt),
  };
}

export function toSupportTicketListResponse(input: {
  records: readonly SupportTicketRecord[];
  limit: number;
}): SupportTicketListResponse {
  const pageRecords = input.records.slice(0, input.limit);
  const hasNextPage = input.records.length > input.limit;
  const lastRecord = pageRecords.at(-1);

  return {
    items: pageRecords.map(toSupportTicketResponse),
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && lastRecord
          ? encodeSupportTicketCursor({
              id: lastRecord.id,
              lastMessageAt: lastRecord.lastMessageAt,
            })
          : null,
    },
  };
}

export function toSupportTicketDetailResponse(input: {
  ticket: SupportTicketRecord;
  messages: readonly SupportTicketMessageRecord[];
}): SupportTicketDetailResponse {
  return {
    ticket: toSupportTicketResponse(input.ticket),
    messages: input.messages.map(toSupportTicketMessageResponse),
  };
}
