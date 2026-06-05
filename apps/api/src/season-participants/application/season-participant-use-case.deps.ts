import type { Prisma } from '../../generated/prisma/client.js';
import type { ChatThreadWithdrawalPort } from '../../chat/application/ports/chat-thread-withdrawal.port.js';
import type { DormitorySelectionCatalogPort } from '../../dormitories/selection-catalog/dormitory-selection-catalog.port.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import type { SeasonsService } from '../../seasons/seasons.service.js';

export interface SeasonParticipantUseCaseDeps {
  prisma: PrismaService;
  seasonsService: SeasonsService;
  dormitorySelectionCatalog: DormitorySelectionCatalogPort;
  chatThreadWithdrawal: ChatThreadWithdrawalPort;
}

export type DbClient = Prisma.TransactionClient | PrismaService;
