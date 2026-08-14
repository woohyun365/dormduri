import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type SupportTicketRouteContext = BffRouteContext<{ ticketId: string }>;

export async function POST(request: NextRequest, context: SupportTicketRouteContext) {
  const { ticketId } = await resolveBffRouteParams(context);
  return forwardBffRequest({
    request,
    operation: 'support.ticket.message_create',
    method: 'POST',
    path: `/api/support/tickets/${encodeBffPathSegment(ticketId)}/messages`,
    authenticated: true,
    bodyMode: 'json',
  });
}
