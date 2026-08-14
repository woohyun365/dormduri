import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { DomainMetricDefinitionsModule } from '../platform/observability/metrics/domain-metric-definitions.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { ChatController } from './chat.controller.js';
import { CHAT_EXPORTS } from './composition/chat.exports.js';
import { CHAT_PROVIDERS } from './composition/chat.providers.js';
import { ChatLifecycleModule } from './lifecycle/chat-lifecycle.module.js';
import { CHAT_REALTIME_METRIC_DEFINITIONS } from './realtime/chat-realtime-metric.definitions.js';

@Module({
  imports: [
    PrismaModule,
    DomainMetricDefinitionsModule.register('chat/realtime', CHAT_REALTIME_METRIC_DEFINITIONS),
    SeasonsModule,
    SeasonParticipantsModule,
    AuthModule,
    NotificationsModule,
    ChatLifecycleModule,
  ],
  controllers: [ChatController],
  providers: CHAT_PROVIDERS,
  exports: CHAT_EXPORTS,
})
export class ChatModule {}
