import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { DormitoriesModule } from '../dormitories/dormitories.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from './current-season-participation.controller.js';
import { SeasonParticipantsService } from './season-participants.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule, DormitoriesModule, AuthModule],
  controllers: [CurrentSeasonProfileController, CurrentSeasonParticipationController],
  providers: [SeasonParticipantsService],
  exports: [SeasonParticipantsService],
})
export class SeasonParticipantsModule {}
