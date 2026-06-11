import { isSeasonProfileComplete } from '@repo/shared/lifestyle';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';
import { buildCurrentUserCapabilities } from '../../season-participants/capabilities/index.js';
import { canCurrentDormitoryMatch } from '../../season-participants/policies/index.js';
import { resolvePublicTargetPolicy } from '../../season-participants/public-target-policy/index.js';
import type { CurrentSeasonParticipantRecord } from '../../season-participants/application/season-participants.service.js';
import type { SeasonParticipantsService } from '../../season-participants/application/season-participants.service.js';
import { buildCurrentUserCapabilityInput } from '../../season-participants/capabilities/index.js';
import {
  buildPublicTargetPolicyTargetInput,
  buildPublicTargetPolicyViewerInput,
  toOperatedDormitoryIdSet,
} from '../../season-participants/public-target-policy/index.js';
import { formatKstDate } from '../../platform/time/kst-date.js';
import {
  getEffectiveSeasonState,
  normalizeSeasonRuntimeRow,
} from '../../seasons/ports/season-context.port.js';
import { chatErrors } from '../errors/chat.errors.js';
import type { ChatUserContext } from '../application/chat-user-context.service.js';
import { parseLifestyleOrNull } from '../../profiles/profile.mapper.js';
import type {
  ChatParticipantUserProjection,
  ThreadRecord,
} from '../persistence/chat-thread.select.js';
import {
  canSendMessageDecision,
  cannotSendMessageDecision,
  getThreadMember,
  isThreadParticipant,
  isViewerInThread,
  resolveMatchedPairThreadSendMessageDecision,
  resolveThreadSendMessageDecision,
  resolveViewerParticipantIdOrNull,
  type ChatSendMessageDecision,
} from './chat-thread-permission.policy.js';

type ChatDbClient = Prisma.TransactionClient | PrismaService;

function isBlockClosedDirectThread(thread: ThreadRecord): boolean {
  return (
    thread.threadKind === 'DIRECT' &&
    thread.activeMatchId === null &&
    thread.status === 'READ_ONLY' &&
    thread.closedReason === 'USER_BLOCKED'
  );
}

interface ChatThreadSupportOwnerDeps {
  prisma: PrismaService;
  seasonParticipantsService: SeasonParticipantsService;
}

export function createChatThreadSupportOwner(deps: ChatThreadSupportOwnerDeps) {
  return {
    getThreadMember(thread: ThreadRecord, participantId: string) {
      return getThreadMember(thread, participantId);
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
      return isViewerInThread(thread, userId);
    },

    resolveViewerParticipantId(thread: ThreadRecord, viewerUserId: string) {
      const viewerParticipantId = resolveViewerParticipantIdOrNull(thread, viewerUserId);
      if (viewerParticipantId) {
        return viewerParticipantId;
      }
      throw chatErrors.threadNotFound();
    },

    isThreadParticipant(thread: ThreadRecord, participantId: string) {
      return isThreadParticipant(thread, participantId);
    },

    resolveThreadSendMessageDecision(
      thread: ThreadRecord,
      viewerParticipantId: string,
      now: Date,
    ): ChatSendMessageDecision {
      return resolveThreadSendMessageDecision({
        thread,
        viewerParticipantId,
        now,
        findThreadRoomSelectionDate: (thread) => this.findThreadRoomSelectionDate(thread),
        resolveThreadSeasonState: (thread, now) => this.resolveThreadSeasonState(thread, now),
      });
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
      return resolveMatchedPairThreadSendMessageDecision({
        thread,
        viewerParticipantId,
        now,
        resolveThreadSeasonState: (thread, now) => this.resolveThreadSeasonState(thread, now),
      });
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
      const activeBlock = await client.userBlock.findFirst({
        where: {
          unblockedAt: null,
          OR: [
            { blockerUserId: viewerContext.user.id, blockedUserId: targetUser.id },
            { blockerUserId: targetUser.id, blockedUserId: viewerContext.user.id },
          ],
        },
        select: { id: true },
      });
      if (activeBlock) {
        return cannotSendMessageDecision('SAFETY_OR_VISIBILITY_RESTRICTED');
      }

      if (thread) {
        const viewerMember = this.getThreadMember(thread, viewerParticipant.id);
        if (viewerMember?.memberState === 'ACTIVE') {
          if (thread.threadKind === 'MATCHED' || pairHasActiveMatch) {
            return pairHasActiveMatch
              ? this.resolveMatchedPairThreadSendMessageDecision(thread, viewerParticipant.id, now)
              : this.resolveThreadSendMessageDecision(thread, viewerParticipant.id, now);
          }
          if (isBlockClosedDirectThread(thread)) {
            return directThreadActionEligible
              ? canSendMessageDecision()
              : cannotSendMessageDecision(directThreadActionUnavailableReason);
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
          if (isBlockClosedDirectThread(thread)) {
            return directThreadActionEligible
              ? canSendMessageDecision()
              : cannotSendMessageDecision(directThreadActionUnavailableReason);
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
