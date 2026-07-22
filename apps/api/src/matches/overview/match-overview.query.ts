import { Inject, Injectable } from '@nestjs/common';
import type { MatchCapabilityReason, MatchOverviewResponse } from '@repo/shared/match/contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import {
  CHAT_THREAD_SEARCH_METADATA_READER_PORT,
  type ChatThreadSearchMetadataReaderPort,
} from '../../chat/application/ports/chat-thread-search-metadata-reader.port.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { parseLifestyleOrNull } from '../../profiles/contracts/public-profile.presenter.js';
import { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import {
  canCurrentDormitoryMatch,
  isParticipantRegistered,
} from '../../season-participants/policies/index.js';
import {
  SEASON_CONTEXT_PORT,
  type CurrentSeasonContext,
  type SeasonContextPort,
} from '../../seasons/ports/season-context.port.js';
import { ActiveMatchViewQuery } from '../active/queries/active-match-view.query.js';
import type { AuthenticatedUserContext } from '../../auth/application/auth-actor-context.types.js';
import { resolveCampusServiceState } from '../../seasons/runtime/campus-service-state.query.js';
import {
  createMatchContextOwner,
  type MatchUserContext,
} from '../context/match-context.resolver.js';
import { expireDuePendingRequests } from '../requests/persistence/match-request-locks.js';
import { toMatchRequestSummary } from '../requests/presenters/match-request.presenter.js';
import { resolveMatchRequestActions } from '../requests/presenters/match-request-actions.presenter.js';
import { toCurrentMatchActivity } from './current-match-activity.presenter.js';
import {
  currentActivityActiveMatchSelect,
  matchOverviewRequestSelect,
} from './current-match-activity.select.js';

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
    @Inject(CHAT_THREAD_SEARCH_METADATA_READER_PORT)
    private readonly chatThreadSearchMetadataReader: ChatThreadSearchMetadataReaderPort,
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
    return this.executeAt(authUser, now);
  }

  async executeAt(authUser: AuthenticatedUserContext, now: Date): Promise<MatchOverviewResponse> {
    const context = await this.contextOwner.getCurrentMatchContext(authUser.id, now);

    if (!context?.seasonContext) {
      const serviceState = await resolveCampusServiceState(
        this.prisma,
        this.seasonsService,
        context?.user.campus ?? authUser.campus,
        now,
      );
      return serviceState.campusOperated
        ? this.toOffSeasonOverview(now, null)
        : this.toUnavailableOverview(now, 'CAMPUS_NOT_OPERATED');
    }

    if (context.seasonContext.state === 'OFF_SEASON') {
      const restrictionReason = context.participant
        ? resolveViewerRestrictionReason(context.participant)
        : null;
      if (restrictionReason) {
        return this.toUnavailableOverview(now, restrictionReason);
      }
      return this.toOffSeasonOverview(now, context.seasonContext.season.id);
    }

    if (!context.participant) {
      return this.toUnavailableOverview(now, 'VIEWER_NOT_REGISTERED', context.seasonContext);
    }

    const season = context.seasonContext;
    const restrictionReason = resolveViewerRestrictionReason(context.participant);
    if (restrictionReason === 'SAFETY_OR_VISIBILITY_RESTRICTED') {
      return this.toUnavailableOverview(now, restrictionReason, season);
    }

    return this.prisma.runSerializableTransaction(async (tx) => {
      await expireDuePendingRequests(tx, season.season.id, now);

      const [requests, activityActiveMatches] = await Promise.all([
        tx.matchRequest.findMany({
          where: {
            seasonId: season.season.id,
            OR: [
              { requesterParticipantId: context.participant!.id },
              { receiverParticipantId: context.participant!.id },
            ],
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: matchOverviewRequestSelect,
        }),
        tx.activeMatch.findMany({
          where: {
            seasonId: season.season.id,
            OR: [
              { participantAId: context.participant!.id },
              { participantBId: context.participant!.id },
            ],
          },
          orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
          select: currentActivityActiveMatchSelect,
        }),
      ]);
      const activity = toCurrentMatchActivity({
        viewerParticipantId: context.participant!.id,
        requests,
        activeMatches: activityActiveMatches,
      });
      if (restrictionReason === 'VIEWER_DEREGISTERED') {
        return {
          serverNow: now.toISOString(),
          season: {
            id: season.season.id,
            state: season.state,
            roomSelectionDate: null,
            seasonEndDate: season.season.seasonEndDate,
          },
          capability: { canViewMatching: false, reason: restrictionReason },
          sentRequests: [],
          receivedRequests: [],
          activeMatch: null,
          activity,
        };
      }
      const currentActiveMatch = activityActiveMatches.find(
        (activeMatch) => activeMatch.status === 'ACTIVE' && activeMatch.endedAt === null,
      );
      const requestParticipantIds = new Set<string>([context.participant!.id]);
      requests.forEach((request) => {
        requestParticipantIds.add(request.requesterParticipantId);
        requestParticipantIds.add(request.receiverParticipantId);
      });
      const registrationSnapshotParticipantIds =
        await this.seasonParticipantsService.findRegistrationSnapshotParticipantIdSet(
          [...requestParticipantIds],
          tx,
        );
      const counterpartParticipantIds = [...requestParticipantIds].filter(
        (participantId) => participantId !== context.participant!.id,
      );
      const activeChatThreadByParticipantId =
        await this.chatThreadSearchMetadataReader.getActiveThreadMetadata({
          seasonId: season.season.id,
          viewerParticipantId: context.participant!.id,
          targetParticipantIds: counterpartParticipantIds,
        });
      const activeRequestRelations = requests.length
        ? await tx.activeMatch.findMany({
            where: {
              seasonId: season.season.id,
              status: 'ACTIVE',
              endedAt: null,
              OR: [
                { participantAId: { in: [...requestParticipantIds] } },
                { participantBId: { in: [...requestParticipantIds] } },
              ],
            },
            select: { participantAId: true, participantBId: true },
          })
        : [];
      const activeParticipantIds = new Set(
        activeRequestRelations.flatMap((match) => [match.participantAId, match.participantBId]),
      );
      const activeMatch = currentActiveMatch
        ? await this.activeMatchViewQuery.getDetailedActiveMatchSummaryForViewer(
            tx,
            currentActiveMatch.id,
            context.participant!.id,
            season,
            now,
          )
        : null;

      const rows = requests.map((request) =>
        toMatchRequestSummary(
          request,
          context.participant!.id,
          resolveMatchRequestActions({
            request,
            viewerParticipantId: context.participant!.id,
            season,
            registrationSnapshotParticipantIds,
            activeParticipantIds,
            now,
          }),
          {
            viewerUserId: authUser.id,
            now,
            seasonState: season.state,
            registrationSnapshotParticipantIds,
            activeParticipantIds,
            activeChatThreadByParticipantId,
            currentDormitoryCanMatch: canCurrentDormitoryMatch(
              season,
              context.selection.dormitoryId,
              now,
            ),
          },
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
          seasonEndDate: season.season.seasonEndDate,
        },
        capability: resolveOverviewCapability(
          context,
          registrationSnapshotParticipantIds.has(context.participant!.id),
        ),
        sentRequests: rows.filter((request) => request.direction === 'SENT'),
        receivedRequests: rows.filter((request) => request.direction === 'RECEIVED'),
        activeMatch,
        activity,
      };
    });
  }

  private toOffSeasonOverview(now: Date, seasonId: string | null): MatchOverviewResponse {
    return {
      serverNow: now.toISOString(),
      season: {
        id: seasonId,
        state: 'OFF_SEASON',
        roomSelectionDate: null,
        seasonEndDate: null,
      },
      capability: { canViewMatching: true, reason: null },
      sentRequests: [],
      receivedRequests: [],
      activeMatch: null,
      activity: [],
    };
  }

  private toUnavailableOverview(
    now: Date,
    reason: MatchCapabilityReason,
    seasonContext: CurrentSeasonContext | null = null,
  ): MatchOverviewResponse {
    return {
      serverNow: now.toISOString(),
      season: {
        id: seasonContext?.season.id ?? null,
        state: seasonContext?.state ?? 'OFF_SEASON',
        roomSelectionDate: null,
        seasonEndDate: seasonContext?.season.seasonEndDate ?? null,
      },
      capability: { canViewMatching: false, reason },
      sentRequests: [],
      receivedRequests: [],
      activeMatch: null,
      activity: [],
    };
  }
}

function resolveOverviewCapability(
  context: MatchUserContext,
  hasRegistrationSnapshot: boolean,
): {
  canViewMatching: boolean;
  reason: MatchCapabilityReason | null;
} {
  const { participant, seasonContext, selection } = context;
  if (!seasonContext || !participant) {
    return { canViewMatching: false, reason: 'VIEWER_NOT_REGISTERED' };
  }
  const restrictionReason = resolveViewerRestrictionReason(participant);
  if (restrictionReason) {
    return { canViewMatching: false, reason: restrictionReason };
  }
  if (seasonContext.state === 'OFF_SEASON') {
    return { canViewMatching: false, reason: 'SEASON_NOT_ACTIONABLE' };
  }
  const lifestyle = parseLifestyleOrNull(participant.profile?.lifestyle ?? null);
  if (
    !isParticipantRegistered(participant) ||
    selection.dormitorySelectionState !== 'ASSIGNED' ||
    !selection.dormitoryId ||
    !lifestyle ||
    !isSeasonProfileComplete(lifestyle) ||
    !hasRegistrationSnapshot
  ) {
    return { canViewMatching: false, reason: 'VIEWER_NOT_REGISTERED' };
  }
  return { canViewMatching: true, reason: null };
}

function resolveViewerRestrictionReason(
  participant: NonNullable<MatchUserContext['participant']>,
): MatchCapabilityReason | null {
  if (participant.withdrawnAt || participant.participantStatus === 'WITHDRAWN') {
    return 'VIEWER_DEREGISTERED';
  }
  if (participant.hiddenByAdminAt || participant.deactivatedAt) {
    return 'SAFETY_OR_VISIBILITY_RESTRICTED';
  }
  return null;
}
