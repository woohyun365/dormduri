import type { IncomingMessage } from 'node:http';
import type { ConfigType } from '@nestjs/config';
import type chatRealtimeConfig from './chat-realtime.config.js';
import { resolveChatRealtimeRequestIp } from './chat-realtime-rate-limiter.service.js';

type Bucket = {
  count: number;
  windowStartMs: number;
};

export function createChatRealtimeAllowRequestIpRateLimiter(
  settings: Pick<
    ConfigType<typeof chatRealtimeConfig>,
    'proxyProfile' | 'wsConnectIpLimit' | 'wsConnectIpWindowMs'
  >,
  clock: () => number = () => Date.now(),
) {
  const buckets = new Map<string, Bucket>();

  return (request: IncomingMessage) => {
    const nowMs = clock();
    const ip = resolveChatRealtimeRequestIp(
      {
        headers: request.headers,
        peerAddress: request.socket.remoteAddress,
      },
      settings.proxyProfile,
    );
    const current = buckets.get(ip);
    const bucket =
      !current || nowMs - current.windowStartMs >= settings.wsConnectIpWindowMs
        ? { count: 0, windowStartMs: nowMs }
        : current;

    if (bucket.count >= settings.wsConnectIpLimit) {
      return false;
    }

    buckets.set(ip, {
      count: bucket.count + 1,
      windowStartMs: bucket.windowStartMs,
    });
    return true;
  };
}
