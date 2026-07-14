import { Inject, Injectable } from '@nestjs/common';
import type {
  MatchActionDisabledReason,
  MatchCapabilityReason,
  MatchOverviewResponse,
  MatchRequestActions,
} from '@repo/shared/match/contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import { parseLifestyleOrNull } from '../../profiles/contracts/public-profile.presenter.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import {
  SEASON_CONTEXT_PORT,
  type CurrentSeasonContext,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { ActiveMatchViewQuery } from '../active/queries/active-match-view.query.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import {
  createMatchContextOwner,
  type MatchUserContext,
} from '../context/match-context.resolver.js';
import { expireDuePendingRequests } from '../requests/persistence/match-request-locks.js';
import { matchRequestSummarySelect } from '../requests/persistence/match-request.select.js';
import { toMatchRequestSummary } from '../requests/presenters/match-request.presenter.js';

/**
 * Overview의 current request와 active relation은 동일 serializable read 안에서 읽는다.
 * season schedule은 immutable runtime context로 먼저 같은 DB `now`에 해석한다.
 */
@Injectable()
export class MatchOverviewQuery {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEASON_CONTEXT_PORT)
    private readonly seasonsService: SeasonContextPort,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly activeMatchViewQuery: ActiveMatchViewQuery,
  ) {}

  private get contextOwner() {
    return createMatchContextOwner({
      prisma: this.prisma,
      seasonsService: this.seasonsService,
      seasonParticipantsService: this.seasonParticipantsService,
      requestTargetNotFound: () => new Error('overview does not resolve request targets'),
      requestSelfTargetNotAllowed: () => new Error('overview does not resolve request targets'),
    });
  }

  async execute(authUser: AuthenticatedUserContext): Promise<MatchOverviewResponse> {
    const now = await this.prisma.getDatabaseNow();
    const context = await this.contextOwner.getCurrentMatchContext(authUser.id, now);

    if (!context?.seasonContext || !context.participant) {
      return this.toUnavailableOverview(now, context);
    }

    const capability = resolveOverviewCapability(context);
    const season = context.seasonContext;

    return this.prisma.runSerializableTransaction(async (tx) => {
      await expireDuePendingRequests(tx, season.season.id, now);

      const requests = await tx.matchRequest.findMany({
        where: {
          seasonId: season.season.id,
          OR: [
            { requesterParticipantId: context.participant!.id },
            { receiverParticipantId: context.participant!.id },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: matchRequestSummarySelect,
      });
      const activeMatch = await this.readActiveMatch(tx, season, context.participant!.id, now);

      const rows = requests.map((request) =>
        toMatchRequestSummary(
          request,
          context.participant!.id,
          resolveRequestActions(
            request,
            context.participant!.id,
            season,
            context.selection.dormitoryId,
            now,
          ),
        ),
      );

      return {
        serverNow: now.toISOString(),
        season: {
          id: season.season.id,
          state: season.state,
          roomSelectionDate: this.contextOwner.findRoomSelectionDate(
            season,
            context.selection.dormitoryId,
          ),
        },
        capability,
        sentRequests: rows.filter((request) => request.direction === 'SENT'),
        receivedRequests: rows.filter((request) => request.direction === 'RECEIVED'),
        activeMatch,
      };
    });
  }

  private async readActiveMatch(
    tx: Prisma.TransactionClient,
    season: CurrentSeasonContext,
    participantId: string,
    now: Date,
  ) {
    const activeMatch = await tx.activeMatch.findFirst({
      where: {
        seasonId: season.season.id,
        endedAt: null,
        OR: [{ participantAId: participantId }, { participantBId: participantId }],
      },
      select: { id: true },
    });

    return activeMatch
      ? this.activeMatchViewQuery.getDetailedActiveMatchSummaryForViewer(
          tx,
          activeMatch.id,
          participantId,
          season,
          now,
        )
      : null;
  }

  private toUnavailableOverview(
    now: Date,
    context: MatchUserContext | null,
  ): MatchOverviewResponse {
    return {
      serverNow: now.toISOString(),
      season: { id: null, state: 'OFF_SEASON', roomSelectionDate: null },
      capability: {
        canViewMatching: false,
        reason: context?.seasonContext ? 'VIEWER_NOT_REGISTERED' : 'CAMPUS_NOT_OPERATED',
      },
      sentRequests: [],
      receivedRequests: [],
      activeMatch: null,
    };
  }
}

function resolveOverviewCapability(context: MatchUserContext): {
  canViewMatching: boolean;
  reason: MatchCapabilityReason | null;
} {
  const { participant, seasonContext, selection } = context;
  if (!seasonContext || !participant) {
    return { canViewMatching: false, reason: 'VIEWER_NOT_REGISTERED' };
  }
  if (participant.hiddenByAdminAt || participant.deactivatedAt || participant.withdrawnAt) {
    return { canViewMatching: false, reason: 'SAFETY_OR_VISIBILITY_RESTRICTED' };
  }
  if (seasonContext.state === 'OFF_SEASON') {
    return { canViewMatching: false, reason: 'SEASON_NOT_ACTIONABLE' };
  }
  if (selection.dormitorySelectionState !== 'ASSIGNED' || !selection.dormitoryId) {
    return { canViewMatching: false, reason: 'VIEWER_NOT_ASSIGNED' };
  }
  const lifestyle = parseLifestyleOrNull(participant.profile?.lifestyle ?? null);
  if (!lifestyle || !isSeasonProfileComplete(lifestyle)) {
    return { canViewMatching: false, reason: 'VIEWER_PROFILE_INCOMPLETE' };
  }
  return { canViewMatching: true, reason: null };
}

function resolveRequestActions(
  request: {
    status: string;
    requesterParticipantId: string;
    requesterParticipant: {
      participantStatus: string;
      withdrawnAt: Date | null;
      hiddenByAdminAt: Date | null;
      deactivatedAt: Date | null;
      user: { deletedAt: Date | null } | null;
    };
    receiverParticipant: {
      participantStatus: string;
      withdrawnAt: Date | null;
      hiddenByAdminAt: Date | null;
      deactivatedAt: Date | null;
      user: { deletedAt: Date | null } | null;
    };
  },
  viewerParticipantId: string,
  season: CurrentSeasonContext,
  viewerDormitoryId: string | null,
  now: Date,
): MatchRequestActions {
  if (request.status !== 'PENDING') {
    return {
      canAccept: false,
      canReject: false,
      canCancel: false,
      disabledReason: request.status === 'EXPIRED' ? 'REQUEST_EXPIRED' : 'REQUEST_ALREADY_RESOLVED',
    };
  }

  if (isCounterpartUnavailable(request, viewerParticipantId)) {
    return {
      canAccept: false,
      canReject: false,
      canCancel: false,
      disabledReason: 'TARGET_UNAVAILABLE',
    };
  }

  const reason = resolvePendingRequestDisabledReason(season, viewerDormitoryId, now);
  if (reason) {
    return { canAccept: false, canReject: false, canCancel: false, disabledReason: reason };
  }

  return request.requesterParticipantId === viewerParticipantId
    ? { canAccept: false, canReject: false, canCancel: true, disabledReason: null }
    : { canAccept: true, canReject: true, canCancel: false, disabledReason: null };
}

function isCounterpartUnavailable(
  request: Parameters<typeof resolveRequestActions>[0],
  viewerParticipantId: string,
) {
  const counterpart =
    request.requesterParticipantId === viewerParticipantId
      ? request.receiverParticipant
      : request.requesterParticipant;
  return (
    counterpart.participantStatus === 'WITHDRAWN' ||
    counterpart.participantStatus === 'EXPIRED' ||
    counterpart.withdrawnAt !== null ||
    counterpart.hiddenByAdminAt !== null ||
    counterpart.deactivatedAt !== null ||
    counterpart.user?.deletedAt !== null
  );
}

function resolvePendingRequestDisabledReason(
  season: CurrentSeasonContext,
  viewerDormitoryId: string | null,
  now: Date,
): MatchActionDisabledReason | null {
  if (season.state !== 'SEASON_MATCHING') return 'SEASON_NOT_ACTIONABLE';
  const roomSelectionDate = season.operatedDormitories.find(
    (item) => item.dormitoryId === viewerDormitoryId,
  )?.roomSelectionDate;
  if (!roomSelectionDate || formatKstDate(now) > roomSelectionDate) {
    return 'ROOM_SELECTION_CUTOFF';
  }
  return null;
}
