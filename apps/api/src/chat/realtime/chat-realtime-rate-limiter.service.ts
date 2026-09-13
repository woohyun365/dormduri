import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { normalizePeerIp } from '../../platform/http/trusted-proxy-peer.js';
import type { ChatRealtimeProxyProfile } from './chat-realtime.config.js';
import chatRealtimeConfig from './chat-realtime.config.js';
import { tooManyRequestsError } from '../../platform/http/api-error.js';

export type ChatRealtimeRateLimitScope =
  | 'chat:message:user'
  | 'chat:message:pair'
  | 'chat:message:burst'
  | 'chat:ticket:user'
  | 'chat:ticket:ip'
  | 'chat:ws:connect:ip'
  | 'chat:ws:connect:user'
  | 'chat:ws:connect:concurrent-user'
  | 'chat:ws:subscribe:socket'
  | 'chat:ws:subscribe:failure';

export type ChatRealtimeRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  scope: ChatRealtimeRateLimitScope;
};

type RateLimitSpec = {
  key: string;
  limit: number;
  scope: ChatRealtimeRateLimitScope;
  windowMs: number;
};

type Bucket = {
  count: number;
  windowStartMs: number;
};

export type ChatRequestPeer = {
  headers?: Record<string, string | string[] | undefined>;
  peerAddress?: string | null;
};

const DEFAULT_RETRY_AFTER_SECONDS = 1;

@Injectable()
export class ChatRealtimeRateLimiterService {
  private readonly buckets = new Map<string, Bucket>();
  private readonly userSocketCounts = new Map<string, number>();
  private clock = () => Date.now();

  constructor(
    @Inject(chatRealtimeConfig.KEY)
    private readonly settings: ConfigType<typeof chatRealtimeConfig>,
  ) {}

  setClockForTest(clock: () => number) {
    this.clock = clock;
  }

  resetForTest() {
    this.buckets.clear();
    this.userSocketCounts.clear();
    this.clock = () => Date.now();
  }

  consumeMessageSend(input: { targetUserId: string; userId: string }) {
    const pairKey = [input.userId, input.targetUserId].sort().join(':');
    return this.consumeAll([
      {
        key: `message:user:${input.userId}`,
        limit: this.settings.messageUserLimit,
        windowMs: this.settings.messageUserWindowMs,
        scope: 'chat:message:user',
      },
      {
        key: `message:pair:${pairKey}`,
        limit: this.settings.messagePairLimit,
        windowMs: this.settings.messagePairWindowMs,
        scope: 'chat:message:pair',
      },
      {
        key: `message:burst:${input.userId}`,
        limit: this.settings.messageBurstLimit,
        windowMs: this.settings.messageBurstWindowMs,
        scope: 'chat:message:burst',
      },
    ]);
  }

  consumeRealtimeTicket(input: { ip: string; userId: string }) {
    return this.consumeAll([
      {
        key: `ticket:user:${input.userId}`,
        limit: this.settings.ticketUserLimit,
        windowMs: this.settings.ticketUserWindowMs,
        scope: 'chat:ticket:user',
      },
      {
        key: `ticket:ip:${input.ip}`,
        limit: this.settings.ticketIpLimit,
        windowMs: this.settings.ticketIpWindowMs,
        scope: 'chat:ticket:ip',
      },
    ]);
  }

  consumeGatewayConnectIp(input: { ip: string }) {
    return this.consumeAll([
      {
        key: `ws:connect:ip:${input.ip}`,
        limit: this.settings.wsConnectIpLimit,
        windowMs: this.settings.wsConnectIpWindowMs,
        scope: 'chat:ws:connect:ip',
      },
    ]);
  }

  consumeGatewayConnectUser(input: { userId: string }) {
    return this.consumeAll([
      {
        key: `ws:connect:user:${input.userId}`,
        limit: this.settings.wsConnectUserLimit,
        windowMs: this.settings.wsConnectUserWindowMs,
        scope: 'chat:ws:connect:user',
      },
    ]);
  }

  tryRegisterUserSocket(input: { userId: string }): ChatRealtimeRateLimitResult {
    const currentCount = this.userSocketCounts.get(input.userId) ?? 0;
    if (currentCount >= this.settings.wsConcurrentUserLimit) {
      return {
        allowed: false,
        retryAfterSeconds: DEFAULT_RETRY_AFTER_SECONDS,
        scope: 'chat:ws:connect:concurrent-user',
      };
    }

    this.userSocketCounts.set(input.userId, currentCount + 1);
    return {
      allowed: true,
      retryAfterSeconds: 0,
      scope: 'chat:ws:connect:concurrent-user',
    };
  }

  unregisterUserSocket(input: { userId: string }) {
    const currentCount = this.userSocketCounts.get(input.userId) ?? 0;
    if (currentCount <= 1) {
      this.userSocketCounts.delete(input.userId);
      return;
    }

    this.userSocketCounts.set(input.userId, currentCount - 1);
  }

  getUserSocketCountForTest(userId: string) {
    return this.userSocketCounts.get(userId) ?? 0;
  }

  resolveRequestIp(source: ChatRequestPeer | undefined): string {
    return resolveChatRealtimeRequestIp(source, this.settings.proxyProfile);
  }

  consumeThreadSubscription(input: { failed?: boolean; socketId: string }) {
    const specs: RateLimitSpec[] = [
      {
        key: `ws:subscribe:socket:${input.socketId}`,
        limit: this.settings.wsSubscribeSocketLimit,
        windowMs: this.settings.wsSubscribeSocketWindowMs,
        scope: 'chat:ws:subscribe:socket',
      },
    ];

    if (input.failed) {
      specs.push({
        key: `ws:subscribe:failure:${input.socketId}`,
        limit: this.settings.wsSubscribeFailureLimit,
        windowMs: this.settings.wsSubscribeFailureWindowMs,
        scope: 'chat:ws:subscribe:failure',
      });
    }

    return this.consumeAll(specs);
  }

  private consumeAll(specs: RateLimitSpec[]): ChatRealtimeRateLimitResult {
    const nowMs = this.clock();
    const snapshots = specs.map((spec) => ({ spec, bucket: this.resolveBucket(spec, nowMs) }));
    const denied = snapshots.find(({ spec, bucket }) => bucket.count >= spec.limit);

    if (denied) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          DEFAULT_RETRY_AFTER_SECONDS,
          Math.ceil((denied.bucket.windowStartMs + denied.spec.windowMs - nowMs) / 1_000),
        ),
        scope: denied.spec.scope,
      };
    }

    for (const { spec, bucket } of snapshots) {
      this.buckets.set(spec.key, {
        windowStartMs: bucket.windowStartMs,
        count: bucket.count + 1,
      });
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      scope: specs[0]?.scope ?? 'chat:message:user',
    };
  }

  private resolveBucket(spec: RateLimitSpec, nowMs: number): Bucket {
    const current = this.buckets.get(spec.key);
    if (!current || nowMs - current.windowStartMs >= spec.windowMs) {
      return {
        windowStartMs: nowMs,
        count: 0,
      };
    }

    return current;
  }
}

export function throwChatRealtimeRateLimitError(result: ChatRealtimeRateLimitResult): never {
  throw tooManyRequestsError(
    'CHAT_REALTIME_RATE_LIMITED',
    '채팅 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    {
      retryAfterSeconds: result.retryAfterSeconds,
      scope: result.scope,
    },
  );
}

export function resolveChatRealtimeRequestIp(
  source: ChatRequestPeer | undefined,
  profile?: ChatRealtimeProxyProfile,
): string {
  const peer = normalizePeerIp(source?.peerAddress);
  if (!peer) return 'unknown';
  if (profile?.enabled && profile.isTrustedPeer(peer)) {
    const forwarded = normalizePeerIp(readSingleChatHeader(source?.headers, 'x-forwarded-for'));
    if (forwarded) return forwarded;
  }
  return peer;
}

/** Reject competing spellings and wire-level duplicates (Node joins those with commas). */
export function readSingleChatHeader(
  headers: ChatRequestPeer['headers'],
  name: string,
): string | undefined {
  const entries = Object.entries(headers ?? {}).filter(([key]) => key.toLowerCase() === name);
  if (entries.length !== 1) return undefined;
  const value = entries[0]?.[1];
  return typeof value === 'string' && !value.includes(',') ? value.trim() : undefined;
}
