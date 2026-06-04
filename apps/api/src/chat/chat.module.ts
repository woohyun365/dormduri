import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import chatRealtimeConfig from '../config/chat-realtime.config.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { NOTIFICATION_REALTIME_PUBLISHER } from '../notifications/notifications.tokens.js';
import { NotificationOutboxDispatcherService } from '../notifications/outbox/notification-dispatcher.service.js';
import {
  REALTIME_DISPATCHER_CONFIG_PORT,
  REALTIME_DISPATCH_METRICS_PORT,
  REALTIME_METRICS_READER_PORT,
  REALTIME_USER_ROOM_PUBLISHER_PORT,
} from '../realtime/realtime.tokens.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { ChatNotificationRealtimePublisherAdapter } from './adapters/chat-notification-realtime-publisher.adapter.js';
import { ChatSubscriptionQueryService } from './queries/chat-subscription-query.service.js';
import { ChatController } from './chat.controller.js';
import { ChatThreadContextGuard } from './context/chat-thread-context.guard.js';
import { ChatThreadContextResolver } from './context/chat-thread-context.resolver.js';
import { ChatLifecycleModule } from './lifecycle/chat-lifecycle.module.js';
import { ChatMatchThreadLifecycleService } from './lifecycle/chat-match-thread-lifecycle.service.js';
import { ChatSeasonLifecycleService } from './lifecycle/chat-season-lifecycle.service.js';
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
  imports: [
    PrismaModule,
    SeasonsModule,
    SeasonParticipantsModule,
    AuthModule,
    NotificationsModule,
    ChatLifecycleModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ChatThreadContextGuard,
    ChatThreadContextResolver,
    ChatMatchThreadLifecycleService,
    ChatSeasonLifecycleService,
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
      useExisting: ChatMatchThreadLifecycleService,
    },
    {
      provide: CHAT_LIFECYCLE_SWEEP_PORT,
      useExisting: ChatSeasonLifecycleService,
    },
    {
      provide: REALTIME_DISPATCHER_CONFIG_PORT,
      useExisting: chatRealtimeConfig.KEY,
    },
    {
      provide: REALTIME_DISPATCH_METRICS_PORT,
      useExisting: ChatRealtimeMetricsService,
    },
    {
      provide: REALTIME_METRICS_READER_PORT,
      useExisting: ChatRealtimeMetricsService,
    },
    {
      provide: REALTIME_USER_ROOM_PUBLISHER_PORT,
      useExisting: ChatRealtimePublisher,
    },
  ],
  exports: [
    CHAT_MATCH_THREAD_LIFECYCLE_PORT,
    CHAT_LIFECYCLE_SWEEP_PORT,
    ChatLifecycleModule,
    REALTIME_DISPATCHER_CONFIG_PORT,
    REALTIME_DISPATCH_METRICS_PORT,
    REALTIME_METRICS_READER_PORT,
    REALTIME_USER_ROOM_PUBLISHER_PORT,
  ],
})
export class ChatModule {}
