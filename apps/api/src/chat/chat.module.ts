import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { MetricsModule } from '../platform/observability/metrics/metrics.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { ChatController } from './chat.controller.js';
import { CHAT_EXPORTS } from './composition/chat.exports.js';
import { CHAT_PROVIDERS } from './composition/chat.providers.js';
import { ChatLifecycleModule } from './lifecycle/chat-lifecycle.module.js';

@Module({
  imports: [
    PrismaModule,
    MetricsModule,
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
