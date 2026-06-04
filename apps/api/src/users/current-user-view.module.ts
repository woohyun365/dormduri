import { Module } from '@nestjs/common';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { MatchesModule } from '../matches/matches.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { CurrentUserViewService } from './current-user-view.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule, SeasonParticipantsModule, MatchesModule],
  providers: [CurrentUserViewService],
  exports: [CurrentUserViewService],
})
export class CurrentUserViewModule {}
