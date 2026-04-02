import { NextRequest, NextResponse } from 'next/server';
import { forwardAuthRequest } from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const { json } = await forwardAuthRequest('/auth/verify-email-code', body);
  return NextResponse.json(json);
}
