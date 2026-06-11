import type { Provider } from '@nestjs/common';
import {
  CHAT_THREAD_WITHDRAWAL_PORT,
  type ChatThreadWithdrawalPort,
} from '../../chat/application/ports/chat-thread-withdrawal.port.js';
import {
  DORMITORY_SELECTION_CATALOG_PORT,
  type DormitorySelectionCatalogPort,
} from '../../dormitories/selection-catalog/dormitory-selection-catalog.port.js';
import {
  MATCH_PARTICIPANT_WITHDRAWAL_PORT,
  type MatchParticipantWithdrawalPort,
} from '../../matches/application/ports/match-participant-withdrawal.port.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  SEASON_CONTEXT_PORT,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { CurrentSeasonParticipationViewQuery } from '../application/current-season-participation-view.query.js';
import {
  SEASON_PARTICIPANT_PUBLIC_TARGET_OWNER,
  SEASON_PARTICIPANT_SOURCE_OWNER,
  SEASON_PARTICIPANT_WRITE_OWNER,
} from '../application/season-participant-use-case.tokens.js';
import { createSeasonParticipantWriteOwner } from '../application/season-participant-write-owner.js';
import { SeasonParticipantsService } from '../application/season-participants.service.js';
import { CurrentSeasonParticipantContextGuard } from '../context/current-season-participant-context.guard.js';
import { CurrentSeasonParticipantContextResolver } from '../context/current-season-participant-context.resolver.js';
import { createSeasonParticipantSourceOwner } from '../participants/season-participant-source.policy.js';
import { createSeasonParticipantPublicTargetOwner } from '../public-targets/registration-snapshot.query.js';

export const SEASON_PARTICIPANTS_PROVIDERS: Provider[] = [
  SeasonParticipantsService,
  CurrentSeasonParticipationViewQuery,
  CurrentSeasonParticipantContextResolver,
  CurrentSeasonParticipantContextGuard,
  {
    provide: SEASON_PARTICIPANT_WRITE_OWNER,
    useFactory: (
      prisma: PrismaService,
      seasonContextPort: SeasonContextPort,
      dormitorySelectionCatalog: DormitorySelectionCatalogPort,
      chatThreadWithdrawal: ChatThreadWithdrawalPort,
      matchParticipantWithdrawal: MatchParticipantWithdrawalPort,
    ) =>
      createSeasonParticipantWriteOwner({
        prisma,
        seasonsService: seasonContextPort,
        dormitorySelectionCatalog,
        chatThreadWithdrawal,
        matchParticipantWithdrawal,
      }),
    inject: [
      PrismaService,
      SEASON_CONTEXT_PORT,
      DORMITORY_SELECTION_CATALOG_PORT,
      CHAT_THREAD_WITHDRAWAL_PORT,
      MATCH_PARTICIPANT_WITHDRAWAL_PORT,
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
];
