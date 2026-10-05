import type { IncomingMessage } from 'node:http';
import type { TLSSocket } from 'node:tls';
import { URL } from 'node:url';
import type { ChatRealtimeProxyProfile } from './chat-realtime.config.js';
import { readSingleChatHeader } from './chat-realtime-rate-limiter.service.js';

type HeaderValue = string | string[] | null | undefined;
export type ChatRealtimeAllowedOrigins = readonly string[] | false;
export type ChatRealtimeOriginPolicyInput = {
  requestOrigin?: HeaderValue;
  allowedOrigins: ChatRealtimeAllowedOrigins;
  host?: HeaderValue;
  forwardedHost?: HeaderValue;
  forwardedProto?: HeaderValue;
  encrypted?: boolean;
  peerAddress?: string | null;
  proxyProfile?: ChatRealtimeProxyProfile;
};
export type ChatRealtimeAllowRequestOptions = {
  preAuthRateLimit?: (request: IncomingMessage) => boolean;
  proxyProfile?: ChatRealtimeProxyProfile;
};

export function createChatRealtimeAllowRequest(
  allowedOrigins: ChatRealtimeAllowedOrigins,
  options: ChatRealtimeAllowRequestOptions = {},
) {
  return (request: IncomingMessage, callback: (error: string | null, success: boolean) => void) => {
    const originAllowed = isChatRealtimeRequestOriginAllowed({
      requestOrigin: readSingleChatHeader(request.headers, 'origin'),
      allowedOrigins,
      host: readSingleChatHeader(request.headers, 'host'),
      forwardedHost: readSingleChatHeader(request.headers, 'x-forwarded-host'),
      forwardedProto: readSingleChatHeader(request.headers, 'x-forwarded-proto'),
      encrypted: Boolean((request.socket as TLSSocket | undefined)?.encrypted),
      peerAddress: request.socket?.remoteAddress,
      proxyProfile: options.proxyProfile,
    });
    if (!originAllowed) {
      callback(null, false);
      return;
    }
    callback(null, options.preAuthRateLimit ? options.preAuthRateLimit(request) : true);
  };
}

export function isChatRealtimeRequestOriginAllowed(input: ChatRealtimeOriginPolicyInput): boolean {
  const requestOrigin = normalizeOrigin(singleValue(input.requestOrigin));
  if (!requestOrigin) return false;
  if (input.allowedOrigins !== false) {
    return input.allowedOrigins.some((origin) => normalizeOrigin(origin) === requestOrigin);
  }
  let sameOrigin: string | null = null;
  if (input.proxyProfile?.enabled && input.proxyProfile.isTrustedPeer(input.peerAddress)) {
    const host = singleValue(input.forwardedHost);
    const proto = singleValue(input.forwardedProto);
    if (host && (proto === 'https' || proto === 'http')) sameOrigin = originFromHost(host, proto);
  }
  // Forwarded host/protocol form a single provenance pair: never mix one with local metadata.
  sameOrigin ??= originFromHost(singleValue(input.host), input.encrypted ? 'https' : 'http');
  return sameOrigin !== null && sameOrigin === requestOrigin;
}

function singleValue(value: HeaderValue): string | null {
  return typeof value === 'string' && value.trim() && !value.includes(',') ? value.trim() : null;
}

function originFromHost(host: string | null, proto: string): string | null {
  if (!host || /[\s/\\?#@]/u.test(host)) return null;
  return normalizeOrigin(`${proto}://${host}`);
}

function normalizeOrigin(origin: string | null): string | null {
  if (!origin || /[\s\\,]/u.test(origin)) return null;
  try {
    const parsed = new URL(origin);
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== '/' ||
      parsed.search ||
      parsed.hash
    )
      return null;
    return parsed.origin;
  } catch {
    return null;
  }
}
