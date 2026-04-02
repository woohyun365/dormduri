import { NextRequest, NextResponse } from 'next/server';
import { clearAuthCookie, forwardAuthRequest } from '../_shared';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const { json } = await forwardAuthRequest(
    '/auth/logout',
    {},
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  );

  const response = NextResponse.json(json);
  clearAuthCookie(response);
  return response;
}
