import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NOTIFICATION_REALTIME_PUBLISHER } from '../notifications/notifications.tokens.js';
import { NotificationOutboxDispatcherService } from '../notifications/outbox/notification-dispatcher.service.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { ChatNotificationRealtimePublisherAdapter } from './adapters/chat-notification-realtime-publisher.adapter.js';
import { ChatSubscriptionQueryService } from './queries/chat-subscription-query.service.js';
import { ChatController } from './chat.controller.js';
import { ChatRealtimeAuthService } from './realtime/chat-realtime-auth.service.js';
import { ChatRealtimeDispatcherService } from './realtime/chat-realtime-dispatcher.service.js';
import { ChatRealtimeGateway } from './realtime/chat-realtime.gateway.js';
import { ChatRealtimeMetricsService } from './realtime/chat-realtime.metrics.js';
import { ChatRealtimePublisher } from './realtime/chat-realtime-publisher.js';
import { ChatRealtimeRateLimiterService } from './realtime/chat-realtime-rate-limiter.service.js';
import { ChatRealtimeTicketService } from './realtime/chat-realtime-ticket.service.js';
import { ChatService } from './application/chat.service.js';
import { CHAT_LIFECYCLE_SWEEP_PORT } from './application/ports/chat-lifecycle-sweep.port.js';
import { CHAT_MATCH_THREAD_LIFECYCLE_PORT } from './application/ports/chat-match-thread-lifecycle.port.js';

@Module({
  imports: [PrismaModule, SeasonsModule, SeasonParticipantsModule, AuthModule, NotificationsModule],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatNotificationRealtimePublisherAdapter,
    ChatSubscriptionQueryService,
    ChatRealtimeAuthService,
    ChatRealtimeDispatcherService,
    ChatRealtimeGateway,
    ChatRealtimeMetricsService,
    ChatRealtimePublisher,
    ChatRealtimeRateLimiterService,
    ChatRealtimeTicketService,
    NotificationOutboxDispatcherService,
    {
      provide: NOTIFICATION_REALTIME_PUBLISHER,
      useExisting: ChatNotificationRealtimePublisherAdapter,
    },
    {
      provide: CHAT_MATCH_THREAD_LIFECYCLE_PORT,
      useExisting: ChatService,
    },
    {
      provide: CHAT_LIFECYCLE_SWEEP_PORT,
      useExisting: ChatService,
    },
  ],
  exports: [
    CHAT_MATCH_THREAD_LIFECYCLE_PORT,
    CHAT_LIFECYCLE_SWEEP_PORT,
    ChatRealtimeMetricsService,
  ],
})
export class ChatModule {}
