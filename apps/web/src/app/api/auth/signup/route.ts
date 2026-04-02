import { NextRequest } from 'next/server';
import { buildJsonResponse, forwardAuthRequest, setAuthCookie } from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const { response, json } = await forwardAuthRequest('/auth/signup', body);

  const nextResponse = buildJsonResponse(response, {
    success: json.success,
    error: json.error,
    user: json.user,
  });

  if (json.success === true && typeof json.accessToken === 'string') {
    setAuthCookie(nextResponse, json.accessToken);
  }

  return nextResponse;
}
