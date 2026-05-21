import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ModerationModule } from '../common/moderation/moderation.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from './current-season-participation.controller.js';
import { CurrentUserViewModule } from './current-user-view.module.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    PrismaModule,
    SeasonsModule,
    SeasonParticipantsModule,
    CurrentUserViewModule,
    AuthModule,
    ModerationModule,
  ],
  controllers: [
    UsersController,
    CurrentSeasonParticipationController,
    CurrentSeasonProfileController,
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
