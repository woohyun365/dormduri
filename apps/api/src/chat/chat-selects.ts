import type { Prisma } from '../generated/prisma/client.js';
import type { DormitorySelectionState } from '../generated/prisma/enums.js';
import type { ParticipantBackfillSeed } from '../season-participants/season-participants.service.js';

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
      lastVisibleAt: true,
    },
  },
  messages: {
    orderBy: [{ sentAt: 'asc' as const }, { createdAt: 'asc' as const }],
    select: {
      id: true,
      body: true,
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

export type ChatUserSeed = ParticipantBackfillSeed & {
  id: string;
  gender: 'M' | 'F';
  campus: 'CHUNCHEON' | 'SAMCHEOK' | 'DOGYE';
  dormitorySelectionState: DormitorySelectionState;
  profile: {
    lifestyle: unknown;
  } | null;
};
