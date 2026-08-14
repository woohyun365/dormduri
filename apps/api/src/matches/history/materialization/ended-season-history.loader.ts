import { formatKstDate } from '../../../platform/time/kst-date.js';
import type { Prisma, PrismaClient } from '../../../generated/prisma/client.js';
import type { PrismaService } from '../../../platform/database/prisma.service.js';
import {
  lifestyleColumnSelect,
  type LifestyleColumns,
} from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';

export interface SeasonHistoryProfileSnapshot extends LifestyleColumns {
  participantId: string;
  nicknameSnapshot: string;
}

export interface SeasonHistorySource {
  id: string;
  name: string;
  seasonEndDate: Date;
  participants: Array<{
    id: string;
    userId: string;
    participationIntent: 'UNDECIDED' | 'REGISTERED' | 'DECLINED';
    registeredAt: Date | null;
    declinedAt: Date | null;
    participantStatus: 'NOT_STARTED' | 'DRAFT' | 'ACTIVE' | 'MATCHED' | 'WITHDRAWN' | 'EXPIRED';
    dormitoryId: string | null;
    dormitorySelectionState: 'NOT_SELECTED' | 'SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
    hiddenByAdminAt: Date | null;
    deactivatedAt: Date | null;
    profile: SeasonHistoryProfileSnapshot | null;
  }>;
  matchRequests: Array<{
    id: string;
    requesterParticipantId: string;
    receiverParticipantId: string;
    status:
      | 'PENDING'
      | 'ACCEPTED'
      | 'REJECTED'
      | 'CANCELLED_BY_REQUESTER'
      | 'CANCELLED_BY_SYSTEM'
      | 'EXPIRED';
    terminalReason:
      | 'ACCEPTED'
      | 'REJECTED_BY_RECEIVER'
      | 'CANCELLED_BY_REQUESTER'
      | 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH'
      | 'EXPIRED'
      | 'WITHDRAWN_PARTICIPANT'
      | 'MATCH_PRECONDITION_FAILED'
      | 'ADMIN_ACTION'
      | null;
    terminalAt: Date | null;
    createdAt: Date;
    systemCancellationActiveMatchId: string | null;
    systemCancellationActiveMatch: {
      participantAId: string;
      participantBId: string;
    } | null;
  }>;
  activeMatches: Array<{
    id: string;
    pairKey: string;
    participantAId: string;
    participantBId: string;
    status: 'ACTIVE' | 'UNMATCHED' | 'SEASON_ENDED' | 'ADMIN_ENDED';
    startedAt: Date;
    endedAt: Date | null;
    endReason:
      | 'UNMATCHED_BY_MUTUAL_CONSENT'
      | 'SEASON_ENDED'
      | 'ADMIN_ACTION'
      | 'WITHDRAWN_PARTICIPANT'
      | null;
    createdFromRequestId: string;
    createdFromRequest: {
      requesterParticipantId: string;
      receiverParticipantId: string;
    };
  }>;
}

export type SeasonHistoryParticipant = SeasonHistorySource['participants'][number];
export type DbClient = Prisma.TransactionClient | PrismaClient;

export async function findEndedSeasonIds(prisma: PrismaService, now: Date, userId?: string) {
  const todayDate = new Date(`${formatKstDate(now)}T00:00:00.000Z`);
  const seasons = await prisma.season.findMany({
    where: {
      seasonEndDate: { lt: todayDate },
      participants: userId
        ? {
            some: {
              userId,
              registeredAt: { not: null },
            },
          }
        : undefined,
    },
    orderBy: [{ seasonEndDate: 'desc' }, { academicYear: 'desc' }, { semester: 'desc' }],
    select: {
      id: true,
    },
  });

  return seasons.map((season) => season.id);
}

export async function loadSeasonHistorySource(
  tx: DbClient,
  seasonId: string,
): Promise<SeasonHistorySource | null> {
  const season = await tx.season.findUnique({
    where: { id: seasonId },
    select: {
      id: true,
      name: true,
      seasonEndDate: true,
      participants: {
        orderBy: [{ id: 'asc' }],
        select: {
          id: true,
          userId: true,
          participationIntent: true,
          registeredAt: true,
          declinedAt: true,
          participantStatus: true,
          dormitoryId: true,
          dormitorySelectionState: true,
          hiddenByAdminAt: true,
          deactivatedAt: true,
          profile: {
            select: {
              participantId: true,
              nicknameSnapshot: true,
              ...lifestyleColumnSelect,
            },
          },
        },
      },
      matchRequests: {
        where: {
          status: {
            not: 'PENDING',
          },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          requesterParticipantId: true,
          receiverParticipantId: true,
          status: true,
          terminalReason: true,
          terminalAt: true,
          createdAt: true,
          systemCancellationActiveMatchId: true,
          systemCancellationActiveMatch: {
            select: {
              participantAId: true,
              participantBId: true,
            },
          },
        },
      },
      activeMatches: {
        orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          pairKey: true,
          participantAId: true,
          participantBId: true,
          status: true,
          startedAt: true,
          endedAt: true,
          endReason: true,
          createdFromRequestId: true,
          createdFromRequest: {
            select: {
              requesterParticipantId: true,
              receiverParticipantId: true,
            },
          },
        },
      },
    },
  });

  return season;
}
