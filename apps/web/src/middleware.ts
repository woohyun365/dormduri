import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // TODO: BE 연동 시 JWT 검증으로 교체
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth-token');
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/main/:path*'],
};
