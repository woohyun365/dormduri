import { Injectable } from '@nestjs/common';
import type { HomeDashboardMatching, HomeDashboardStats } from '@repo/shared/home';
import type { MatchOverviewResponse } from '@repo/shared/match/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { formatKstDate, toKstEndIso, toKstStartIso } from '../../platform/time/kst-date.js';
import type { CurrentSeasonContext } from '../../seasons/ports/season-context.port.js';
import { buildRegistrationCompleteParticipantWhere } from '../../season-participants/policies/index.js';

const RECENT_RECEIVED_REQUEST_LIMIT = 3;

interface CurrentHomeParticipant {
  id: string;
  dormitoryId: string | null;
  registeredAt: Date | null;
  dormitorySelectionState: 'NOT_SELECTED' | 'SELECTED' | 'UNASSIGNED' | 'ASSIGNED';
}

interface BuildCountsInput {
  seasonContext: CurrentSeasonContext | null;
  participant: CurrentHomeParticipant | null;
  now: Date;
}

const emptyStats: HomeDashboardStats = {
  totalParticipants: 0,
  assignedParticipants: 0,
  buildingTotal: 0,
  buildingMatchable: 0,
  todayNewTotal: 0,
  todayNewBuilding: 0,
  totalMatchSuccess: 0,
  buildingMatchSuccess: 0,
  todayMatchSuccessTotal: 0,
  todayMatchSuccessBuilding: 0,
};

const emptyMatching: HomeDashboardMatching = {
  pendingSentCount: 0,
  pendingReceivedCount: 0,
  activeChatThreadCount: 0,
  unreadMessageCount: 0,
  activeMatch: null,
  recentReceivedRequests: [],
};

@Injectable()
export class HomeDashboardCountsQuery {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(input: BuildCountsInput): Promise<HomeDashboardStats> {
    if (!input.seasonContext) {
      return emptyStats;
    }

    const seasonId = input.seasonContext.season.id;
    const today = formatKstDate(input.now);
    const todayStart = toKstStartIso(today);
    const todayEnd = toKstEndIso(today);
    const registrationSnapshotParticipantIds =
      await this.findRegistrationSnapshotParticipantIds(seasonId);
    const registeredParticipantWhere = buildRegistrationCompleteParticipantWhere({
      seasonId,
      registrationSnapshotParticipantIds,
    });
    const assignedParticipantWhere: Prisma.SeasonParticipantWhereInput = {
      ...registeredParticipantWhere,
      dormitoryId: { not: null },
      dormitorySelectionState: 'ASSIGNED',
    };
    const participantDormitoryId =
      input.participant?.registeredAt &&
      input.participant.dormitorySelectionState === 'ASSIGNED' &&
      input.participant.dormitoryId
        ? input.participant.dormitoryId
        : null;
    const buildingParticipantWhere: Prisma.SeasonParticipantWhereInput | null =
      participantDormitoryId
        ? {
            ...assignedParticipantWhere,
            dormitoryId: participantDormitoryId,
          }
        : null;

    const [
      totalParticipants,
      assignedParticipants,
      todayNewTotal,
      buildingTotal,
      todayNewBuilding,
      totalActiveMatchCount,
      todayActiveMatchCount,
      buildingActiveMatches,
    ] = await Promise.all([
      this.prisma.seasonParticipant.count({ where: registeredParticipantWhere }),
      this.prisma.seasonParticipant.count({ where: assignedParticipantWhere }),
      this.prisma.seasonParticipant.count({
        where: {
          ...registeredParticipantWhere,
          registeredAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      buildingParticipantWhere
        ? this.prisma.seasonParticipant.count({ where: buildingParticipantWhere })
        : Promise.resolve(0),
      buildingParticipantWhere
        ? this.prisma.seasonParticipant.count({
            where: {
              ...buildingParticipantWhere,
              registeredAt: { gte: todayStart, lte: todayEnd },
            },
          })
        : Promise.resolve(0),
      this.prisma.activeMatch.count({
        where: {
          seasonId,
          status: 'ACTIVE',
          endedAt: null,
          participantA: registeredParticipantWhere,
          participantB: registeredParticipantWhere,
        },
      }),
      this.prisma.activeMatch.count({
        where: {
          seasonId,
          status: 'ACTIVE',
          endedAt: null,
          participantA: registeredParticipantWhere,
          participantB: registeredParticipantWhere,
          startedAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      participantDormitoryId
        ? this.prisma.activeMatch.findMany({
            where: {
              seasonId,
              status: 'ACTIVE',
              endedAt: null,
              participantA: {
                ...registeredParticipantWhere,
                dormitoryId: participantDormitoryId,
              },
              participantB: {
                ...registeredParticipantWhere,
                dormitoryId: participantDormitoryId,
              },
            },
            select: {
              startedAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const buildingMatchSuccess = buildingActiveMatches.length * 2;
    const todayMatchSuccessBuilding =
      buildingActiveMatches.filter((activeMatch) => {
        const startedAtIso = activeMatch.startedAt.toISOString();
        return startedAtIso >= todayStart && startedAtIso <= todayEnd;
      }).length * 2;
    const selfIncludedInBuildingTotal = Boolean(participantDormitoryId && input.participant?.id);

    return {
      totalParticipants,
      assignedParticipants,
      buildingTotal,
      buildingMatchable: Math.max(0, buildingTotal - (selfIncludedInBuildingTotal ? 1 : 0)),
      todayNewTotal,
      todayNewBuilding,
      totalMatchSuccess: totalActiveMatchCount * 2,
      buildingMatchSuccess,
      todayMatchSuccessTotal: todayActiveMatchCount * 2,
      todayMatchSuccessBuilding,
    };
  }

  async getMatching(
    input: BuildCountsInput,
    overview: MatchOverviewResponse | null,
  ): Promise<HomeDashboardMatching> {
    if (!input.seasonContext || !input.participant) {
      return emptyMatching;
    }

    const seasonId = input.seasonContext.season.id;
    const participantId = input.participant.id;
    const sentRequests = overview?.sentRequests ?? [];
    const receivedRequests = overview?.receivedRequests ?? [];
    const pendingSentRequests = sentRequests.filter((request) => request.status === 'PENDING');
    const pendingReceivedRequests = receivedRequests.filter(
      (request) => request.status === 'PENDING',
    );

    const [activeChatThreadCount, unreadMessageCount] = await Promise.all([
      this.countActiveChatThreads(seasonId, participantId),
      this.countUnreadMessages(participantId),
    ]);

    return {
      pendingSentCount: pendingSentRequests.length,
      pendingReceivedCount: pendingReceivedRequests.length,
      activeChatThreadCount,
      unreadMessageCount,
      activeMatch: null,
      recentReceivedRequests: pendingReceivedRequests.slice(0, RECENT_RECEIVED_REQUEST_LIMIT),
    };
  }

  async hasMatchHistory(userId: string): Promise<boolean> {
    const historyCount = await this.prisma.seasonMatchHistoryEntry.count({
      where: {
        viewerRedactedAt: null,
        viewerParticipant: { userId },
      },
      take: 1,
    });

    return historyCount > 0;
  }

  async findCurrentParticipant(
    seasonContext: CurrentSeasonContext | null,
    userId: string,
  ): Promise<CurrentHomeParticipant | null> {
    if (!seasonContext) {
      return null;
    }

    const registrationSnapshotParticipantIds = await this.findRegistrationSnapshotParticipantIds(
      seasonContext.season.id,
    );

    return this.prisma.seasonParticipant.findFirst({
      where: {
        ...buildRegistrationCompleteParticipantWhere({
          seasonId: seasonContext.season.id,
          registrationSnapshotParticipantIds,
        }),
        userId,
      },
      select: {
        id: true,
        dormitoryId: true,
        registeredAt: true,
        dormitorySelectionState: true,
      },
    });
  }

  private async countActiveChatThreads(seasonId: string, participantId: string): Promise<number> {
    return this.prisma.conversationThreadMember.count({
      where: {
        participantId,
        memberState: 'ACTIVE',
        thread: {
          seasonId,
          status: 'OPEN',
        },
      },
    });
  }

  private async countUnreadMessages(participantId: string): Promise<number> {
    const memberships = await this.prisma.conversationThreadMember.findMany({
      where: { participantId, memberState: 'ACTIVE' },
      select: { threadId: true, lastReadAt: true },
    });

    if (memberships.length === 0) {
      return 0;
    }

    const counts = await Promise.all(
      memberships.map((membership) =>
        this.prisma.conversationMessage.count({
          where: {
            threadId: membership.threadId,
            senderParticipantId: { not: participantId },
            deletedAt: null,
            ...(membership.lastReadAt ? { sentAt: { gt: membership.lastReadAt } } : {}),
          },
        }),
      ),
    );

    return counts.reduce((total, count) => total + count, 0);
  }

  private async findRegistrationSnapshotParticipantIds(seasonId: string): Promise<string[]> {
    const snapshots = await this.prisma.seasonParticipantProfileHistory.findMany({
      where: {
        seasonId,
        source: 'SEASON_REGISTRATION',
        registeredAtSnapshot: { not: null },
        redactedAt: null,
      },
      select: { participantId: true },
      distinct: ['participantId'],
    });

    return snapshots.map((snapshot) => snapshot.participantId);
  }
}
