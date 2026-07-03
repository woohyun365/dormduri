import type { SupportTicketResponse } from '@repo/shared/support';

export type HomeSupportTicketPreview = Readonly<{
  id: string;
  category: SupportTicketResponse['category'];
  status: SupportTicketResponse['status'];
  subject: string;
  lastMessageAt: string;
}>;

export function toHomeSupportTicketPreview(
  ticket: SupportTicketResponse,
): HomeSupportTicketPreview {
  return {
    id: ticket.id,
    category: ticket.category,
    status: ticket.status,
    subject: ticket.subject,
    lastMessageAt: ticket.lastMessageAt,
  };
}
