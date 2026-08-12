import type { Provider } from '@nestjs/common';
import chatRealtimeConfig from '../realtime/chat-realtime.config.js';
import { NOTIFICATION_REALTIME_PUBLISHER } from '../../notifications/application/ports/notification-realtime-publisher.port.js';
import { NOTIFICATION_OUTBOX_DISPATCHER_PROVIDERS } from '../../notifications/composition/notifications.providers.js';
import {
  REALTIME_DISPATCHER_CONFIG_PORT,
  REALTIME_DISPATCH_METRICS_PORT,
  REALTIME_METRICS_READER_PORT,
  REALTIME_USER_ROOM_PUBLISHER_PORT,
} from '../../realtime/realtime.tokens.js';
import { ChatNotificationRealtimePublisherAdapter } from '../adapters/chat-notification-realtime-publisher.adapter.js';
import { ChatService } from '../application/chat.service.js';
import { CHAT_BLOCK_SIDE_EFFECT_PORT } from '../application/ports/chat-block-side-effect.port.js';
import { CHAT_LIFECYCLE_SWEEP_PORT } from '../application/ports/chat-lifecycle-sweep.port.js';
import { CHAT_MATCH_THREAD_LIFECYCLE_PORT } from '../application/ports/chat-match-thread-lifecycle.port.js';
import { CHAT_REPORT_TARGET_CONTEXT_PORT } from '../application/ports/chat-report-target-context.port.js';
import { CHAT_THREAD_SEARCH_METADATA_READER_PORT } from '../application/ports/chat-thread-search-metadata-reader.port.js';
import { ChatThreadContextGuard } from '../context/chat-thread-context.guard.js';
import { ChatThreadContextResolver } from '../context/chat-thread-context.resolver.js';
import { ChatReportTargetContextResolver } from '../reports/chat-report-target-context.resolver.js';
import { ChatBlockSideEffectService } from '../lifecycle/chat-block-side-effect.service.js';
import { ConversationThreadLifecycleEventRepository } from '../lifecycle-events/conversation-thread-lifecycle-event.repository.js';
import { ConversationThreadLifecycleEventWriter } from '../lifecycle-events/conversation-thread-lifecycle-event.writer.js';
import { ChatMatchThreadLifecycleService } from '../lifecycle/chat-match-thread-lifecycle.service.js';
import { ChatSeasonLifecycleService } from '../lifecycle/chat-season-lifecycle.service.js';
import { ChatSubscriptionQueryService } from '../queries/chat-subscription-query.service.js';
import { ChatThreadSearchMetadataQuery } from '../queries/chat-thread-search-metadata.query.js';
import { ChatRealtimeAuthService } from '../realtime/chat-realtime-auth.service.js';
import { ChatRealtimeDispatcherService } from '../realtime/chat-realtime-dispatcher.service.js';
import { ChatRealtimeGateway } from '../realtime/chat-realtime.gateway.js';
import { ChatRealtimeMetricsService } from '../realtime/chat-realtime.metrics.js';
import { ChatRealtimePublisher } from '../realtime/chat-realtime-publisher.js';
import { ChatRealtimeRateLimiterService } from '../realtime/chat-realtime-rate-limiter.service.js';
import { ChatRealtimeTicketService } from '../realtime/chat-realtime-ticket.service.js';

export const CHAT_APPLICATION_PROVIDERS: Provider[] = [
  ChatService,
  ChatThreadContextGuard,
  ChatThreadContextResolver,
  ChatSubscriptionQueryService,
  ChatThreadSearchMetadataQuery,
  ChatReportTargetContextResolver,
  {
    provide: CHAT_REPORT_TARGET_CONTEXT_PORT,
    useExisting: ChatReportTargetContextResolver,
  },
  {
    provide: CHAT_THREAD_SEARCH_METADATA_READER_PORT,
    useExisting: ChatThreadSearchMetadataQuery,
  },
];

export const CHAT_LIFECYCLE_PROVIDERS: Provider[] = [
  ConversationThreadLifecycleEventRepository,
  ConversationThreadLifecycleEventWriter,
  ChatBlockSideEffectService,
  ChatMatchThreadLifecycleService,
  ChatSeasonLifecycleService,
  {
    provide: CHAT_BLOCK_SIDE_EFFECT_PORT,
    useExisting: ChatBlockSideEffectService,
  },
  {
    provide: CHAT_MATCH_THREAD_LIFECYCLE_PORT,
    useExisting: ChatMatchThreadLifecycleService,
  },
  {
    provide: CHAT_LIFECYCLE_SWEEP_PORT,
    useExisting: ChatSeasonLifecycleService,
  },
];

export const CHAT_NOTIFICATION_ADAPTER_PROVIDERS: Provider[] = [
  ChatNotificationRealtimePublisherAdapter,
  ...NOTIFICATION_OUTBOX_DISPATCHER_PROVIDERS,
  {
    provide: NOTIFICATION_REALTIME_PUBLISHER,
    useExisting: ChatNotificationRealtimePublisherAdapter,
  },
];

export const CHAT_REALTIME_PROVIDERS: Provider[] = [
  ChatRealtimeAuthService,
  ChatRealtimeDispatcherService,
  ChatRealtimeGateway,
  ChatRealtimeMetricsService,
  ChatRealtimePublisher,
  ChatRealtimeRateLimiterService,
  ChatRealtimeTicketService,
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
];

export const CHAT_PROVIDERS: Provider[] = [
  ...CHAT_APPLICATION_PROVIDERS,
  ...CHAT_LIFECYCLE_PROVIDERS,
  ...CHAT_NOTIFICATION_ADAPTER_PROVIDERS,
  ...CHAT_REALTIME_PROVIDERS,
];
