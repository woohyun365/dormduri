import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { ModerationModule } from '../moderation/moderation.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { MATCHES_EXPORTS } from './composition/matches.exports.js';
import { MATCHES_PROVIDERS } from './composition/matches.providers.js';
import { MatchesController } from './matches.controller.js';

@Module({
  imports: [
    PrismaModule,
    SeasonsModule,
    SeasonParticipantsModule,
    ChatModule,
    ModerationModule,
    AuthModule,
  ],
  controllers: [MatchesController],
  providers: MATCHES_PROVIDERS,
  exports: MATCHES_EXPORTS,
})
export class MatchesModule {}
