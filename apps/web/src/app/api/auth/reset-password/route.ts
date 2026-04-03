import { NextRequest } from 'next/server';
import type { ResetPasswordRequest } from '@repo/shared/auth-contract';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders } from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ResetPasswordRequest;
  const { response, json } = await forwardAuthRequest('POST', '/auth/reset-password', body, {
    headers: getForwardHeaders(request),
  });
  return buildJsonResponse(response, json);
}
