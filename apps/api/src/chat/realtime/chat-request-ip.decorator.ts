import type { IncomingMessage } from 'node:http';
import {
  createParamDecorator,
  Injectable,
  type ExecutionContext,
  type PipeTransform,
} from '@nestjs/common';
import { ChatRealtimeRateLimiterService } from './chat-realtime-rate-limiter.service.js';

type RequestIpSource = Parameters<ChatRealtimeRateLimiterService['resolveRequestIp']>[0];

@Injectable()
class ChatRequestIpPipe implements PipeTransform<RequestIpSource, string> {
  constructor(private readonly rateLimiter: ChatRealtimeRateLimiterService) {}

  transform(request: RequestIpSource): string {
    return this.rateLimiter.resolveRequestIp(request);
  }
}

const RequestIp = createParamDecorator(
  (_data: unknown, context: ExecutionContext): RequestIpSource => {
    const request = context.switchToHttp().getRequest<IncomingMessage>();
    return { headers: request.headers, peerAddress: request.socket.remoteAddress };
  },
);

// Reuse the configured realtime IP policy; HTTP trust-proxy is a separate setting.
export const ChatRequestIp = () => RequestIp(ChatRequestIpPipe);
