import type { ActiveMatchActionResponse } from '@repo/shared/match-contract';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { matchesErrors } from './matches.errors.js';
import { toDetailedActiveMatchSummary, type ActiveMatchCommandRecord } from './match-read-model.js';
import { activeMatchCommandSelect } from './match-selects.js';
import { assertUnmatchActorAllowed } from './match-unmatch-support.js';

interface UnmatchActionContext {
  seasonContext: CurrentSeasonContext | null;
  participant: {
    id: string;
  } | null;
}

interface MatchUnmatchCommandClusterDeps {
  getDatabaseNow(): Promise<Date>;
  runSerializableTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  getCurrentMatchContext(userId: string, now: Date): Promise<UnmatchActionContext | null>;
  loadValidatedActiveMatchForUnmatch(
    tx: Prisma.TransactionClient,
    activeMatchId: string,
    seasonContext: CurrentSeasonContext,
    now: Date,
  ): Promise<ActiveMatchCommandRecord>;
  reloadActiveMatchOrThrow(
    tx: Prisma.TransactionClient,
    activeMatchId: string,
  ): Promise<ActiveMatchCommandRecord>;
  handleActiveMatchUnmatched(
    tx: Prisma.TransactionClient,
    input: { activeMatchId: string },
    now: Date,
  ): Promise<void>;
}

export function createMatchUnmatchCommandCluster(deps: MatchUnmatchCommandClusterDeps) {
  return {
    async requestUnmatch(
      authUser: AuthenticatedUserContext,
      activeMatchId: string,
    ): Promise<ActiveMatchActionResponse> {
      const now = await deps.getDatabaseNow();
      const currentContext = await deps.getCurrentMatchContext(authUser.id, now);

      if (!currentContext?.seasonContext || !currentContext.participant) {
        throw matchesErrors.unmatchRequestNotAllowed();
      }
      const participantId = currentContext.participant.id;
      const seasonContext = currentContext.seasonContext;

      return deps.runSerializableTransaction(async (tx) => {
        const synchronizedActiveMatch = await deps.loadValidatedActiveMatchForUnmatch(
          tx,
          activeMatchId,
          seasonContext,
          now,
        );
        assertUnmatchActorAllowed(synchronizedActiveMatch, participantId, () =>
          matchesErrors.unmatchRequestNotAllowed(),
        );

        const existingPendingRequest = synchronizedActiveMatch.unmatchRequests.find(
          (request) => request.participantId === participantId && request.status === 'PENDING',
        );
        if (existingPendingRequest) {
          throw matchesErrors.unmatchRequestAlreadySubmitted();
        }

        try {
          await tx.activeMatchUnmatchRequest.create({
            data: {
              activeMatchId: synchronizedActiveMatch.id,
              participantId,
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
          const refreshedActiveMatch = await deps.reloadActiveMatchOrThrow(
            tx,
            synchronizedActiveMatch.id,
          );

          return {
            activeMatch: toDetailedActiveMatchSummary(
              refreshedActiveMatch,
              participantId,
              seasonContext,
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

        await deps.handleActiveMatchUnmatched(
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
          select: activeMatchCommandSelect,
        });

        return {
          activeMatch: toDetailedActiveMatchSummary(
            endedActiveMatch,
            participantId,
            seasonContext,
            now,
          ),
        };
      });
    },

    async cancelUnmatchRequest(
      authUser: AuthenticatedUserContext,
      activeMatchId: string,
    ): Promise<ActiveMatchActionResponse> {
      const now = await deps.getDatabaseNow();
      const currentContext = await deps.getCurrentMatchContext(authUser.id, now);

      if (!currentContext?.seasonContext || !currentContext.participant) {
        throw matchesErrors.unmatchRequestCancelNotAllowed();
      }
      const participantId = currentContext.participant.id;
      const seasonContext = currentContext.seasonContext;

      return deps.runSerializableTransaction(async (tx) => {
        const synchronizedActiveMatch = await deps.loadValidatedActiveMatchForUnmatch(
          tx,
          activeMatchId,
          seasonContext,
          now,
        );

        const [viewerPendingRequest] = await tx.activeMatchUnmatchRequest.findMany({
          where: {
            activeMatchId: synchronizedActiveMatch.id,
            participantId,
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

        const refreshedActiveMatch = await deps.reloadActiveMatchOrThrow(
          tx,
          synchronizedActiveMatch.id,
        );

        return {
          activeMatch: toDetailedActiveMatchSummary(
            refreshedActiveMatch,
            participantId,
            seasonContext,
            now,
          ),
        };
      });
    },
  };
}
