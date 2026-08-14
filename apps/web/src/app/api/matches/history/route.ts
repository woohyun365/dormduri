import { matchHistoryResponseSchema } from '@repo/shared/match/contract';
import type { NextRequest } from 'next/server';
import { forwardMatchBffRequest } from '../_match-bff';

export async function GET(request: NextRequest) {
  return forwardMatchBffRequest({
    request,
    method: 'GET',
    path: '/api/matches/history',
    responseSchema: matchHistoryResponseSchema,
  });
}
