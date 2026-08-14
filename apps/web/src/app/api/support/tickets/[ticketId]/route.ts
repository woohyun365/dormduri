import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  forwardBffRequest,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';

type SupportTicketRouteContext = BffRouteContext<{ ticketId: string }>;

export async function GET(request: NextRequest, context: SupportTicketRouteContext) {
  const { ticketId } = await resolveBffRouteParams(context);
  return forwardBffRequest({
    request,
    operation: 'support.ticket.detail',
    method: 'GET',
    path: `/api/support/tickets/${encodeBffPathSegment(ticketId)}`,
    authenticated: true,
  });
}
