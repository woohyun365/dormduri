import { NextResponse } from 'next/server';
import { redactSensitiveBffJson } from '@/app/api/_bff/security';

export function buildJsonResponse(response: Response, json: Record<string, unknown>) {
  const retryAfter = response.headers.get('Retry-After');

  return NextResponse.json(redactSensitiveBffJson(json), {
    status: response.status,
    headers: {
      'Cache-Control': 'no-store',
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    },
  });
}
