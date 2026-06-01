import type { IncomingMessage } from 'node:http';
import type { TLSSocket } from 'node:tls';
import { URL } from 'node:url';

type HeaderValue = string | string[] | null | undefined;

export type ChatRealtimeAllowedOrigins = string[] | false;

export type ChatRealtimeOriginPolicyInput = {
  requestOrigin?: HeaderValue;
  allowedOrigins: ChatRealtimeAllowedOrigins;
  host?: HeaderValue;
  forwardedHost?: HeaderValue;
  forwardedProto?: HeaderValue;
  encrypted?: boolean;
  trustProxy?: boolean;
};

export type ChatRealtimeAllowRequestOptions = {
  preAuthRateLimit?: (request: IncomingMessage) => boolean;
  trustProxy?: boolean;
};

export function createChatRealtimeAllowRequest(
  allowedOrigins: ChatRealtimeAllowedOrigins,
  options: ChatRealtimeAllowRequestOptions = {},
) {
  return (request: IncomingMessage, callback: (error: string | null, success: boolean) => void) => {
    const originAllowed = isChatRealtimeRequestOriginAllowed({
      requestOrigin: request.headers.origin,
      allowedOrigins,
      host: request.headers.host,
      forwardedHost: request.headers['x-forwarded-host'],
      forwardedProto: request.headers['x-forwarded-proto'],
      encrypted: Boolean((request.socket as TLSSocket | undefined)?.encrypted),
      trustProxy: options.trustProxy,
    });

    if (!originAllowed) {
      callback(null, false);
      return;
    }

    callback(null, options.preAuthRateLimit ? options.preAuthRateLimit(request) : true);
  };
}

export function isChatRealtimeRequestOriginAllowed(input: ChatRealtimeOriginPolicyInput): boolean {
  const requestOrigin = normalizeOrigin(firstHeaderValue(input.requestOrigin));
  if (!requestOrigin) {
    return false;
  }

  if (input.allowedOrigins !== false) {
    return input.allowedOrigins.some((allowedOrigin) => {
      const normalizedAllowedOrigin = normalizeOrigin(allowedOrigin);
      return normalizedAllowedOrigin !== null && normalizedAllowedOrigin === requestOrigin;
    });
  }

  const sameOrigin = resolveRequestUrlOrigin(input);
  return sameOrigin !== null && sameOrigin === requestOrigin;
}

function resolveRequestUrlOrigin(input: ChatRealtimeOriginPolicyInput): string | null {
  const host =
    (input.trustProxy ? firstForwardedHeaderValue(input.forwardedHost) : null) ??
    firstHeaderValue(input.host);
  if (!host) {
    return null;
  }

  const proto =
    (input.trustProxy ? firstForwardedHeaderValue(input.forwardedProto) : null) ??
    (input.encrypted ? 'https' : 'http');
  return normalizeOrigin(`${proto}://${host}`);
}

function firstForwardedHeaderValue(value: HeaderValue): string | null {
  const firstValue = firstHeaderValue(value);
  return firstValue?.split(',')[0]?.trim() || null;
}

function firstHeaderValue(value: HeaderValue): string | null {
  if (!value) {
    return null;
  }

  return Array.isArray(value) ? (value[0]?.trim() ?? null) : value.trim();
}

function normalizeOrigin(origin: string | null): string | null {
  if (!origin) {
    return null;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return null;
  }
}
