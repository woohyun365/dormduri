import type { INestApplicationContext } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { Server, ServerOptions } from 'socket.io';
import type chatRealtimeConfig from './chat-realtime.config.js';
import { createChatRealtimeAllowRequestIpRateLimiter } from './chat-realtime-allow-request-limiter.js';
import { createChatRealtimeAllowRequest } from './chat-realtime-origin-policy.js';

/** The one realtime root server shares the DI snapshot, not gateway import-time env. */
export class ChatRealtimeIoAdapter extends IoAdapter {
  private readonly boundaryOptions: Partial<ServerOptions>;

  constructor(app: INestApplicationContext, settings: ConfigType<typeof chatRealtimeConfig>) {
    super(app);
    this.boundaryOptions = {
      cors: {
        origin: settings.allowedOrigins === false ? false : [...settings.allowedOrigins],
        credentials: false,
      },
      allowRequest: createChatRealtimeAllowRequest(settings.allowedOrigins, {
        proxyProfile: settings.proxyProfile,
        preAuthRateLimit: createChatRealtimeAllowRequestIpRateLimiter(settings),
      }),
    };
  }

  override createIOServer(port: number, options?: Partial<ServerOptions>): Server {
    // Nest creates the root before its namespace; do not predicate this on namespace.
    // Nest may pass no options; Socket.IO's Server takes partial options although IoAdapter types them in full.
    return super.createIOServer(port, { ...options, ...this.boundaryOptions } as ServerOptions);
  }
}
