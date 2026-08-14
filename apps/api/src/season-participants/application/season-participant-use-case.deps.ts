import type { Prisma } from '../../generated/prisma/client.js';
import type { ChatThreadWithdrawalPort } from '../../chat/application/ports/chat-thread-withdrawal.port.js';
import type { DormitorySelectionCatalogPort } from '../../dormitories/selection-catalog/dormitory-selection-catalog.port.js';
import type { MatchParticipantWithdrawalPort } from '../../matches/application/ports/match-participant-withdrawal.port.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { SeasonContextPort } from '../../seasons/ports/season-context.port.js';
import type { SeasonProfileIntroModerationPort } from '../profile-draft/ports/season-profile-intro-moderation.port.js';

export interface SeasonParticipantUseCaseDeps {
  prisma: PrismaService;
  seasonsService: SeasonContextPort;
  dormitorySelectionCatalog: DormitorySelectionCatalogPort;
  chatThreadWithdrawal: ChatThreadWithdrawalPort;
  matchParticipantWithdrawal: MatchParticipantWithdrawalPort;
  seasonProfileIntroModeration: SeasonProfileIntroModerationPort;
}

export type DbClient = Prisma.TransactionClient | PrismaService;
