import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import {
  readChatRealtimeAllowedOrigins,
  readChatRealtimeTrustProxy,
} from '../../config/chat-realtime.config.js';
import {
  CHAT_REALTIME_ERROR_EVENT_NAME,
  CHAT_REALTIME_NAMESPACE,
  CHAT_REALTIME_THREAD_SUBSCRIBE_EVENT,
  CHAT_REALTIME_THREAD_UNSUBSCRIBE_EVENT,
  chatRealtimeThreadRoom,
  chatRealtimeUserRoom,
} from './chat-realtime.constants.js';
import { createChatRealtimeAllowRequestIpRateLimiter } from './chat-realtime-allow-request-limiter.js';
import { ChatRealtimeAuthService } from './chat-realtime-auth.service.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';
import { createChatRealtimeAllowRequest } from './chat-realtime-origin-policy.js';
import { ChatRealtimePublisher } from './chat-realtime-publisher.js';
import {
  ChatRealtimeRateLimiterService,
  type ChatRealtimeRateLimitResult,
} from './chat-realtime-rate-limiter.service.js';

type ChatRealtimeSocketData = {
  authUser?: AuthenticatedUserContext;
  registeredRealtimeUserId?: string;
};

type ChatRealtimeSocket = Omit<Socket, 'data'> & {
  data: ChatRealtimeSocketData;
};

const allowedOrigins = readChatRealtimeAllowedOrigins();
const trustProxy = readChatRealtimeTrustProxy();
const preAuthIpRateLimit = createChatRealtimeAllowRequestIpRateLimiter();

@WebSocketGateway({
  namespace: CHAT_REALTIME_NAMESPACE,
  cors: {
    origin: allowedOrigins,
    credentials: false,
  },
  allowRequest: createChatRealtimeAllowRequest(allowedOrigins, {
    preAuthRateLimit: preAuthIpRateLimit,
    trustProxy,
  }),
})
export class ChatRealtimeGateway
  implements OnGatewayInit<Server>, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly authService: ChatRealtimeAuthService,
    private readonly publisher: ChatRealtimePublisher,
    private readonly metrics: ChatRealtimeMetricsService,
    private readonly rateLimiter: ChatRealtimeRateLimiterService,
  ) {}

  afterInit(server: Server) {
    this.publisher.bindServer(server);
  }

  async handleConnection(client: ChatRealtimeSocket) {
    const ipRateLimit = this.rateLimiter.consumeGatewayConnectIp({
      ip: this.rateLimiter.resolveRequestIp({
        headers: client.handshake.headers,
        ip: client.handshake.address,
      }),
    });
    if (!ipRateLimit.allowed) {
      this.disconnectRateLimited(client, ipRateLimit);
      return;
    }

    const authUser = await this.authService.consumeTicket(extractTicket(client));
    if (!authUser) {
      this.metrics.recordAuthFailure('ticket_invalid');
      client.emit(CHAT_REALTIME_ERROR_EVENT_NAME, {
        code: 'CHAT_REALTIME_UNAUTHENTICATED',
      });
      client.disconnect(true);
      return;
    }

    const userRateLimit = this.rateLimiter.consumeGatewayConnectUser({ userId: authUser.id });
    if (!userRateLimit.allowed) {
      this.disconnectRateLimited(client, userRateLimit);
      return;
    }

    const concurrentRateLimit = this.rateLimiter.tryRegisterUserSocket({ userId: authUser.id });
    if (!concurrentRateLimit.allowed) {
      this.disconnectRateLimited(client, concurrentRateLimit);
      return;
    }

    client.data.authUser = authUser;
    client.data.registeredRealtimeUserId = authUser.id;
    await Promise.resolve(client.join(chatRealtimeUserRoom(authUser.id)));
    this.metrics.recordSocketConnected();
  }

  handleDisconnect(client?: ChatRealtimeSocket) {
    const registeredUserId = client?.data.registeredRealtimeUserId;
    if (registeredUserId) {
      this.rateLimiter.unregisterUserSocket({ userId: registeredUserId });
      delete client.data.registeredRealtimeUserId;
    }

    this.metrics.recordSocketDisconnected();
  }

  @SubscribeMessage(CHAT_REALTIME_THREAD_SUBSCRIBE_EVENT)
  async subscribeThread(
    @ConnectedSocket() client: ChatRealtimeSocket,
    @MessageBody() payload: unknown,
  ) {
    const authUser = client.data.authUser;
    const threadId = parseThreadSubscribePayload(payload);

    if (!authUser || !threadId) {
      const rateLimit = this.rateLimiter.consumeThreadSubscription({
        socketId: resolveSocketId(client),
        failed: true,
      });
      if (!rateLimit.allowed) {
        this.disconnectRateLimited(client, rateLimit);
        return {
          ok: false,
          reason: 'RATE_LIMITED',
        };
      }

      this.metrics.recordSubscribeRejection('INVALID_REQUEST');
      return {
        ok: false,
        reason: 'INVALID_REQUEST',
      };
    }

    const allowed = await this.authService.canSubscribeThread(authUser, threadId);
    if (!allowed) {
      const rateLimit = this.rateLimiter.consumeThreadSubscription({
        socketId: resolveSocketId(client),
        failed: true,
      });
      if (!rateLimit.allowed) {
        this.disconnectRateLimited(client, rateLimit);
        return {
          ok: false,
          reason: 'RATE_LIMITED',
        };
      }

      this.metrics.recordSubscribeRejection('UNAUTHORIZED_THREAD');
      return {
        ok: false,
        reason: 'UNAUTHORIZED_THREAD',
      };
    }

    const rateLimit = this.rateLimiter.consumeThreadSubscription({
      socketId: resolveSocketId(client),
    });
    if (!rateLimit.allowed) {
      this.disconnectRateLimited(client, rateLimit);
      return {
        ok: false,
        reason: 'RATE_LIMITED',
      };
    }

    await Promise.resolve(client.join(chatRealtimeThreadRoom(threadId)));
    return {
      ok: true,
      threadId,
    };
  }

  @SubscribeMessage(CHAT_REALTIME_THREAD_UNSUBSCRIBE_EVENT)
  async unsubscribeThread(
    @ConnectedSocket() client: ChatRealtimeSocket,
    @MessageBody() payload: unknown,
  ) {
    const authUser = client.data.authUser;
    const threadId = parseThreadSubscribePayload(payload);

    if (!authUser || !threadId) {
      const rateLimit = this.rateLimiter.consumeThreadSubscription({
        socketId: resolveSocketId(client),
        failed: true,
      });
      if (!rateLimit.allowed) {
        this.disconnectRateLimited(client, rateLimit);
        return {
          ok: false,
          reason: 'RATE_LIMITED',
        };
      }

      return {
        ok: false,
        reason: 'INVALID_REQUEST',
      };
    }

    const rateLimit = this.rateLimiter.consumeThreadSubscription({
      socketId: resolveSocketId(client),
    });
    if (!rateLimit.allowed) {
      this.disconnectRateLimited(client, rateLimit);
      return {
        ok: false,
        reason: 'RATE_LIMITED',
      };
    }

    await Promise.resolve(client.leave(chatRealtimeThreadRoom(threadId)));
    return {
      ok: true,
      threadId,
    };
  }

  private disconnectRateLimited(
    client: Pick<Socket, 'disconnect' | 'emit'>,
    rateLimit: ChatRealtimeRateLimitResult,
  ) {
    this.metrics.recordRateLimitRejection(rateLimit.scope);
    client.emit(CHAT_REALTIME_ERROR_EVENT_NAME, {
      code: 'CHAT_REALTIME_RATE_LIMITED',
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    });
    client.disconnect(true);
  }
}

function extractTicket(client: Pick<Socket, 'handshake'>): string | null {
  const auth = client.handshake.auth as { ticket?: unknown } | undefined;
  const authTicket = auth?.ticket;
  if (typeof authTicket === 'string' && authTicket.trim().length > 0) {
    return authTicket;
  }

  return null;
}

function parseThreadSubscribePayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const threadId = (payload as { threadId?: unknown }).threadId;
  return typeof threadId === 'string' && threadId.trim().length > 0 ? threadId.trim() : null;
}

function resolveSocketId(client: Pick<Socket, 'id'>): string {
  return client.id || 'unknown';
}
