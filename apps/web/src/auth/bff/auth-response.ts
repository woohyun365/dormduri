import { NextResponse } from 'next/server';
import { redactSensitiveBffJson } from '@/app/api/_bff/security';

export function buildJsonResponse(response: Response, json: Record<string, unknown>) {
  const retryAfter = response.headers.get('Retry-After');

  return NextResponse.json(redactSensitiveBffJson(json), {
    status: response.status,
    ...(retryAfter ? { headers: { 'Retry-After': retryAfter } } : {}),
  });
}
