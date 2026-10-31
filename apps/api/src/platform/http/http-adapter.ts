import { NodeAdapter, type NodeTrustProxy } from '@nestjs/platform-node';
import type { HttpTrustProxy } from './http.config.js';

/**
 * Longest route parameter the adapter routes to a handler. It equals Node's default
 * `maxHeaderSize`, so any parameter that fits in an accepted request line reaches the
 * route's Zod binding and keeps the 400 envelope instead of the adapter's default 414.
 */
export const HTTP_MAX_PARAM_LENGTH = 16_384;

/**
 * Maps the HTTP trust-proxy env contract to the NodeAdapter option. A hop count becomes
 * a per-hop function that trusts that many proxies, as the earlier Express adapter did,
 * because NodeAdapter turns a bare number into a function that trusts no proxy.
 */
export function toNodeTrustProxy(trustProxy: HttpTrustProxy): NodeTrustProxy {
  if (trustProxy === false) {
    return false;
  }
  if (typeof trustProxy === 'number') {
    const hops = trustProxy;
    return (_address, hop) => hop < hops;
  }
  return [...trustProxy];
}

export function createHttpAdapter(trustProxy: HttpTrustProxy): NodeAdapter {
  return new NodeAdapter({
    maxParamLength: HTTP_MAX_PARAM_LENGTH,
    trustProxy: toNodeTrustProxy(trustProxy),
  });
}
