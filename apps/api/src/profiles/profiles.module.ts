import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { PROFILES_EXPORTS, PROFILES_PROVIDERS } from './composition/profiles.providers.js';
import { ProfilesController } from './profiles.controller.js';
import { RoommateSearchController } from './roommate-search.controller.js';

@Module({
  imports: [PrismaModule, SeasonsModule, SeasonParticipantsModule, MatchesModule, AuthModule],
  controllers: [ProfilesController, RoommateSearchController],
  providers: PROFILES_PROVIDERS,
  exports: PROFILES_EXPORTS,
})
export class ProfilesModule {}
