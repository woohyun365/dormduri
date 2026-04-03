import type { NextRequest } from 'next/server';
import { buildJsonResponse, forwardAuthRequest, getForwardHeaders } from './_shared';

export function createForwardPostHandler<TBody extends Record<string, unknown>>(path: string) {
  return async function POST(request: NextRequest) {
    const body = (await request.json()) as TBody;
    const { response, json } = await forwardAuthRequest('POST', path, body, {
      headers: getForwardHeaders(request),
    });

    return buildJsonResponse(response, json);
  };
}
