import {
  matchRequestActionResponseSchema,
  matchRequestListResponseSchema,
} from '@repo/shared/match/contract';
import type { NextRequest } from 'next/server';
import { forwardMatchBffRequest } from '../_match-bff';

export async function GET(request: NextRequest) {
  return forwardMatchBffRequest({
    request,
    method: 'GET',
    path: '/api/matches/requests',
    responseSchema: matchRequestListResponseSchema,
  });
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  return forwardMatchBffRequest({
    request,
    method: 'POST',
    path: '/api/matches/requests',
    responseSchema: matchRequestActionResponseSchema,
    body,
  });
}

async function readJsonBody(request: NextRequest): Promise<string | undefined> {
  const text = await request.text();
  return text.trim().length > 0 ? text : undefined;
}
