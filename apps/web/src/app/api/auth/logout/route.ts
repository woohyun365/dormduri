import { NextRequest } from 'next/server';
import { buildJsonResponse, clearAuthCookie, forwardAuthRequest } from '../_shared';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const { response, json } = await forwardAuthRequest(
    '/auth/logout',
    {},
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  const nextResponse = buildJsonResponse(response, json);
  clearAuthCookie(nextResponse);
  return nextResponse;
}
