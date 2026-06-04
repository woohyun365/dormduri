import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatLifecycleModule } from '../chat/lifecycle/chat-lifecycle.module.js';
import {
  CHAT_THREAD_WITHDRAWAL_PORT,
  type ChatThreadWithdrawalPort,
} from '../chat/application/ports/chat-thread-withdrawal.port.js';
import { PrismaModule } from '../platform/database/prisma.module.js';
import { PrismaService } from '../platform/database/prisma.service.js';
import { DormitoriesModule } from '../dormitories/dormitories.module.js';
import {
  DORMITORY_SELECTION_CATALOG_PORT,
  type DormitorySelectionCatalogPort,
} from '../dormitories/selection-catalog/dormitory-selection-catalog.port.js';
import { SeasonsModule } from '../seasons/seasons.module.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import {
  SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER,
  SEASON_PARTICIPANT_SOURCE_OWNER,
  SEASON_PARTICIPANT_WRITE_OWNER,
} from './application/season-participant-use-case.tokens.js';
import {
  CurrentSeasonParticipationController,
  CurrentSeasonProfileController,
} from './current-season-participation.controller.js';
import { CurrentSeasonParticipantContextGuard } from './current-season-participant-context.guard.js';
import { CurrentSeasonParticipationViewOwner } from './current-season-participation-view.owner.js';
import { createSeasonParticipantPublicTargetOwner } from './season-participant-public-target.owner.js';
import { createSeasonParticipantSourceOwner } from './season-participant-source-owner.js';
import { createSeasonParticipantWriteOwner } from './season-participant-write-owner.js';
import { SeasonParticipantsService } from './season-participants.service.js';

@Module({
  imports: [PrismaModule, SeasonsModule, DormitoriesModule, AuthModule, ChatLifecycleModule],
  controllers: [CurrentSeasonProfileController, CurrentSeasonParticipationController],
  providers: [
    SeasonParticipantsService,
    CurrentSeasonParticipationViewOwner,
    CurrentSeasonParticipantContextGuard,
    {
      provide: SEASON_PARTICIPANT_WRITE_OWNER,
      useFactory: (
        prisma: PrismaService,
        seasonsService: SeasonsService,
        dormitorySelectionCatalog: DormitorySelectionCatalogPort,
        chatThreadWithdrawal: ChatThreadWithdrawalPort,
      ) =>
        createSeasonParticipantWriteOwner({
          prisma,
          seasonsService,
          dormitorySelectionCatalog,
          chatThreadWithdrawal,
        }),
      inject: [
        PrismaService,
        SeasonsService,
        DORMITORY_SELECTION_CATALOG_PORT,
        CHAT_THREAD_WITHDRAWAL_PORT,
      ],
    },
    {
      provide: SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER,
      useFactory: (prisma: PrismaService) => createSeasonParticipantPublicTargetOwner(prisma),
      inject: [PrismaService],
    },
    {
      provide: SEASON_PARTICIPANT_SOURCE_OWNER,
      useFactory: createSeasonParticipantSourceOwner,
    },
  ],
  exports: [
    SeasonParticipantsService,
    CurrentSeasonParticipationViewOwner,
    CurrentSeasonParticipantContextGuard,
  ],
})
export class SeasonParticipantsModule {}
