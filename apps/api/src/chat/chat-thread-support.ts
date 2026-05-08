import type { ConversationMessage, ConversationThreadSummary } from '@repo/shared/chat-contract';
import type { Prisma } from '../generated/prisma/client.js';
import type { PrismaService } from '../common/prisma/prisma.service.js';
import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  resolvePublicExposure,
} from '../season-participants/season-participant-policy.js';
import type { CurrentSeasonParticipantRecord } from '../season-participants/season-participants.service.js';
import type { SeasonParticipantsService } from '../season-participants/season-participants.service.js';
import {
  buildCurrentUserCapabilityInput,
  buildPublicExposureTargetInput,
  buildPublicExposureViewerInput,
  toOperatedDormitoryIdSet,
} from '../season-participants/season-participant-gate-context.js';
import {
  formatKstDate,
  getEffectiveSeasonState,
  normalizeSeasonRuntimeRow,
} from '../seasons/season.utils.js';
import { chatErrors } from './chat.errors.js';
import type { ChatUserContext } from './chat-context-owner.js';
import type { ChatUserSeed, ThreadRecord } from './chat-selects.js';

type ChatDbClient = Prisma.TransactionClient | PrismaService;

interface ChatThreadSupportOwnerDeps {
  prisma: PrismaService;
  seasonParticipantsService: SeasonParticipantsService;
}

export function createChatThreadSupportOwner(deps: ChatThreadSupportOwnerDeps) {
  return {
    getThreadMember(thread: ThreadRecord, participantId: string) {
      return thread.members.find((member) => member.participantId === participantId) ?? null;
    },

    resolveThreadSeasonState(thread: ThreadRecord, now: Date) {
      return getEffectiveSeasonState(normalizeSeasonRuntimeRow(thread.season), now);
    },

    findThreadRoomSelectionDate(thread: ThreadRecord) {
      const dormitoryId = thread.participantA.dormitoryId ?? thread.participantB.dormitoryId;
      const operation = thread.season.dormitoryOperations.find(
        (item) => item.dormitoryId === dormitoryId,
      );
      return operation ? formatKstDate(operation.roomSelectionDate) : null;
    },

    isViewerInThread(thread: ThreadRecord, userId: string) {
      return thread.participantA.userId === userId || thread.participantB.userId === userId;
    },

    resolveViewerParticipantId(thread: ThreadRecord, viewerUserId: string) {
      if (thread.participantA.userId === viewerUserId) {
        return thread.participantAId;
      }
      if (thread.participantB.userId === viewerUserId) {
        return thread.participantBId;
      }
      throw chatErrors.threadNotFound();
    },

    isThreadParticipant(thread: ThreadRecord, participantId: string) {
      return thread.participantAId === participantId || thread.participantBId === participantId;
    },

    isThreadWritable(thread: ThreadRecord, viewerParticipantId: string, now: Date) {
      if (thread.status !== 'OPEN') {
        return false;
      }
      if (!this.isThreadParticipant(thread, viewerParticipantId)) {
        return false;
      }

      if (thread.threadKind === 'MATCHED') {
        const state = this.resolveThreadSeasonState(thread, now);
        return state === 'SEASON_MATCHING' || state === 'SEASON_POST_MATCH';
      }

      const roomSelectionDate = this.findThreadRoomSelectionDate(thread);
      return roomSelectionDate ? formatKstDate(now) <= roomSelectionDate : false;
    },

    toThreadSummary(
      thread: ThreadRecord,
      viewerParticipantId: string,
      canSendMessage: boolean,
    ): ConversationThreadSummary {
      const viewerIsParticipantA = thread.participantAId === viewerParticipantId;

      return {
        id: thread.id,
        seasonId: thread.seasonId,
        counterpartUserId: viewerIsParticipantA
          ? thread.participantB.userId
          : thread.participantA.userId,
        counterpartParticipantId: viewerIsParticipantA
          ? thread.participantBId
          : thread.participantAId,
        threadKind: thread.threadKind,
        status: thread.status,
        closedReason: thread.closedReason,
        closedAt: thread.closedAt?.toISOString() ?? null,
        lastMessageAt: thread.lastMessageAt?.toISOString() ?? null,
        canSendMessage,
        canReport: true,
      };
    },

    toMessage(message: ThreadRecord['messages'][number]): ConversationMessage {
      return {
        id: message.id,
        senderUserId: message.senderParticipant.userId,
        body: message.body,
        sentAt: message.sentAt.toISOString(),
      };
    },

    async canSendMessageToPair(
      viewerContext: ChatUserContext,
      targetUser: ChatUserSeed,
      targetParticipant: CurrentSeasonParticipantRecord,
      thread: ThreadRecord | null,
      now: Date,
      client: ChatDbClient = deps.prisma,
    ) {
      const seasonContext = viewerContext.seasonContext;
      const viewerParticipant = viewerContext.participant;
      if (!seasonContext || !viewerParticipant) {
        return false;
      }

      if (thread) {
        const viewerMember = this.getThreadMember(thread, viewerParticipant.id);
        if (viewerMember?.memberState === 'ACTIVE') {
          return this.isThreadWritable(thread, viewerParticipant.id, now);
        }

        if (viewerMember?.memberState === 'LEFT') {
          return thread.status === 'OPEN';
        }
      }

      const targetSelection = deps.seasonParticipantsService.selectCanonicalSelection(
        targetUser,
        targetParticipant,
      );
      const viewerPairActiveMatch = await client.activeMatch.findFirst({
        where: {
          seasonId: seasonContext.season.id,
          endedAt: null,
          OR: [{ participantAId: viewerParticipant.id }, { participantBId: viewerParticipant.id }],
        },
        select: {
          id: true,
          participantAId: true,
          participantBId: true,
        },
      });
      const targetPairActiveMatch = await client.activeMatch.findFirst({
        where: {
          seasonId: seasonContext.season.id,
          endedAt: null,
          OR: [{ participantAId: targetParticipant.id }, { participantBId: targetParticipant.id }],
        },
        select: {
          id: true,
          participantAId: true,
          participantBId: true,
        },
      });
      const matchedPartnerParticipantId = viewerPairActiveMatch
        ? viewerPairActiveMatch.participantAId === viewerParticipant.id
          ? viewerPairActiveMatch.participantBId
          : viewerPairActiveMatch.participantAId
        : null;
      const operatedDormitoryIds = toOperatedDormitoryIdSet(seasonContext);
      const viewerCurrentDormitoryCanMatch = canCurrentDormitoryMatch(
        seasonContext,
        viewerContext.selection.dormitoryId,
        now,
      );
      const canStartChat = buildCurrentUserCapabilities(
        buildCurrentUserCapabilityInput({
          campusOperated: true,
          seasonState: seasonContext.state,
          participant: viewerParticipant,
          participantMatched: viewerPairActiveMatch !== null,
          selection: viewerContext.selection,
          operatedDormitoryIds,
          currentDormitoryCanMatch: viewerCurrentDormitoryCanMatch,
          nicknameLockedBySeason: false,
          nicknameCooldownActive: false,
        }),
      ).canStartChat;
      const exposure = resolvePublicExposure(
        buildPublicExposureViewerInput({
          campusOperated: true,
          seasonState: seasonContext.state,
          participant: viewerParticipant,
          matched: viewerPairActiveMatch !== null,
          matchedPartnerParticipantId,
          selection: viewerContext.selection,
          operatedDormitoryIds,
          currentDormitoryCanMatch: viewerCurrentDormitoryCanMatch,
        }),
        buildPublicExposureTargetInput({
          seasonState: seasonContext.state,
          operatedDormitoryIds,
          participant: targetParticipant,
          matched: targetPairActiveMatch !== null,
          selection: targetSelection,
        }),
      );

      return canStartChat && exposure.exposureLevel === 'FULL';
    },
  };
}
