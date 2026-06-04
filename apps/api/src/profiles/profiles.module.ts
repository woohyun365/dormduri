import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { ProfilesController } from './profiles.controller.js';
import { ProfilesService } from './profiles.service.js';
import { RoommateSearchController } from './roommate-search.controller.js';
import { RoommateSearchService } from './roommate-search.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule, SeasonParticipantsModule, MatchesModule, AuthModule],
  controllers: [ProfilesController, RoommateSearchController],
  providers: [ProfilesService, RoommateSearchService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
