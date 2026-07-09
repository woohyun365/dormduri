import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../platform/database/prisma.service.js';
import type { EnforcementNoticeListCursor } from '../queries/enforcement-notice-list.cursor.js';

export const enforcementNoticeParticipantSelect = {
  id: true,
  userId: true,
  seasonId: true,
  dormitoryId: true,
  hiddenByAdminAt: true,
  hiddenReasonCode: true,
  hiddenReasonDetail: true,
  deactivatedAt: true,
  createdAt: true,
  updatedAt: true,
  season: {
    select: {
      id: true,
      name: true,
      academicYear: true,
      semester: true,
      seasonEndDate: true,
    },
  },
  dormitory: {
    select: {
      id: true,
      nameKo: true,
    },
  },
} as const;

export type EnforcementNoticeProjectionRecord = Prisma.SeasonParticipantGetPayload<{
  select: typeof enforcementNoticeParticipantSelect;
}>;

export type EnforcementNoticeRepositoryClient = Pick<Prisma.TransactionClient, 'seasonParticipant'>;

@Injectable()
export class EnforcementNoticeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForUser(input: {
    userId: string;
    cursor: EnforcementNoticeListCursor | null;
    limit: number;
  }): Promise<EnforcementNoticeProjectionRecord[]> {
    return this.prisma.seasonParticipant.findMany({
      where: {
        userId: input.userId,
        OR: [{ hiddenByAdminAt: { not: null } }, { deactivatedAt: { not: null } }],
        ...(input.cursor ? cursorWhere(input.cursor) : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: input.limit + 1,
      select: enforcementNoticeParticipantSelect,
    });
  }

  findOwnedByNoticeId(input: {
    client: EnforcementNoticeRepositoryClient;
    enforcementNoticeId: string;
    userId: string;
  }): Promise<{ id: string } | null> {
    const participantId = parseParticipantNoticeId(input.enforcementNoticeId);
    if (!participantId) return Promise.resolve(null);

    return input.client.seasonParticipant.findFirst({
      where: {
        id: participantId,
        userId: input.userId,
        OR: [{ hiddenByAdminAt: { not: null } }, { deactivatedAt: { not: null } }],
      },
      select: { id: true },
    });
  }
}

export function toEnforcementNoticeId(participantId: string): string {
  return `season-participant:${participantId}`;
}

function parseParticipantNoticeId(value: string): string | null {
  const prefix = 'season-participant:';
  if (!value.startsWith(prefix)) return null;
  const participantId = value.slice(prefix.length).trim();
  return participantId.length > 0 ? participantId : null;
}

function cursorWhere(cursor: EnforcementNoticeListCursor): Prisma.SeasonParticipantWhereInput {
  return {
    OR: [
      { updatedAt: { lt: cursor.updatedAt } },
      { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
    ],
  };
}
