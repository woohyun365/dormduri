import type { NextRequest, NextResponse } from 'next/server';
import {
  apiSessionResponseSchema,
  browserSessionResolutionSchema,
  type ApiSessionRejectionReason,
  type ApiSessionResponse,
  type BrowserSessionResolution,
} from '@repo/shared/auth/session';
import { renewSessionResponseSchema, type RenewSessionResponse } from '@repo/shared/auth/response';
import { AUTH_SESSION_STALE_RETRY_HEADER } from '@/auth/model/session-resolution.constants';
import {
  clearAuthCookie,
  getAuthRenewalTokenCookie,
  getAuthTokenCookie,
  setAuthTransportCookies,
} from './auth-cookies';
import { forwardAuthRequest, getForwardHeaders, type AuthForwardResult } from './auth-forward';
import { buildJsonResponse } from './auth-response';

const AUTHORITATIVE_SESSION_REASONS = new Set<ApiSessionRejectionReason>([
  'SESSION_REVOKED',
  'SESSION_EXPIRED',
  'ACCOUNT_DELETED',
  'ACCOUNT_IDENTITY_INCOMPLETE',
]);

function buildSessionResolutionResponse(
  resolution: BrowserSessionResolution,
  status = 200,
): NextResponse {
  return buildJsonResponse(
    new Response('{}', {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
    browserSessionResolutionSchema.parse(resolution),
  );
}

function buildUnavailableResponse(result?: AuthForwardResult): NextResponse {
  const status = result && result.response.status >= 500 ? result.response.status : 503;
  return buildSessionResolutionResponse(
    { status: 'unavailable', code: 'AUTH_SESSION_UNAVAILABLE' },
    status,
  );
}

function buildUnauthenticatedResponse(clearCookies = true): NextResponse {
  const response = buildSessionResolutionResponse({ status: 'unauthenticated' });
  if (clearCookies) {
    clearAuthCookie(response);
  }
  return response;
}

function buildStaleRetryResponse(retryAfterMilliseconds: number): NextResponse {
  const response = buildUnavailableResponse();
  response.headers.set(AUTH_SESSION_STALE_RETRY_HEADER, String(retryAfterMilliseconds));
  return response;
}

async function fetchApiSession(
  request: NextRequest,
  accessToken: string,
): Promise<
  | { success: true; result: AuthForwardResult; session: ApiSessionResponse }
  | { success: false; result: AuthForwardResult }
> {
  const result = await forwardAuthRequest(
    'GET',
    '/auth/session',
    undefined,
    {
      headers: getForwardHeaders(request, { Authorization: `Bearer ${accessToken}` }),
      signal: request.signal,
    },
    { requestHeaders: request.headers, responseSchema: apiSessionResponseSchema },
  );
  const parsed = apiSessionResponseSchema.safeParse(result.json);
  if (result.failureKind || !parsed.success || !result.response.ok) {
    return { success: false, result };
  }
  return { success: true, result, session: parsed.data };
}

async function renewApiSession(
  request: NextRequest,
  renewalToken: string,
): Promise<
  | { success: true; result: AuthForwardResult; renewal: RenewSessionResponse }
  | { success: false; result: AuthForwardResult }
> {
  const result = await forwardAuthRequest(
    'POST',
    '/auth/renew-session',
    { renewalToken },
    {
      headers: getForwardHeaders(request),
      signal: request.signal,
    },
    { requestHeaders: request.headers, responseSchema: renewSessionResponseSchema },
  );
  const parsed = renewSessionResponseSchema.safeParse(result.json);
  if (result.failureKind || !parsed.success || !result.response.ok) {
    return { success: false, result };
  }
  return { success: true, result, renewal: parsed.data };
}

function setRenewedCookies(
  response: NextResponse,
  renewal: {
    accessToken: string;
    renewalToken: string;
    rememberMe: boolean;
  },
) {
  setAuthTransportCookies(response, {
    accessToken: renewal.accessToken,
    renewalToken: renewal.renewalToken,
    rememberMe: renewal.rememberMe,
  });
}

export async function resolveBrowserSession(request: NextRequest): Promise<NextResponse> {
  const accessToken = getAuthTokenCookie(request);
  const renewalToken = getAuthRenewalTokenCookie(request);

  if (!accessToken && !renewalToken) {
    return buildUnauthenticatedResponse();
  }

  if (accessToken) {
    const accessResolution = await fetchApiSession(request, accessToken);
    if (!accessResolution.success) {
      return buildUnavailableResponse(accessResolution.result);
    }
    if (accessResolution.session.authenticated) {
      return buildSessionResolutionResponse({
        status: 'authenticated',
        user: accessResolution.session.user,
      });
    }
    if (AUTHORITATIVE_SESSION_REASONS.has(accessResolution.session.reason)) {
      return buildUnauthenticatedResponse();
    }
  }

  if (!renewalToken) {
    return buildUnauthenticatedResponse();
  }

  const renewalResolution = await renewApiSession(request, renewalToken);
  if (!renewalResolution.success) {
    return buildUnavailableResponse(renewalResolution.result);
  }
  if (!renewalResolution.renewal.success) {
    if (renewalResolution.renewal.code === 'AUTH_SESSION_RENEWAL_STALE') {
      return buildStaleRetryResponse(renewalResolution.renewal.retryAfterMilliseconds);
    }
    return buildUnauthenticatedResponse();
  }

  const renewal = renewalResolution.renewal;
  if (
    typeof renewal.accessToken !== 'string' ||
    typeof renewal.renewalToken !== 'string' ||
    typeof renewal.rememberMe !== 'boolean'
  ) {
    return buildUnavailableResponse();
  }

  const renewedAccessResolution = await fetchApiSession(request, renewal.accessToken);
  if (!renewedAccessResolution.success) {
    const response = buildUnavailableResponse(renewedAccessResolution.result);
    setRenewedCookies(response, {
      accessToken: renewal.accessToken,
      renewalToken: renewal.renewalToken,
      rememberMe: renewal.rememberMe,
    });
    return response;
  }
  if (!renewedAccessResolution.session.authenticated) {
    return buildUnauthenticatedResponse();
  }

  const response = buildSessionResolutionResponse({
    status: 'authenticated',
    user: renewedAccessResolution.session.user,
  });
  setRenewedCookies(response, {
    accessToken: renewal.accessToken,
    renewalToken: renewal.renewalToken,
    rememberMe: renewal.rememberMe,
  });
  return response;
}
