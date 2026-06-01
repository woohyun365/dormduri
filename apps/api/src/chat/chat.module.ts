import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { ChatController } from './chat.controller.js';
import { ChatRealtimeAuthService } from './realtime/chat-realtime-auth.service.js';
import { ChatRealtimeDispatcherService } from './realtime/chat-realtime-dispatcher.service.js';
import { ChatRealtimeGateway } from './realtime/chat-realtime.gateway.js';
import { ChatRealtimeMetricsService } from './realtime/chat-realtime.metrics.js';
import { ChatRealtimePublisher } from './realtime/chat-realtime-publisher.js';
import { ChatRealtimeRateLimiterService } from './realtime/chat-realtime-rate-limiter.service.js';
import { ChatRealtimeTicketService } from './realtime/chat-realtime-ticket.service.js';
import { ChatService } from './chat.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule, SeasonParticipantsModule, AuthModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatRealtimeAuthService,
    ChatRealtimeDispatcherService,
    ChatRealtimeGateway,
    ChatRealtimeMetricsService,
    ChatRealtimePublisher,
    ChatRealtimeRateLimiterService,
    ChatRealtimeTicketService,
  ],
  exports: [ChatService],
})
export class ChatModule {}
