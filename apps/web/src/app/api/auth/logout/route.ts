import type { NextRequest } from 'next/server';
import {
  buildJsonResponse,
  clearAuthCookie,
  forwardAuthRequest,
  getAuthRenewalTokenCookie,
  getAuthTokenCookie,
  getForwardHeaders,
} from '@/auth/bff';

export async function POST(request: NextRequest) {
  const token = getAuthTokenCookie(request);
  const renewalToken = getAuthRenewalTokenCookie(request);
  const { response, json } = await forwardAuthRequest(
    'POST',
    '/auth/logout',
    renewalToken ? { renewalToken } : {},
    {
      headers: getForwardHeaders(request, token ? { Authorization: `Bearer ${token}` } : undefined),
    },
  );

  const nextResponse = buildJsonResponse(response, json);
  clearAuthCookie(nextResponse);
  return nextResponse;
}
