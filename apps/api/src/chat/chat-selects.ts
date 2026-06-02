import type { Prisma } from '../generated/prisma/client.js';
import type { SeasonParticipantEnsureInput } from '../season-participants/season-participants.service.js';

export const threadSelect = {
  id: true,
  seasonId: true,
  pairKey: true,
  participantAId: true,
  participantBId: true,
  openedByParticipantId: true,
  threadKind: true,
  activeMatchId: true,
  status: true,
  closedReason: true,
  closedAt: true,
  lastMessageAt: true,
  createdAt: true,
  updatedAt: true,
  season: {
    select: {
      id: true,
      campusCode: true,
      name: true,
      preparationStartDate: true,
      matchingStartDate: true,
      seasonEndDate: true,
      overrideState: true,
      overrideReason: true,
      overrideStartedAt: true,
      overrideEndsAt: true,
      dormitoryOperations: {
        select: {
          dormitoryId: true,
          isOperated: true,
          roomSelectionDate: true,
        },
      },
    },
  },
  participantA: {
    select: {
      id: true,
      userId: true,
      dormitoryId: true,
      dormitorySelectionState: true,
    },
  },
  participantB: {
    select: {
      id: true,
      userId: true,
      dormitoryId: true,
      dormitorySelectionState: true,
    },
  },
  activeMatch: {
    select: {
      id: true,
      participantAId: true,
      participantBId: true,
      createdFromRequestId: true,
      startedAt: true,
      endedAt: true,
    },
  },
  members: {
    select: {
      participantId: true,
      memberState: true,
      leftAt: true,
      lastReadAt: true,
      lastReadMessageId: true,
      lastVisibleAt: true,
    },
  },
  messages: {
    orderBy: [{ sentAt: 'asc' as const }, { id: 'asc' as const }],
    select: {
      id: true,
      body: true,
      bodyState: true,
      tombstoneReason: true,
      bodyVersion: true,
      sentAt: true,
      senderParticipant: {
        select: {
          userId: true,
        },
      },
    },
  },
} satisfies Prisma.ConversationThreadSelect;

export type ThreadRecord = Prisma.ConversationThreadGetPayload<{ select: typeof threadSelect }>;

export const threadListSelect = {
  ...threadSelect,
  messages: false,
} satisfies Prisma.ConversationThreadSelect;

export type ThreadListRecord = Prisma.ConversationThreadGetPayload<{
  select: typeof threadListSelect;
}>;

export function toThreadRecordWithEmptyMessages(thread: ThreadListRecord): ThreadRecord {
  return {
    ...thread,
    messages: [],
  };
}

export type ChatParticipantUserProjection = SeasonParticipantEnsureInput & {
  id: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
};
