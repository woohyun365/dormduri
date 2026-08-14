import type { IncomingMessage } from 'node:http';
import {
  readChatRealtimeTrustProxy,
  readChatRealtimeWsConnectIpRateLimit,
} from './chat-realtime.config.js';
import { resolveChatRealtimeRequestIp } from './chat-realtime-rate-limiter.service.js';

type Bucket = {
  count: number;
  windowStartMs: number;
};

export function createChatRealtimeAllowRequestIpRateLimiter(
  env: NodeJS.ProcessEnv = process.env,
  clock: () => number = () => Date.now(),
) {
  const settings = readChatRealtimeWsConnectIpRateLimit(env);
  const trustProxy = readChatRealtimeTrustProxy(env);
  const buckets = new Map<string, Bucket>();

  return (request: IncomingMessage) => {
    const nowMs = clock();
    const ip = resolveChatRealtimeRequestIp(
      {
        headers: request.headers,
        socket: {
          remoteAddress: request.socket.remoteAddress,
        },
      },
      { trustProxy },
    );
    const current = buckets.get(ip);
    const bucket =
      !current || nowMs - current.windowStartMs >= settings.windowMs
        ? { count: 0, windowStartMs: nowMs }
        : current;

    if (bucket.count >= settings.limit) {
      return false;
    }

    buckets.set(ip, {
      count: bucket.count + 1,
      windowStartMs: bucket.windowStartMs,
    });
    return true;
  };
}
