import type { ActiveMatchSummary, MatchRequestActionResponse } from '@repo/shared/match-contract';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/application/auth-actor-context.types.js';
import type { CurrentSeasonContext } from '../seasons/ports/season-context.port.js';
import { toMatchRequestSummary } from './requests/presenters/match-request.presenter.js';
import type { MatchRequestRecord } from './requests/persistence/match-request.select.js';
import { matchesErrors } from './matches.errors.js';

interface ActiveMatchRecordLike {
  id: string;
}

interface MatchRequestActionContext {
  seasonContext: CurrentSeasonContext | null;
  participant: {
    id: string;
  } | null;
}

interface MatchRequestAcceptanceClusterDeps {
  getDatabaseNow(): Promise<Date>;
  runSerializableTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  getCurrentMatchContext(userId: string, now: Date): Promise<MatchRequestActionContext | null>;
  expireDuePendingRequests(
    seasonId: string,
    now: Date,
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  loadAcceptableMatchRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    receiverParticipantId: string,
    now: Date,
    seasonContext: NonNullable<MatchRequestActionContext['seasonContext']>,
  ): Promise<
    | {
        kind: 'ACCEPTABLE';
        request: MatchRequestRecord;
        pairIdentity: {
          pairKey: string;
          pairMinParticipantId: string;
          pairMaxParticipantId: string;
        };
      }
    | {
        kind: 'TERMINAL';
        request: MatchRequestRecord;
      }
  >;
  executeAcceptMatchRequest(
    tx: Prisma.TransactionClient,
    input: {
      request: MatchRequestRecord;
      pairIdentity: {
        pairKey: string;
        pairMinParticipantId: string;
        pairMaxParticipantId: string;
      };
    },
    now: Date,
  ): Promise<{
    acceptedRequest: MatchRequestRecord;
    activeMatchRecord: ActiveMatchRecordLike;
  }>;
  getDetailedActiveMatchSummaryForViewer(
    client: Prisma.TransactionClient,
    activeMatchId: string,
    viewerParticipantId: string,
    seasonContext: CurrentSeasonContext,
    now: Date,
  ): Promise<ActiveMatchSummary>;
}

export function createMatchRequestCommandCluster(deps: MatchRequestAcceptanceClusterDeps) {
  return {
    async acceptMatchRequest(
      authUser: AuthenticatedUserContext,
      requestId: string,
    ): Promise<MatchRequestActionResponse> {
      const now = await deps.getDatabaseNow();
      const receiverContext = await deps.getCurrentMatchContext(authUser.id, now);

      if (!receiverContext?.seasonContext || !receiverContext.participant) {
        throw matchesErrors.requestRejectNotAllowed();
      }
      const receiverParticipantId = receiverContext.participant.id;
      const receiverSeasonContext = receiverContext.seasonContext;

      return deps.runSerializableTransaction(async (tx) => {
        await deps.expireDuePendingRequests(receiverSeasonContext.season.id, now, tx);
        const acceptanceContext = await deps.loadAcceptableMatchRequest(
          tx,
          requestId,
          receiverParticipantId,
          now,
          receiverSeasonContext,
        );
        if (acceptanceContext.kind === 'TERMINAL') {
          return {
            request: toMatchRequestSummary(acceptanceContext.request, receiverParticipantId),
            activeMatch: null,
          };
        }

        const { acceptedRequest, activeMatchRecord } = await deps.executeAcceptMatchRequest(
          tx,
          acceptanceContext,
          now,
        );
        const activeMatchSummary = await deps.getDetailedActiveMatchSummaryForViewer(
          tx,
          activeMatchRecord.id,
          receiverParticipantId,
          receiverSeasonContext,
          now,
        );

        return {
          request: toMatchRequestSummary(acceptedRequest, receiverParticipantId),
          activeMatch: activeMatchSummary,
        };
      });
    },
  };
}
