import { NextRequest } from 'next/server';
import type { EmailRequest } from '@repo/shared/auth-contract';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders } from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as EmailRequest;
  const { response, json } = await forwardAuthRequest('POST', '/auth/send-reset-code', body, {
    headers: getForwardHeaders(request),
  });
  return buildJsonResponse(response, json);
}
