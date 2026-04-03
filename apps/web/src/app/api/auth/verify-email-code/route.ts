import { NextRequest } from 'next/server';
import type { VerificationCodeRequest } from '@repo/shared/auth-contract';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders } from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as VerificationCodeRequest;
  const { response, json } = await forwardAuthRequest('POST', '/auth/verify-email-code', body, {
    headers: getForwardHeaders(request),
  });
  return buildJsonResponse(response, json);
}
