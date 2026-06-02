import type { ChatSendMessageUnavailableReason } from '@repo/shared/chat-contract';
import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  buildCurrentUserCapabilities,
  canCurrentDormitoryMatch,
  resolvePublicTargetPolicy,
} from '../../season-participants/season-participant-policy.js';
import type { CurrentSeasonParticipantRecord } from '../../season-participants/season-participants.service.js';
import type { SeasonParticipantsService } from '../../season-participants/season-participants.service.js';
import {
  buildCurrentUserCapabilityInput,
  buildPublicTargetPolicyTargetInput,
  buildPublicTargetPolicyViewerInput,
  toOperatedDormitoryIdSet,
} from '../../season-participants/season-participant-gate-context.js';
import {
  formatKstDate,
  getEffectiveSeasonState,
  normalizeSeasonRuntimeRow,
} from '../../seasons/season.utils.js';
import { chatErrors } from '../errors/chat.errors.js';
import type { ChatUserContext } from '../application/chat-user-context.service.js';
import { parseLifestyleOrNull } from '../../profiles/profile.mapper.js';
import type {
  ChatParticipantUserProjection,
  ThreadRecord,
} from '../persistence/chat-thread.select.js';

type ChatDbClient = Prisma.TransactionClient | PrismaService;

export interface ChatSendMessageDecision {
  canSendMessage: boolean;
  unavailableReason: ChatSendMessageUnavailableReason | null;
}

const canSendMessageDecision = (): ChatSendMessageDecision => ({
  canSendMessage: true,
  unavailableReason: null,
});

const cannotSendMessageDecision = (
  unavailableReason: ChatSendMessageUnavailableReason,
): ChatSendMessageDecision => ({
  canSendMessage: false,
  unavailableReason,
});

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

    resolveThreadSendMessageDecision(
      thread: ThreadRecord,
      viewerParticipantId: string,
      now: Date,
    ): ChatSendMessageDecision {
      const viewerMember = this.getThreadMember(thread, viewerParticipantId);
      if (!this.isThreadParticipant(thread, viewerParticipantId)) {
        return cannotSendMessageDecision('SAFETY_OR_VISIBILITY_RESTRICTED');
      }
      if (viewerMember?.memberState === 'LEFT') {
        return cannotSendMessageDecision('MEMBER_LEFT');
      }
      if (thread.status === 'ARCHIVED') {
        return cannotSendMessageDecision('ARCHIVED_THREAD');
      }
      if (thread.status !== 'OPEN') {
        return cannotSendMessageDecision(
          thread.closedReason === 'SEASON_ENDED' ? 'SEASON_ENDED' : 'THREAD_READ_ONLY',
        );
      }

      if (thread.threadKind === 'MATCHED') {
        const state = this.resolveThreadSeasonState(thread, now);
        if (state === 'SEASON_MATCHING' || state === 'SEASON_POST_MATCH') {
          return canSendMessageDecision();
        }
        return cannotSendMessageDecision('SEASON_ENDED');
      }

      const roomSelectionDate = this.findThreadRoomSelectionDate(thread);
      if (roomSelectionDate && formatKstDate(now) <= roomSelectionDate) {
        return canSendMessageDecision();
      }

      return cannotSendMessageDecision('THREAD_READ_ONLY');
    },

    isThreadWritable(thread: ThreadRecord, viewerParticipantId: string, now: Date) {
      return this.resolveThreadSendMessageDecision(thread, viewerParticipantId, now).canSendMessage;
    },

    resolveThreadSummarySendMessageDecision(
      thread: ThreadRecord,
      viewerParticipantId: string,
      now: Date,
    ): ChatSendMessageDecision {
      return this.resolveThreadSendMessageDecision(thread, viewerParticipantId, now);
    },

    resolveMatchedPairThreadSendMessageDecision(
      thread: ThreadRecord,
      viewerParticipantId: string,
      now: Date,
    ): ChatSendMessageDecision {
      if (thread.status !== 'OPEN') {
        return cannotSendMessageDecision(
          thread.closedReason === 'SEASON_ENDED' ? 'SEASON_ENDED' : 'THREAD_READ_ONLY',
        );
      }
      if (!this.isThreadParticipant(thread, viewerParticipantId)) {
        return cannotSendMessageDecision('SAFETY_OR_VISIBILITY_RESTRICTED');
      }

      const viewerMember = this.getThreadMember(thread, viewerParticipantId);
      if (viewerMember?.memberState === 'LEFT') {
        return cannotSendMessageDecision('MEMBER_LEFT');
      }

      const state = this.resolveThreadSeasonState(thread, now);
      return state === 'SEASON_MATCHING' || state === 'SEASON_POST_MATCH'
        ? canSendMessageDecision()
        : cannotSendMessageDecision('SEASON_ENDED');
    },

    async canSendMessageToPair(
      viewerContext: ChatUserContext,
      targetUser: ChatParticipantUserProjection,
      targetParticipant: CurrentSeasonParticipantRecord,
      thread: ThreadRecord | null,
      now: Date,
      client: ChatDbClient = deps.prisma,
    ) {
      const seasonContext = viewerContext.seasonContext;
      const viewerParticipant = viewerContext.participant;
      if (!seasonContext || !viewerParticipant) {
        return cannotSendMessageDecision('DIRECT_ACTION_NOT_ALLOWED');
      }

      const viewerLifestyle = parseLifestyleOrNull(viewerParticipant.profile?.lifestyle ?? null);
      const viewerSeasonProfileComplete =
        viewerLifestyle !== null && isSeasonProfileComplete(viewerLifestyle);
      if (!viewerSeasonProfileComplete) {
        return cannotSendMessageDecision('DIRECT_ACTION_NOT_ALLOWED');
      }

      const targetSelection =
        deps.seasonParticipantsService.selectCanonicalSelection(targetParticipant);
      const targetRegistrationSnapshotExists =
        await deps.seasonParticipantsService.hasRegistrationSnapshotForParticipant(
          targetParticipant.id,
          client,
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
      const pairHasActiveMatch = matchedPartnerParticipantId === targetParticipant.id;
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
          seasonProfileComplete: viewerSeasonProfileComplete,
          selection: viewerContext.selection,
          operatedDormitoryIds,
          currentDormitoryCanMatch: viewerCurrentDormitoryCanMatch,
          nicknameLockedBySeason: false,
          nicknameCooldownActive: false,
        }),
      ).canStartChat;
      const publicTargetPolicy = resolvePublicTargetPolicy(
        buildPublicTargetPolicyViewerInput({
          campusOperated: true,
          seasonState: seasonContext.state,
          participant: viewerParticipant,
          matched: viewerPairActiveMatch !== null,
          seasonProfileComplete: viewerSeasonProfileComplete,
          matchedPartnerParticipantId,
          selection: viewerContext.selection,
          operatedDormitoryIds,
          currentDormitoryCanMatch: viewerCurrentDormitoryCanMatch,
        }),
        buildPublicTargetPolicyTargetInput({
          operatedDormitoryIds,
          participant: targetParticipant,
          matched: targetPairActiveMatch !== null,
          selection: targetSelection,
          registrationSnapshotExists: targetRegistrationSnapshotExists,
        }),
      );
      const directThreadActionEligible = canStartChat && publicTargetPolicy.actions.canStartChat;
      const directThreadActionUnavailableReason =
        publicTargetPolicy.actions.unavailableReasons.includes('TARGET_DELETED_OR_DEIDENTIFIED')
          ? 'TARGET_DELETED_OR_DEIDENTIFIED'
          : 'DIRECT_ACTION_NOT_ALLOWED';

      if (thread) {
        const viewerMember = this.getThreadMember(thread, viewerParticipant.id);
        if (viewerMember?.memberState === 'ACTIVE') {
          if (thread.threadKind === 'MATCHED' || pairHasActiveMatch) {
            return pairHasActiveMatch
              ? this.resolveMatchedPairThreadSendMessageDecision(thread, viewerParticipant.id, now)
              : this.resolveThreadSendMessageDecision(thread, viewerParticipant.id, now);
          }
          const threadDecision = this.resolveThreadSendMessageDecision(
            thread,
            viewerParticipant.id,
            now,
          );
          return directThreadActionEligible && threadDecision.canSendMessage
            ? canSendMessageDecision()
            : cannotSendMessageDecision(
                threadDecision.unavailableReason ?? directThreadActionUnavailableReason,
              );
        }

        if (viewerMember?.memberState === 'LEFT') {
          if (pairHasActiveMatch) {
            return thread.status === 'OPEN'
              ? canSendMessageDecision()
              : cannotSendMessageDecision(
                  thread.closedReason === 'SEASON_ENDED' ? 'SEASON_ENDED' : 'THREAD_READ_ONLY',
                );
          }
          return directThreadActionEligible && thread.status === 'OPEN'
            ? canSendMessageDecision()
            : cannotSendMessageDecision(
                thread.status === 'OPEN' ? directThreadActionUnavailableReason : 'THREAD_READ_ONLY',
              );
        }
      }

      return directThreadActionEligible
        ? canSendMessageDecision()
        : cannotSendMessageDecision(directThreadActionUnavailableReason);
    },
  };
}
