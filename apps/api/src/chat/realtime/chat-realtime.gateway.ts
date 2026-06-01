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
import type { AuthenticatedUserContext } from '../../auth/auth-session.service.js';
import { readChatRealtimeAllowedOrigins } from '../../config/chat-realtime.config.js';
import {
  CHAT_REALTIME_ERROR_EVENT_NAME,
  CHAT_REALTIME_NAMESPACE,
  CHAT_REALTIME_THREAD_SUBSCRIBE_EVENT,
  CHAT_REALTIME_THREAD_UNSUBSCRIBE_EVENT,
  chatRealtimeThreadRoom,
  chatRealtimeUserRoom,
} from './chat-realtime.constants.js';
import { ChatRealtimeAuthService } from './chat-realtime-auth.service.js';
import { ChatRealtimeMetricsService } from './chat-realtime.metrics.js';
import { createChatRealtimeAllowRequest } from './chat-realtime-origin-policy.js';
import { ChatRealtimePublisher } from './chat-realtime-publisher.js';

type ChatRealtimeSocketData = {
  authUser?: AuthenticatedUserContext;
};

type ChatRealtimeSocket = Omit<Socket, 'data'> & {
  data: ChatRealtimeSocketData;
};

const allowedOrigins = readChatRealtimeAllowedOrigins();

@WebSocketGateway({
  namespace: CHAT_REALTIME_NAMESPACE,
  cors: {
    origin: allowedOrigins,
    credentials: false,
  },
  allowRequest: createChatRealtimeAllowRequest(allowedOrigins),
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
  ) {}

  afterInit(server: Server) {
    this.publisher.bindServer(server);
  }

  async handleConnection(client: ChatRealtimeSocket) {
    const authUser = await this.authService.consumeTicket(extractTicket(client));
    if (!authUser) {
      client.emit(CHAT_REALTIME_ERROR_EVENT_NAME, {
        code: 'CHAT_REALTIME_UNAUTHENTICATED',
      });
      client.disconnect(true);
      return;
    }

    client.data.authUser = authUser;
    await Promise.resolve(client.join(chatRealtimeUserRoom(authUser.id)));
    this.metrics.recordSocketConnected();
  }

  handleDisconnect() {
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
      return {
        ok: false,
        reason: 'INVALID_REQUEST',
      };
    }

    const allowed = await this.authService.canSubscribeThread(authUser, threadId);
    if (!allowed) {
      return {
        ok: false,
        reason: 'UNAUTHORIZED_THREAD',
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
      return {
        ok: false,
        reason: 'INVALID_REQUEST',
      };
    }

    await Promise.resolve(client.leave(chatRealtimeThreadRoom(threadId)));
    return {
      ok: true,
      threadId,
    };
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
