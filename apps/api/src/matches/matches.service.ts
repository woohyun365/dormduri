import { Injectable } from '@nestjs/common';
import type {
  ActiveMatchActionResponse,
  ActiveMatchResponse,
  ActiveMatchSummary,
  ActiveMatchUnmatchProgress,
  CreateMatchRequestRequest,
  MatchRequestActionResponse,
  MatchRequestListResponse,
  MatchRequestSummary,
} from '@repo/shared/match-contract';
import { Prisma } from '../generated/prisma/client.js';
import {
  acquireTransactionAdvisoryLock,
  lockActiveMatchRow,
  lockMatchRequestRow,
} from '../generated/prisma/sql.js';
import type {
  ActiveMatchStatus,
  ActiveMatchUnmatchRequestStatus,
  DormitorySelectionState,
  MatchRequestChannel,
  MatchRequestStatus,
  MatchRequestTerminalReason,
} from '../generated/prisma/enums.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import { ChatService } from '../chat/chat.service.js';
import { ModerationService } from '../common/moderation/moderation.service.js';
import { PrismaService } from '../common/prisma/prisma.service.js';
import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  resolvePublicExposure,
} from '../season-participants/season-participant-policy.js';
import {
  SeasonParticipantsService,
  type CurrentSeasonParticipantRecord,
  type ParticipantBackfillSeed,
} from '../season-participants/season-participants.service.js';
import {
  buildCurrentUserCapabilityInput,
  buildPublicExposureTargetInput,
  buildPublicExposureViewerInput,
  toOperatedDormitoryIdSet,
} from '../season-participants/season-participant-gate-context.js';
import { SeasonsService } from '../seasons/seasons.service.js';
import { formatKstDate } from '../seasons/season.utils.js';
import { matchesErrors } from './matches.errors.js';
import {
  buildParticipantPairIdentity,
  isCooldownActive,
  resolveMatchRequestExpiresAt,
  sortParticipantIds,
} from './match.utils.js';

interface MatchUserSeed extends ParticipantBackfillSeed {
  id: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  dormitorySelectionState: DormitorySelectionState;
}

interface MatchUserContext {
  user: MatchUserSeed;
  seasonContext: Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>;
  participant: CurrentSeasonParticipantRecord | null;
  selection: ReturnType<SeasonParticipantsService['selectCanonicalSelection']>;
}

interface MatchRequestRecord {
  id: string;
  seasonId: string;
  requesterParticipantId: string;
  receiverParticipantId: string;
  status: MatchRequestStatus;
  note: string | null;
  createdAt: Date;
  expiresAt: Date;
  terminalAt: Date | null;
  acceptedAt: Date | null;
  terminalReason: MatchRequestTerminalReason | null;
  requestChannel: MatchRequestChannel | null;
  requesterParticipant: { userId: string };
  receiverParticipant: { userId: string };
}

interface ActiveMatchRecord {
  id: string;
  seasonId: string;
  participantAId: string;
  participantBId: string;
  status: ActiveMatchStatus;
  startedAt: Date;
  endedAt: Date | null;
  endReason: string | null;
  createdFromRequestId: string;
  participantA: { userId: string };
  participantB: { userId: string };
  unmatchRequests?: Array<{
    participantId: string;
    status: ActiveMatchUnmatchRequestStatus;
    requestedAt: Date;
    terminalAt: Date | null;
  }>;
}

interface ActiveMatchCommandRecord extends ActiveMatchRecord {
  participantA: {
    userId: string;
    dormitoryId: string | null;
    dormitorySelectionState: DormitorySelectionState;
  };
  participantB: {
    userId: string;
    dormitoryId: string | null;
    dormitorySelectionState: DormitorySelectionState;
  };
  unmatchRequests: Array<{
    id: string;
    participantId: string;
    status: ActiveMatchUnmatchRequestStatus;
    requestedAt: Date;
    terminalAt: Date | null;
  }>;
}

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly seasonsService: SeasonsService,
    private readonly moderationService: ModerationService,
    private readonly seasonParticipantsService: SeasonParticipantsService,
    private readonly chatService: ChatService,
  ) {}

  async getCurrentActiveMatch(authUser: AuthenticatedUserContext): Promise<ActiveMatchResponse> {
    const now = await this.prisma.getDatabaseNow();
    const context = await this.getCurrentMatchContext(authUser.id, now);

    if (!context?.seasonContext || !context.participant) {
      return { activeMatch: null };
    }

    return {
      activeMatch: await this.getCurrentActiveMatchSummaryForParticipant(
        context.seasonContext,
        context.participant.id,
        now,
      ),
    };
  }

  async listCurrentSeasonRequests(
    authUser: AuthenticatedUserContext,
  ): Promise<MatchRequestListResponse> {
    const now = await this.prisma.getDatabaseNow();
    const context = await this.getCurrentMatchContext(authUser.id, now);

    if (!context?.seasonContext || !context.participant) {
      return { items: [] };
    }

    await this.expireDuePendingRequests(context.seasonContext.season.id, now);

    const requests = await this.prisma.matchRequest.findMany({
      where: {
        seasonId: context.seasonContext.season.id,
        OR: [
          { requesterParticipantId: context.participant.id },
          { receiverParticipantId: context.participant.id },
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: this.matchRequestSummarySelect(),
    });

    return {
      items: requests.map((request) =>
        this.toMatchRequestSummary(request, context.participant!.id),
      ),
    };
  }

  async createMatchRequest(
    authUser: AuthenticatedUserContext,
    input: CreateMatchRequestRequest,
  ): Promise<MatchRequestActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const requesterContext = await this.getCurrentMatchContext(authUser.id, now);

    if (!requesterContext?.seasonContext || !requesterContext.participant) {
      throw matchesErrors.requestNotAllowed();
    }

    const targetUser = await this.getUserSeed(input.targetUserId);
    if (!targetUser) {
      throw matchesErrors.requestTargetNotFound();
    }

    if (targetUser.id === requesterContext.user.id) {
      throw matchesErrors.requestSelfTargetNotAllowed();
    }

    if (
      targetUser.campus !== requesterContext.user.campus ||
      targetUser.gender !== requesterContext.user.gender
    ) {
      throw matchesErrors.requestTargetNotFound();
    }

    const targetParticipant =
      await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(targetUser, now);
    if (!targetParticipant) {
      throw matchesErrors.requestTargetNotFound();
    }

    const targetSelection = this.seasonParticipantsService.selectCanonicalSelection(
      targetUser,
      targetParticipant,
    );
    const activeMatchMap = await this.getLiveActiveMatchMapForParticipantIds(
      requesterContext.seasonContext.season.id,
      [requesterContext.participant.id, targetParticipant.id],
    );
    const requesterActiveMatch = activeMatchMap.get(requesterContext.participant.id) ?? null;
    const targetActiveMatch = activeMatchMap.get(targetParticipant.id) ?? null;
    const seasonContext = requesterContext.seasonContext;
    const operatedDormitoryIds = toOperatedDormitoryIdSet(seasonContext);
    const requesterCurrentDormitoryCanMatch = canCurrentDormitoryMatch(
      seasonContext,
      requesterContext.selection.dormitoryId,
      now,
    );
    const requesterCapabilities = buildCurrentUserCapabilities(
      buildCurrentUserCapabilityInput({
        campusOperated: true,
        seasonState: seasonContext.state,
        participant: requesterContext.participant,
        participantMatched: requesterActiveMatch !== null,
        selection: requesterContext.selection,
        operatedDormitoryIds,
        currentDormitoryCanMatch: requesterCurrentDormitoryCanMatch,
        nicknameLockedBySeason: false,
        nicknameCooldownActive: false,
      }),
    );
    const exposure = resolvePublicExposure(
      buildPublicExposureViewerInput({
        campusOperated: true,
        seasonState: seasonContext.state,
        participant: requesterContext.participant,
        matched: requesterActiveMatch !== null,
        matchedPartnerParticipantId: requesterActiveMatch?.counterpartParticipantId ?? null,
        selection: requesterContext.selection,
        operatedDormitoryIds,
        currentDormitoryCanMatch: requesterCurrentDormitoryCanMatch,
      }),
      buildPublicExposureTargetInput({
        seasonState: seasonContext.state,
        operatedDormitoryIds,
        participant: targetParticipant,
        matched: targetActiveMatch !== null,
        selection: targetSelection,
      }),
    );

    if (!requesterCapabilities.canRequestMatch || exposure.exposureLevel !== 'FULL') {
      throw matchesErrors.requestNotAllowed();
    }

    const note = input.note?.trim() ? input.note.trim() : null;
    if (note) {
      const moderation = await this.moderationService.moderatePublicText(note, 'messageToRoommate');
      if (!moderation.ok) {
        throw matchesErrors.requestNoteModerationRejected(moderation.error);
      }
    }

    const pairIdentity = buildParticipantPairIdentity(
      requesterContext.participant.id,
      targetParticipant.id,
    );
    const requesterRoomSelectionDate = this.findRoomSelectionDate(
      seasonContext,
      requesterContext.selection.dormitoryId,
    );
    if (!requesterRoomSelectionDate) {
      throw matchesErrors.requestNotAllowed();
    }

    const createdRequest = await this.prisma.runSerializableTransaction(async (tx) => {
      await this.acquirePairLock(tx, seasonContext.season.id, pairIdentity.pairKey);
      await this.expireDuePendingRequests(seasonContext.season.id, now, tx);
      await this.assertNoLivePendingPair(tx, seasonContext.season.id, pairIdentity);
      await this.assertPendingRequestLimit(
        tx,
        seasonContext.season.id,
        requesterContext.participant!.id,
      );
      await this.assertDirectionLimit(
        tx,
        seasonContext.season.id,
        requesterContext.participant!.id,
        targetParticipant.id,
      );
      await this.assertDirectionCooldown(
        tx,
        seasonContext.season.id,
        requesterContext.participant!.id,
        targetParticipant.id,
        now,
      );

      try {
        return await tx.matchRequest.create({
          data: {
            seasonId: seasonContext.season.id,
            pairKey: pairIdentity.pairKey,
            pairMinParticipantId: pairIdentity.pairMinParticipantId,
            pairMaxParticipantId: pairIdentity.pairMaxParticipantId,
            requesterParticipantId: requesterContext.participant!.id,
            receiverParticipantId: targetParticipant.id,
            note,
            status: 'PENDING',
            expiresAt: resolveMatchRequestExpiresAt(now, requesterRoomSelectionDate),
            requestChannel: input.channel ?? null,
          },
          select: this.matchRequestSummarySelect(),
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw matchesErrors.requestAlreadyPending();
        }
        throw error;
      }
    });

    return {
      request: this.toMatchRequestSummary(createdRequest, requesterContext.participant.id),
      activeMatch: null,
    };
  }

  async acceptMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const receiverContext = await this.getCurrentMatchContext(authUser.id, now);

    if (!receiverContext?.seasonContext || !receiverContext.participant) {
      throw matchesErrors.requestAcceptNotAllowed();
    }

    return this.prisma.runSerializableTransaction(async (tx) => {
      await this.expireDuePendingRequests(receiverContext.seasonContext!.season.id, now, tx);
      await this.lockRequestRow(tx, requestId);

      const request = await tx.matchRequest.findUnique({
        where: { id: requestId },
        select: this.matchRequestSummarySelect(),
      });
      if (!request) {
        throw matchesErrors.requestNotFound();
      }
      if (request.status !== 'PENDING') {
        throw matchesErrors.requestNotPending();
      }
      if (request.receiverParticipantId !== receiverContext.participant!.id) {
        throw matchesErrors.requestAcceptNotAllowed();
      }
      if (request.expiresAt.getTime() <= now.getTime()) {
        await tx.matchRequest.update({
          where: { id: request.id },
          data: {
            status: 'EXPIRED',
            terminalReason: 'EXPIRED',
            terminalAt: now,
          },
        });
        throw matchesErrors.requestExpired();
      }

      const sortedParticipants = sortParticipantIds(
        request.requesterParticipantId,
        request.receiverParticipantId,
      );
      await this.acquireParticipantLocks(tx, request.seasonId, sortedParticipants);

      const existingActiveMatch = await tx.activeMatch.findFirst({
        where: {
          seasonId: request.seasonId,
          endedAt: null,
          OR: [
            { participantAId: { in: [...sortedParticipants] } },
            { participantBId: { in: [...sortedParticipants] } },
          ],
        },
        select: { id: true },
      });
      if (existingActiveMatch) {
        throw matchesErrors.activeMatchAlreadyExists();
      }

      const pairIdentity = buildParticipantPairIdentity(
        request.requesterParticipantId,
        request.receiverParticipantId,
      );

      await tx.matchRequest.update({
        where: { id: request.id },
        data: {
          status: 'ACCEPTED',
          terminalReason: 'ACCEPTED',
          acceptedAt: now,
          terminalAt: now,
        },
      });

      let activeMatchRecord: ActiveMatchRecord;
      try {
        activeMatchRecord = await tx.activeMatch.create({
          data: {
            seasonId: request.seasonId,
            pairKey: pairIdentity.pairKey,
            participantAId: pairIdentity.pairMinParticipantId,
            participantBId: pairIdentity.pairMaxParticipantId,
            createdFromRequestId: request.id,
            status: 'ACTIVE',
            startedAt: now,
          },
          select: this.activeMatchSummarySelect(),
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw matchesErrors.activeMatchAlreadyExists();
        }
        throw error;
      }

      await tx.seasonParticipant.updateMany({
        where: { id: { in: [request.requesterParticipantId, request.receiverParticipantId] } },
        data: {
          participantStatus: 'MATCHED',
          matchedAt: now,
        },
      });

      await this.chatService.handleActiveMatchCreated(
        tx,
        {
          seasonId: request.seasonId,
          pairKey: pairIdentity.pairKey,
          participantAId: pairIdentity.pairMinParticipantId,
          participantBId: pairIdentity.pairMaxParticipantId,
          activeMatchId: activeMatchRecord.id,
        },
        now,
      );

      await tx.matchRequest.updateMany({
        where: {
          seasonId: request.seasonId,
          status: 'PENDING',
          id: { not: request.id },
          OR: [
            {
              requesterParticipantId: {
                in: [request.requesterParticipantId, request.receiverParticipantId],
              },
            },
            {
              receiverParticipantId: {
                in: [request.requesterParticipantId, request.receiverParticipantId],
              },
            },
          ],
        },
        data: {
          status: 'CANCELLED_BY_SYSTEM',
          terminalReason: 'CANCELLED_BY_SYSTEM_ACTIVE_MATCH',
          terminalAt: now,
        },
      });

      const acceptedRequest = {
        ...request,
        status: 'ACCEPTED' as const,
        terminalReason: 'ACCEPTED' as const,
        acceptedAt: now,
        terminalAt: now,
      };
      const activeMatchSummary = await this.getDetailedActiveMatchSummaryForViewer(
        tx,
        activeMatchRecord.id,
        receiverContext.participant!.id,
        receiverContext.seasonContext!,
        now,
      );

      return {
        request: this.toMatchRequestSummary(acceptedRequest, receiverContext.participant!.id),
        activeMatch: activeMatchSummary,
      };
    });
  }

  async rejectMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.resolveRequestAsTerminal(authUser, requestId, 'REJECTED', 'REJECTED_BY_RECEIVER');
  }

  async cancelMatchRequest(
    authUser: AuthenticatedUserContext,
    requestId: string,
  ): Promise<MatchRequestActionResponse> {
    return this.resolveRequestAsTerminal(
      authUser,
      requestId,
      'CANCELLED_BY_REQUESTER',
      'CANCELLED_BY_REQUESTER',
    );
  }

  async requestUnmatch(
    authUser: AuthenticatedUserContext,
    activeMatchId: string,
  ): Promise<ActiveMatchActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const currentContext = await this.getCurrentMatchContext(authUser.id, now);

    if (!currentContext?.seasonContext || !currentContext.participant) {
      throw matchesErrors.unmatchRequestNotAllowed();
    }

    return this.prisma.runSerializableTransaction(async (tx) => {
      await this.acquireActiveMatchLock(tx, activeMatchId);
      await this.lockActiveMatchRow(tx, activeMatchId);

      const activeMatch = await tx.activeMatch.findUnique({
        where: { id: activeMatchId },
        select: this.activeMatchCommandSelect(),
      });

      if (!activeMatch) {
        throw matchesErrors.activeMatchNotFound();
      }

      const synchronizedActiveMatch = await this.synchronizePendingUnmatchRequests(
        activeMatch,
        currentContext.seasonContext!,
        now,
        tx,
      );

      this.assertCurrentSeasonActiveMatch(
        synchronizedActiveMatch,
        currentContext.seasonContext!.season.id,
      );
      this.assertUnmatchActorAllowed(synchronizedActiveMatch, currentContext.participant!.id, () =>
        matchesErrors.unmatchRequestNotAllowed(),
      );
      this.assertUnmatchWindowOpen(synchronizedActiveMatch, currentContext.seasonContext!, now);

      const existingPendingRequest = synchronizedActiveMatch.unmatchRequests?.find(
        (request) =>
          request.participantId === currentContext.participant!.id && request.status === 'PENDING',
      );
      if (existingPendingRequest) {
        throw matchesErrors.unmatchRequestAlreadySubmitted();
      }

      try {
        await tx.activeMatchUnmatchRequest.create({
          data: {
            activeMatchId: synchronizedActiveMatch.id,
            participantId: currentContext.participant!.id,
            status: 'PENDING',
            requestedAt: now,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw matchesErrors.unmatchRequestAlreadySubmitted();
        }
        throw error;
      }

      const pendingUnmatchRequests = await tx.activeMatchUnmatchRequest.findMany({
        where: {
          activeMatchId: synchronizedActiveMatch.id,
          status: 'PENDING',
        },
        select: {
          id: true,
          participantId: true,
          requestedAt: true,
          terminalAt: true,
          status: true,
        },
      });

      if (pendingUnmatchRequests.length < 2) {
        const refreshedActiveMatch = await tx.activeMatch.findUnique({
          where: { id: synchronizedActiveMatch.id },
          select: this.activeMatchCommandSelect(),
        });

        if (!refreshedActiveMatch) {
          throw matchesErrors.activeMatchNotFound();
        }

        return {
          activeMatch: this.toDetailedActiveMatchSummary(
            refreshedActiveMatch,
            currentContext.participant!.id,
            currentContext.seasonContext!,
            now,
          ),
        };
      }

      await tx.activeMatchUnmatchRequest.updateMany({
        where: {
          activeMatchId: synchronizedActiveMatch.id,
          status: 'PENDING',
        },
        data: {
          status: 'FULFILLED_BY_MUTUAL_CONSENT',
          terminalAt: now,
        },
      });

      await tx.seasonParticipant.updateMany({
        where: {
          id: {
            in: [synchronizedActiveMatch.participantAId, synchronizedActiveMatch.participantBId],
          },
        },
        data: {
          participantStatus: 'ACTIVE',
          matchedAt: null,
        },
      });

      await this.chatService.handleActiveMatchUnmatched(
        tx,
        { activeMatchId: synchronizedActiveMatch.id },
        now,
      );

      const endedActiveMatch = await tx.activeMatch.update({
        where: { id: synchronizedActiveMatch.id },
        data: {
          status: 'UNMATCHED',
          endedAt: now,
          endReason: 'UNMATCHED_BY_MUTUAL_CONSENT',
        },
        select: this.activeMatchCommandSelect(),
      });

      return {
        activeMatch: this.toDetailedActiveMatchSummary(
          endedActiveMatch,
          currentContext.participant!.id,
          currentContext.seasonContext!,
          now,
        ),
      };
    });
  }

  async cancelUnmatchRequest(
    authUser: AuthenticatedUserContext,
    activeMatchId: string,
  ): Promise<ActiveMatchActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const currentContext = await this.getCurrentMatchContext(authUser.id, now);

    if (!currentContext?.seasonContext || !currentContext.participant) {
      throw matchesErrors.unmatchRequestCancelNotAllowed();
    }

    return this.prisma.runSerializableTransaction(async (tx) => {
      await this.acquireActiveMatchLock(tx, activeMatchId);
      await this.lockActiveMatchRow(tx, activeMatchId);

      const activeMatch = await tx.activeMatch.findUnique({
        where: { id: activeMatchId },
        select: this.activeMatchCommandSelect(),
      });

      if (!activeMatch) {
        throw matchesErrors.activeMatchNotFound();
      }

      const synchronizedActiveMatch = await this.synchronizePendingUnmatchRequests(
        activeMatch,
        currentContext.seasonContext!,
        now,
        tx,
      );

      this.assertCurrentSeasonActiveMatch(
        synchronizedActiveMatch,
        currentContext.seasonContext!.season.id,
      );
      this.assertUnmatchWindowOpen(synchronizedActiveMatch, currentContext.seasonContext!, now);

      const [viewerPendingRequest] = await tx.activeMatchUnmatchRequest.findMany({
        where: {
          activeMatchId: synchronizedActiveMatch.id,
          participantId: currentContext.participant!.id,
          status: 'PENDING',
        },
        orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
        select: {
          id: true,
          participantId: true,
          status: true,
          requestedAt: true,
          terminalAt: true,
        },
      });

      if (!viewerPendingRequest) {
        throw matchesErrors.unmatchRequestCancelNotAllowed();
      }

      await tx.activeMatchUnmatchRequest.update({
        where: { id: viewerPendingRequest.id },
        data: {
          status: 'CANCELLED_BY_REQUESTER',
          terminalAt: now,
        },
      });

      const refreshedActiveMatch = await tx.activeMatch.findUnique({
        where: { id: synchronizedActiveMatch.id },
        select: this.activeMatchCommandSelect(),
      });

      if (!refreshedActiveMatch) {
        throw matchesErrors.activeMatchNotFound();
      }

      return {
        activeMatch: this.toDetailedActiveMatchSummary(
          refreshedActiveMatch,
          currentContext.participant!.id,
          currentContext.seasonContext!,
          now,
        ),
      };
    });
  }

  async getCurrentActiveMatchByParticipantId(
    seasonId: string,
    participantId: string,
  ): Promise<ActiveMatchSummary | null> {
    const activeMatchMap = await this.getLiveActiveMatchMapForParticipantIds(seasonId, [
      participantId,
    ]);
    return activeMatchMap.get(participantId) ?? null;
  }

  async getCurrentActiveMatchSummaryForParticipant(
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    participantId: string,
    now: Date,
  ): Promise<ActiveMatchSummary | null> {
    const activeMatch = await this.getCurrentDetailedActiveMatchByParticipantId(
      seasonContext.season.id,
      participantId,
    );
    if (!activeMatch) return null;
    const synchronizedActiveMatch = await this.synchronizePendingUnmatchRequests(
      activeMatch,
      seasonContext,
      now,
    );
    return this.toDetailedActiveMatchSummary(
      synchronizedActiveMatch,
      participantId,
      seasonContext,
      now,
    );
  }

  private async getCurrentDetailedActiveMatchByParticipantId(
    seasonId: string,
    participantId: string,
  ): Promise<ActiveMatchCommandRecord | null> {
    return this.prisma.activeMatch.findFirst({
      where: {
        seasonId,
        endedAt: null,
        OR: [{ participantAId: participantId }, { participantBId: participantId }],
      },
      select: this.activeMatchCommandSelect(),
    });
  }

  private async getDetailedActiveMatchSummaryForViewer(
    client: PrismaService | Prisma.TransactionClient,
    activeMatchId: string,
    viewerParticipantId: string,
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    now: Date,
  ): Promise<ActiveMatchSummary> {
    const activeMatch = await client.activeMatch.findUnique({
      where: { id: activeMatchId },
      select: this.activeMatchCommandSelect(),
    });

    if (!activeMatch) {
      throw matchesErrors.activeMatchNotFound();
    }

    const synchronizedActiveMatch = await this.synchronizePendingUnmatchRequests(
      activeMatch,
      seasonContext,
      now,
      client === this.prisma ? undefined : client,
    );

    return this.toDetailedActiveMatchSummary(
      synchronizedActiveMatch,
      viewerParticipantId,
      seasonContext,
      now,
    );
  }

  async getLiveActiveMatchMapForParticipantIds(
    seasonId: string,
    participantIds: string[],
  ): Promise<Map<string, ActiveMatchSummary>> {
    if (participantIds.length === 0) {
      return new Map();
    }

    const activeMatches = await this.prisma.activeMatch.findMany({
      where: {
        seasonId,
        endedAt: null,
        OR: [
          { participantAId: { in: participantIds } },
          { participantBId: { in: participantIds } },
        ],
      },
      select: this.activeMatchSummarySelect(),
    });

    const map = new Map<string, ActiveMatchSummary>();
    for (const activeMatch of activeMatches) {
      map.set(
        activeMatch.participantAId,
        this.toActiveMatchSummary(activeMatch, activeMatch.participantAId),
      );
      map.set(
        activeMatch.participantBId,
        this.toActiveMatchSummary(activeMatch, activeMatch.participantBId),
      );
    }

    return map;
  }

  private async resolveRequestAsTerminal(
    authUser: AuthenticatedUserContext,
    requestId: string,
    status: 'REJECTED' | 'CANCELLED_BY_REQUESTER',
    terminalReason: 'REJECTED_BY_RECEIVER' | 'CANCELLED_BY_REQUESTER',
  ): Promise<MatchRequestActionResponse> {
    const now = await this.prisma.getDatabaseNow();
    const currentContext = await this.getCurrentMatchContext(authUser.id, now);

    if (!currentContext?.seasonContext || !currentContext.participant) {
      throw status === 'REJECTED'
        ? matchesErrors.requestRejectNotAllowed()
        : matchesErrors.requestCancelNotAllowed();
    }

    return this.prisma.runSerializableTransaction(async (tx) => {
      await this.expireDuePendingRequests(currentContext.seasonContext!.season.id, now, tx);
      await this.lockRequestRow(tx, requestId);

      const request = await tx.matchRequest.findUnique({
        where: { id: requestId },
        select: this.matchRequestSummarySelect(),
      });
      if (!request) {
        throw matchesErrors.requestNotFound();
      }
      if (request.status !== 'PENDING') {
        throw matchesErrors.requestNotPending();
      }
      if (request.expiresAt.getTime() <= now.getTime()) {
        await tx.matchRequest.update({
          where: { id: request.id },
          data: {
            status: 'EXPIRED',
            terminalReason: 'EXPIRED',
            terminalAt: now,
          },
        });
        throw matchesErrors.requestExpired();
      }

      const actingParticipantId = currentContext.participant!.id;
      if (status === 'REJECTED' && request.receiverParticipantId !== actingParticipantId) {
        throw matchesErrors.requestRejectNotAllowed();
      }
      if (
        status === 'CANCELLED_BY_REQUESTER' &&
        request.requesterParticipantId !== actingParticipantId
      ) {
        throw matchesErrors.requestCancelNotAllowed();
      }

      const updatedRequest = await tx.matchRequest.update({
        where: { id: request.id },
        data: {
          status,
          terminalReason,
          terminalAt: now,
        },
        select: this.matchRequestSummarySelect(),
      });

      return {
        request: this.toMatchRequestSummary(updatedRequest, actingParticipantId),
        activeMatch: null,
      };
    });
  }

  private matchRequestSummarySelect() {
    return {
      id: true,
      seasonId: true,
      requesterParticipantId: true,
      receiverParticipantId: true,
      status: true,
      note: true,
      createdAt: true,
      expiresAt: true,
      terminalAt: true,
      acceptedAt: true,
      terminalReason: true,
      requestChannel: true,
      requesterParticipant: {
        select: {
          userId: true,
        },
      },
      receiverParticipant: {
        select: {
          userId: true,
        },
      },
    } as const;
  }

  private activeMatchSummarySelect(): Prisma.ActiveMatchSelect {
    return {
      id: true,
      seasonId: true,
      participantAId: true,
      participantBId: true,
      status: true,
      startedAt: true,
      endedAt: true,
      endReason: true,
      createdFromRequestId: true,
      participantA: {
        select: {
          userId: true,
        },
      },
      participantB: {
        select: {
          userId: true,
        },
      },
      unmatchRequests: {
        orderBy: [{ requestedAt: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          participantId: true,
          status: true,
          requestedAt: true,
          terminalAt: true,
        },
      },
    };
  }

  private activeMatchCommandSelect(): Prisma.ActiveMatchSelect {
    return {
      id: true,
      seasonId: true,
      participantAId: true,
      participantBId: true,
      status: true,
      startedAt: true,
      endedAt: true,
      endReason: true,
      createdFromRequestId: true,
      participantA: {
        select: {
          userId: true,
          dormitoryId: true,
          dormitorySelectionState: true,
        },
      },
      participantB: {
        select: {
          userId: true,
          dormitoryId: true,
          dormitorySelectionState: true,
        },
      },
      unmatchRequests: {
        orderBy: [{ requestedAt: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          participantId: true,
          status: true,
          requestedAt: true,
          terminalAt: true,
        },
      },
    };
  }

  private toMatchRequestSummary(
    request: MatchRequestRecord,
    viewerParticipantId: string,
  ): MatchRequestSummary {
    const sent = request.requesterParticipantId === viewerParticipantId;

    return {
      id: request.id,
      seasonId: request.seasonId,
      direction: sent ? 'SENT' : 'RECEIVED',
      counterpartUserId: sent
        ? request.receiverParticipant.userId
        : request.requesterParticipant.userId,
      counterpartParticipantId: sent
        ? request.receiverParticipantId
        : request.requesterParticipantId,
      status: request.status,
      note: request.note,
      createdAt: request.createdAt.toISOString(),
      expiresAt: request.expiresAt.toISOString(),
      terminalAt: request.terminalAt?.toISOString() ?? null,
      acceptedAt: request.acceptedAt?.toISOString() ?? null,
      terminalReason: request.terminalReason,
      requestChannel: request.requestChannel,
    };
  }

  private toActiveMatchSummary(
    activeMatch: ActiveMatchRecord,
    viewerParticipantId: string,
  ): ActiveMatchSummary {
    const viewerIsParticipantA = activeMatch.participantAId === viewerParticipantId;

    return {
      id: activeMatch.id,
      seasonId: activeMatch.seasonId,
      counterpartUserId: viewerIsParticipantA
        ? activeMatch.participantB.userId
        : activeMatch.participantA.userId,
      counterpartParticipantId: viewerIsParticipantA
        ? activeMatch.participantBId
        : activeMatch.participantAId,
      status: activeMatch.status,
      startedAt: activeMatch.startedAt.toISOString(),
      endedAt: activeMatch.endedAt?.toISOString() ?? null,
      endReason: activeMatch.endReason as ActiveMatchSummary['endReason'],
      createdFromRequestId: activeMatch.createdFromRequestId,
      unmatchProgress: this.toInactiveUnmatchProgress(),
    };
  }

  private toDetailedActiveMatchSummary(
    activeMatch: ActiveMatchCommandRecord,
    viewerParticipantId: string,
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    now: Date,
  ): ActiveMatchSummary {
    const base = this.toActiveMatchSummary(activeMatch, viewerParticipantId);
    const viewerPendingRequest = activeMatch.unmatchRequests?.find(
      (request) => request.participantId === viewerParticipantId && request.status === 'PENDING',
    );
    const counterpartPendingRequest = activeMatch.unmatchRequests?.find(
      (request) => request.participantId !== viewerParticipantId && request.status === 'PENDING',
    );
    const viewerFulfilledRequest = activeMatch.unmatchRequests?.find(
      (request) =>
        request.participantId === viewerParticipantId &&
        request.status === 'FULFILLED_BY_MUTUAL_CONSENT',
    );
    const counterpartFulfilledRequest = activeMatch.unmatchRequests?.find(
      (request) =>
        request.participantId !== viewerParticipantId &&
        request.status === 'FULFILLED_BY_MUTUAL_CONSENT',
    );
    const unmatchWindowOpen = this.isUnmatchWindowOpen(activeMatch, seasonContext, now);
    const progressCount =
      (viewerPendingRequest ? 1 : 0) +
      (counterpartPendingRequest ? 1 : 0) +
      (viewerFulfilledRequest ? 1 : 0) +
      (counterpartFulfilledRequest ? 1 : 0);
    const completedByMutualConsent =
      activeMatch.status === 'UNMATCHED' &&
      activeMatch.endReason === 'UNMATCHED_BY_MUTUAL_CONSENT' &&
      progressCount >= 2;
    const progressState: ActiveMatchUnmatchProgress['state'] = completedByMutualConsent
      ? 'COMPLETED'
      : viewerPendingRequest
        ? 'WAITING_FOR_COUNTERPART'
        : counterpartPendingRequest
          ? 'WAITING_FOR_ME'
          : 'NONE';

    return {
      ...base,
      unmatchProgress: {
        state: progressState,
        requestedByViewerAt:
          (
            viewerPendingRequest?.requestedAt ??
            viewerFulfilledRequest?.requestedAt ??
            null
          )?.toISOString() ?? null,
        requestedByCounterpartAt:
          (
            counterpartPendingRequest?.requestedAt ??
            counterpartFulfilledRequest?.requestedAt ??
            null
          )?.toISOString() ?? null,
        progressCount: Math.min(progressCount, 2),
        requiredCount: 2,
        canRequest: activeMatch.status === 'ACTIVE' && unmatchWindowOpen && !viewerPendingRequest,
        canCancel:
          activeMatch.status === 'ACTIVE' && unmatchWindowOpen && Boolean(viewerPendingRequest),
        availableUntil:
          activeMatch.status === 'ACTIVE'
            ? this.toUnmatchAvailableUntilIso(activeMatch, seasonContext)
            : null,
      },
    };
  }

  private toInactiveUnmatchProgress(): ActiveMatchUnmatchProgress {
    return {
      state: 'NONE',
      requestedByViewerAt: null,
      requestedByCounterpartAt: null,
      progressCount: 0,
      requiredCount: 2,
      canRequest: false,
      canCancel: false,
      availableUntil: null,
    };
  }

  private toUnmatchAvailableUntilIso(
    activeMatch: ActiveMatchCommandRecord,
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
  ) {
    const roomSelectionDate = this.findActiveMatchRoomSelectionDate(activeMatch, seasonContext);
    return roomSelectionDate ? new Date(`${roomSelectionDate}T23:59:59+09:00`).toISOString() : null;
  }

  private async getCurrentMatchContext(
    userId: string,
    now: Date,
  ): Promise<MatchUserContext | null> {
    const user = await this.getUserSeed(userId);
    if (!user) {
      throw new Error('[MatchesService] authenticated user not found');
    }

    const seasonContext = await this.seasonsService.getCurrentSeasonContext(user.campus, now);
    const participant = user.emailVerifiedAt
      ? await this.seasonParticipantsService.ensureCurrentSeasonParticipantForUser(user, now)
      : null;
    const selection = this.seasonParticipantsService.selectCanonicalSelection(user, participant);

    return {
      user,
      seasonContext,
      participant,
      selection,
    };
  }

  private async synchronizePendingUnmatchRequests(
    activeMatch: ActiveMatchCommandRecord,
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<ActiveMatchCommandRecord> {
    const client = tx ?? this.prisma;
    const hasPendingRequests = activeMatch.unmatchRequests.some(
      (request) => request.status === 'PENDING',
    );

    if (
      activeMatch.status !== 'ACTIVE' ||
      !hasPendingRequests ||
      this.isUnmatchWindowOpen(activeMatch, seasonContext, now)
    ) {
      return activeMatch;
    }

    await client.activeMatchUnmatchRequest.updateMany({
      where: {
        activeMatchId: activeMatch.id,
        status: 'PENDING',
      },
      data: {
        status: 'EXPIRED_BY_CUTOFF',
        terminalAt: now,
      },
    });

    const refreshed = await client.activeMatch.findUnique({
      where: { id: activeMatch.id },
      select: this.activeMatchCommandSelect(),
    });

    if (!refreshed) {
      throw matchesErrors.activeMatchNotFound();
    }

    return refreshed;
  }

  private assertUnmatchActorAllowed(
    activeMatch: ActiveMatchCommandRecord,
    participantId: string,
    errorFactory: () => Error,
  ) {
    if (
      activeMatch.status !== 'ACTIVE' ||
      activeMatch.endedAt !== null ||
      (activeMatch.participantAId !== participantId && activeMatch.participantBId !== participantId)
    ) {
      throw errorFactory();
    }
  }

  private assertCurrentSeasonActiveMatch(
    activeMatch: ActiveMatchCommandRecord,
    currentSeasonId: string,
  ) {
    if (activeMatch.seasonId !== currentSeasonId) {
      throw matchesErrors.unmatchRequestNotAllowed();
    }
  }

  private assertUnmatchWindowOpen(
    activeMatch: ActiveMatchCommandRecord,
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    now: Date,
  ) {
    if (!this.isUnmatchWindowOpen(activeMatch, seasonContext, now)) {
      throw matchesErrors.unmatchRequestNotAllowed(
        '매칭 취소는 같은 기숙사의 roomSelectionDate 전까지만 요청할 수 있습니다.',
      );
    }
  }

  private isUnmatchWindowOpen(
    activeMatch: ActiveMatchCommandRecord,
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    now: Date,
  ) {
    const roomSelectionDate = this.findActiveMatchRoomSelectionDate(activeMatch, seasonContext);
    if (!roomSelectionDate || seasonContext.state !== 'SEASON_MATCHING') {
      return false;
    }

    return formatKstDate(now) <= roomSelectionDate;
  }

  private findActiveMatchRoomSelectionDate(
    activeMatch: ActiveMatchCommandRecord,
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
  ) {
    if (
      activeMatch.participantA.dormitorySelectionState !== 'ASSIGNED' ||
      activeMatch.participantB.dormitorySelectionState !== 'ASSIGNED' ||
      !activeMatch.participantA.dormitoryId ||
      !activeMatch.participantB.dormitoryId ||
      activeMatch.participantA.dormitoryId !== activeMatch.participantB.dormitoryId
    ) {
      return null;
    }

    return (
      seasonContext.operatedDormitories.find(
        (item) => item.dormitoryId === activeMatch.participantA.dormitoryId,
      )?.roomSelectionDate ?? null
    );
  }

  private async getUserSeed(userId: string): Promise<MatchUserSeed | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        emailVerifiedAt: true,
        gender: true,
        campus: true,
        dormitoryId: true,
        dormitorySelectionState: true,
      },
    });
  }

  private async assertNoLivePendingPair(
    tx: Prisma.TransactionClient,
    seasonId: string,
    pairIdentity: ReturnType<typeof buildParticipantPairIdentity>,
  ) {
    const existingPendingRequest = await tx.matchRequest.findFirst({
      where: {
        seasonId,
        pairMinParticipantId: pairIdentity.pairMinParticipantId,
        pairMaxParticipantId: pairIdentity.pairMaxParticipantId,
        status: 'PENDING',
      },
      select: { id: true },
    });

    if (existingPendingRequest) {
      throw matchesErrors.requestAlreadyPending();
    }
  }

  private async assertPendingRequestLimit(
    tx: Prisma.TransactionClient,
    seasonId: string,
    requesterParticipantId: string,
  ) {
    const pendingCount = await tx.matchRequest.count({
      where: {
        seasonId,
        requesterParticipantId,
        status: 'PENDING',
      },
    });

    if (pendingCount >= 3) {
      throw matchesErrors.requestPendingLimitReached();
    }
  }

  private async assertDirectionLimit(
    tx: Prisma.TransactionClient,
    seasonId: string,
    requesterParticipantId: string,
    receiverParticipantId: string,
  ) {
    const directionCount = await tx.matchRequest.count({
      where: {
        seasonId,
        requesterParticipantId,
        receiverParticipantId,
      },
    });

    if (directionCount >= 5) {
      throw matchesErrors.requestDirectionLimitReached();
    }
  }

  private async assertDirectionCooldown(
    tx: Prisma.TransactionClient,
    seasonId: string,
    requesterParticipantId: string,
    receiverParticipantId: string,
    now: Date,
  ) {
    const latestTerminalRequest = await tx.matchRequest.findFirst({
      where: {
        seasonId,
        requesterParticipantId,
        receiverParticipantId,
        status: {
          in: ['REJECTED', 'CANCELLED_BY_REQUESTER', 'EXPIRED'],
        },
        terminalAt: { not: null },
      },
      orderBy: [{ terminalAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        terminalAt: true,
      },
    });
    const latestUnmatchedActive = await tx.activeMatch.findFirst({
      where: {
        seasonId,
        status: 'UNMATCHED',
        endedAt: { not: null },
        createdFromRequest: {
          requesterParticipantId,
          receiverParticipantId,
        },
      },
      orderBy: [{ endedAt: 'desc' }, { startedAt: 'desc' }],
      select: {
        endedAt: true,
      },
    });

    const cooldownReferenceAt = [latestTerminalRequest?.terminalAt, latestUnmatchedActive?.endedAt]
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0];

    if (cooldownReferenceAt && isCooldownActive(cooldownReferenceAt, now)) {
      throw matchesErrors.requestDirectionCooldownActive();
    }
  }

  private async expireDuePendingRequests(
    seasonId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    await client.matchRequest.updateMany({
      where: {
        seasonId,
        status: 'PENDING',
        expiresAt: { lte: now },
      },
      data: {
        status: 'EXPIRED',
        terminalReason: 'EXPIRED',
        terminalAt: now,
      },
    });
  }

  private async acquirePairLock(tx: Prisma.TransactionClient, seasonId: string, pairKey: string) {
    await tx.$queryRawTyped(
      acquireTransactionAdvisoryLock('match_request_pair', `${seasonId}:${pairKey}`),
    );
  }

  private async acquireActiveMatchLock(tx: Prisma.TransactionClient, activeMatchId: string) {
    await tx.$queryRawTyped(acquireTransactionAdvisoryLock('active_match_unmatch', activeMatchId));
  }

  private async acquireParticipantLocks(
    tx: Prisma.TransactionClient,
    seasonId: string,
    participantIds: readonly [string, string],
  ) {
    for (const participantId of participantIds) {
      await tx.$queryRawTyped(
        acquireTransactionAdvisoryLock('participant_active_match', `${seasonId}:${participantId}`),
      );
    }
  }

  private async lockRequestRow(tx: Prisma.TransactionClient, requestId: string) {
    const rows = await tx.$queryRawTyped(lockMatchRequestRow(requestId));

    if (rows.length === 0) {
      throw matchesErrors.requestNotFound();
    }
  }

  private async lockActiveMatchRow(tx: Prisma.TransactionClient, activeMatchId: string) {
    const rows = await tx.$queryRawTyped(lockActiveMatchRow(activeMatchId));

    if (rows.length === 0) {
      throw matchesErrors.activeMatchNotFound();
    }
  }

  private findRoomSelectionDate(
    seasonContext: NonNullable<Awaited<ReturnType<SeasonsService['getCurrentSeasonContext']>>>,
    dormitoryId: string | null,
  ) {
    return (
      seasonContext.operatedDormitories.find((item) => item.dormitoryId === dormitoryId)
        ?.roomSelectionDate ?? null
    );
  }
}
