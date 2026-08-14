import { publicProfileSchema } from '@repo/shared/profile/contract';
import type { NextRequest } from 'next/server';
import {
  encodeBffPathSegment,
  resolveBffRouteParams,
  type BffRouteContext,
} from '@/app/api/_bff/forward';
import { forwardMatchBffRequest } from '../../../../_match-bff';

type MatchHistoryEntryCounterpartProfileRouteContext = BffRouteContext<{ entryId: string }>;

export async function GET(
  request: NextRequest,
  context: MatchHistoryEntryCounterpartProfileRouteContext,
) {
  const { entryId } = await resolveBffRouteParams(context);
  return forwardMatchBffRequest({
    request,
    method: 'GET',
    path: `/api/matches/history/entries/${encodeBffPathSegment(entryId)}/counterpart-profile`,
    responseSchema: publicProfileSchema,
  });
}
