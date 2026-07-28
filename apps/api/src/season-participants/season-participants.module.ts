import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatLifecycleModule } from '../chat/lifecycle/chat-lifecycle.module.js';
import { DormitoriesModule } from '../dormitories/dormitories.module.js';
import { MatchLifecycleModule } from '../matches/lifecycle/match-lifecycle.module.js';
import { ModerationModule } from '../moderation/moderation.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { SEASON_PARTICIPANTS_EXPORTS } from './composition/season-participants.exports.js';
import { SEASON_PARTICIPANTS_PROVIDERS } from './composition/season-participants.providers.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
  PreviousSeasonProfileController,
  SeasonProfileHistoryController,
} from './current-season-participation.controller.js';

@Module({
  imports: [
    PrismaModule,
    SeasonsModule,
    DormitoriesModule,
    AuthModule,
    ChatLifecycleModule,
    MatchLifecycleModule,
    ModerationModule,
  ],
  controllers: [
    CurrentSeasonProfileController,
    PreviousSeasonProfileController,
    SeasonProfileHistoryController,
    CurrentSeasonParticipationController,
  ],
  providers: SEASON_PARTICIPANTS_PROVIDERS,
  exports: SEASON_PARTICIPANTS_EXPORTS,
})
export class SeasonParticipantsModule {}
