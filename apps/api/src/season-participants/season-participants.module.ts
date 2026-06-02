import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatLifecycleModule } from '../chat/lifecycle/chat-lifecycle.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { DormitoriesModule } from '../dormitories/dormitories.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from './current-season-participation.controller.js';
import { CurrentSeasonParticipationViewOwner } from './current-season-participation-view.owner.js';
import { SeasonParticipantsService } from './season-participants.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule, DormitoriesModule, AuthModule, ChatLifecycleModule],
  controllers: [CurrentSeasonProfileController, CurrentSeasonParticipationController],
  providers: [SeasonParticipantsService, CurrentSeasonParticipationViewOwner],
  exports: [SeasonParticipantsService, CurrentSeasonParticipationViewOwner],
})
export class SeasonParticipantsModule {}
