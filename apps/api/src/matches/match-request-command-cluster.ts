import type {
  ActiveMatchSummary,
  CreateMatchRequestRequest,
  MatchRequestActionResponse,
} from '@repo/shared/match-contract';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUserContext } from '../auth/auth-session.service.js';
import type { CurrentSeasonContext } from '../seasons/season.types.js';
import { toMatchRequestSummary, type MatchRequestRecord } from './match-read-model.js';

interface PreparedMatchRequestCreationLike {
  seasonId: string;
  requesterParticipantId: string;
  receiverParticipantId: string;
  pairIdentity: {
    pairKey: string;
    pairMinParticipantId: string;
    pairMaxParticipantId: string;
  };
  requesterRoomSelectionDate: string;
  note: string | null;
  requestChannel: CreateMatchRequestRequest['channel'] | null;
}

interface ActiveMatchRecordLike {
  id: string;
}

interface MatchRequestActionContext {
  seasonContext: CurrentSeasonContext | null;
  participant: {
    id: string;
  } | null;
}

type TerminalMatchRequestStatus = 'REJECTED' | 'CANCELLED_BY_REQUESTER';
type TerminalMatchRequestReason = 'REJECTED_BY_RECEIVER' | 'CANCELLED_BY_REQUESTER';

interface MatchRequestCommandClusterDeps {
  getDatabaseNow(): Promise<Date>;
  runSerializableTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
  prepareMatchRequestCreation(
    requesterUserId: string,
    input: CreateMatchRequestRequest,
    now: Date,
  ): Promise<PreparedMatchRequestCreationLike>;
  createPendingMatchRequest(
    tx: Prisma.TransactionClient,
    input: PreparedMatchRequestCreationLike,
    now: Date,
  ): Promise<MatchRequestRecord>;
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
  ): Promise<{
    request: MatchRequestRecord;
    pairIdentity: {
      pairKey: string;
      pairMinParticipantId: string;
      pairMaxParticipantId: string;
    };
  }>;
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
  getRequestTerminalNotAllowedError(status: TerminalMatchRequestStatus): Error;
  loadTerminableMatchRequest(
    tx: Prisma.TransactionClient,
    requestId: string,
    actingParticipantId: string,
    status: TerminalMatchRequestStatus,
    now: Date,
  ): Promise<MatchRequestRecord>;
  executeTerminalMatchRequestUpdate(
    tx: Prisma.TransactionClient,
    request: MatchRequestRecord,
    status: TerminalMatchRequestStatus,
    terminalReason: TerminalMatchRequestReason,
    now: Date,
  ): Promise<MatchRequestRecord>;
}

export function createMatchRequestCommandCluster(deps: MatchRequestCommandClusterDeps) {
  return {
    async createMatchRequest(
      authUser: AuthenticatedUserContext,
      input: CreateMatchRequestRequest,
    ): Promise<MatchRequestActionResponse> {
      const now = await deps.getDatabaseNow();
      const prepared = await deps.prepareMatchRequestCreation(authUser.id, input, now);
      const createdRequest = await deps.runSerializableTransaction((tx) =>
        deps.createPendingMatchRequest(tx, prepared, now),
      );

      return {
        request: toMatchRequestSummary(createdRequest, prepared.requesterParticipantId),
        activeMatch: null,
      };
    },

    async acceptMatchRequest(
      authUser: AuthenticatedUserContext,
      requestId: string,
    ): Promise<MatchRequestActionResponse> {
      const now = await deps.getDatabaseNow();
      const receiverContext = await deps.getCurrentMatchContext(authUser.id, now);

      if (!receiverContext?.seasonContext || !receiverContext.participant) {
        throw deps.getRequestTerminalNotAllowedError('REJECTED');
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
        );
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

    async rejectMatchRequest(
      authUser: AuthenticatedUserContext,
      requestId: string,
    ): Promise<MatchRequestActionResponse> {
      return this.resolveRequestAsTerminal(authUser, requestId, 'REJECTED', 'REJECTED_BY_RECEIVER');
    },

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
    },

    async resolveRequestAsTerminal(
      authUser: AuthenticatedUserContext,
      requestId: string,
      status: TerminalMatchRequestStatus,
      terminalReason: TerminalMatchRequestReason,
    ): Promise<MatchRequestActionResponse> {
      const now = await deps.getDatabaseNow();
      const currentContext = await deps.getCurrentMatchContext(authUser.id, now);

      if (!currentContext?.seasonContext || !currentContext.participant) {
        throw deps.getRequestTerminalNotAllowedError(status);
      }
      const actingParticipantId = currentContext.participant.id;
      const currentSeasonContext = currentContext.seasonContext;

      return deps.runSerializableTransaction(async (tx) => {
        await deps.expireDuePendingRequests(currentSeasonContext.season.id, now, tx);
        const request = await deps.loadTerminableMatchRequest(
          tx,
          requestId,
          actingParticipantId,
          status,
          now,
        );
        const updatedRequest = await deps.executeTerminalMatchRequestUpdate(
          tx,
          request,
          status,
          terminalReason,
          now,
        );

        return {
          request: toMatchRequestSummary(updatedRequest, actingParticipantId),
          activeMatch: null,
        };
      });
    },
  };
}
