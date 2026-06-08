import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatModule } from '../chat/chat.module.js';
import { ModerationModule } from '../moderation/moderation.module.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { SeasonParticipantsModule } from '../season-participants/season-participants.module.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { ActiveMatchContextGuard } from './active-match-context.guard.js';
import { MATCH_BLOCK_SIDE_EFFECT_PORT } from './application/ports/match-block-side-effect.port.js';
import { MatchBlockSideEffectService } from './lifecycle/match-block-side-effect.service.js';
import { MatchesController } from './matches.controller.js';
import { MatchesService } from './matches.service.js';

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
  providers: [
    MatchesService,
    ActiveMatchContextGuard,
    MatchBlockSideEffectService,
    {
      provide: MATCH_BLOCK_SIDE_EFFECT_PORT,
      useExisting: MatchBlockSideEffectService,
    },
  ],
  exports: [MatchesService, MATCH_BLOCK_SIDE_EFFECT_PORT],
})
export class MatchesModule {}
