import {
  currentUserResponseSchema,
  dismissCurrentUserOnboardingNoticeRequestSchema,
} from '@repo/shared/user';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getBffForwardHeaders } from '@/app/api/_bff/forward';
import {
  buildBffUpstreamUrl,
  buildSafeBffErrorResponse,
  readBffJsonResponse,
} from '@/app/api/_bff/security';
import { getWebEnv } from '@/config/env';

const UPSTREAM_CURRENT_USER_ONBOARDING_PATH = '/api/users/me/onboarding';

export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return buildSafeBffErrorResponse('BFF_REQUEST_BODY_INVALID', 400);
  }

  const parsedBody = dismissCurrentUserOnboardingNoticeRequestSchema.safeParse(body);
  if (!parsedBody.success) {
    return buildSafeBffErrorResponse('BFF_REQUEST_BODY_INVALID', 400);
  }

  let upstreamUrl: string;
  try {
    upstreamUrl = buildBffUpstreamUrl({
      apiUpstreamUrl: getWebEnv().apiUpstreamUrl,
      path: UPSTREAM_CURRENT_USER_ONBOARDING_PATH,
      allowedPathPrefix: '/api',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_URL_INVALID');
  }

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: 'PATCH',
      headers: getBffForwardHeaders(request, {
        authenticated: true,
        contentType: 'application/json',
      }),
      body: JSON.stringify(parsedBody.data),
      cache: 'no-store',
    });
  } catch {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_UNAVAILABLE');
  }

  const { response: safeResponse, json } = await readBffJsonResponse(upstreamResponse, {
    redactSensitiveFields: true,
  });

  if (!safeResponse.ok) {
    return NextResponse.json(json, { status: safeResponse.status });
  }

  const parsedResponse = currentUserResponseSchema.safeParse(json);
  if (!parsedResponse.success) {
    return buildSafeBffErrorResponse('BFF_UPSTREAM_SCHEMA_INVALID');
  }

  return NextResponse.json(parsedResponse.data, { status: safeResponse.status });
}
