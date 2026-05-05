import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ModerationModule } from '../common/moderation/moderation.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { CurrentSeasonParticipationController } from './current-season-participation.controller.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    PrismaModule,
    SeasonsModule,
    SeasonParticipantsModule,
    MatchesModule,
    AuthModule,
    ModerationModule,
  ],
  controllers: [UsersController, CurrentSeasonParticipationController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
