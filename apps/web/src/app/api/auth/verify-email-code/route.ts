import { NextRequest } from 'next/server';
import { buildJsonResponse, forwardAuthRequest } from '../_shared';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Record<string, unknown>;
  const { response, json } = await forwardAuthRequest('/auth/verify-email-code', body);
  return buildJsonResponse(response, json);
}
