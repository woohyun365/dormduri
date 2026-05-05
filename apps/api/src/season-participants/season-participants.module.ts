import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma/prisma.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { SeasonParticipantsService } from './season-participants.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule],
  providers: [SeasonParticipantsService],
  exports: [SeasonParticipantsService],
})
export class SeasonParticipantsModule {}
