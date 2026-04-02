import { NextRequest, NextResponse } from 'next/server';
import { forwardAuthRequest, setAuthCookie } from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const { json } = await forwardAuthRequest('/auth/signup', body);

  const response = NextResponse.json({
    success: json.success,
    error: json.error,
    user: json.user,
  });

  if (json.success === true && typeof json.accessToken === 'string') {
    setAuthCookie(response, json.accessToken);
  }

  return response;
}
