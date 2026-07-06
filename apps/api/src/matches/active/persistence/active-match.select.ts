import type { Prisma } from '../../../generated/prisma/client.js';
import { lifestyleColumnSelect } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';

const activeMatchParticipantProfileSelect = {
  ...lifestyleColumnSelect,
  nicknameSnapshot: true,
  intro: true,
} as const;

export const activeMatchSummarySelect = {
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
      user: {
        select: {
          deletedAt: true,
        },
      },
      profile: {
        select: activeMatchParticipantProfileSelect,
      },
    },
  },
  participantB: {
    select: {
      userId: true,
      user: {
        select: {
          deletedAt: true,
        },
      },
      profile: {
        select: activeMatchParticipantProfileSelect,
      },
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
} as const satisfies Prisma.ActiveMatchSelect;

export const activeMatchCommandSelect = {
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
      user: {
        select: {
          deletedAt: true,
        },
      },
      dormitoryId: true,
      dormitorySelectionState: true,
      profile: {
        select: activeMatchParticipantProfileSelect,
      },
    },
  },
  participantB: {
    select: {
      userId: true,
      user: {
        select: {
          deletedAt: true,
        },
      },
      dormitoryId: true,
      dormitorySelectionState: true,
      profile: {
        select: activeMatchParticipantProfileSelect,
      },
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
} as const satisfies Prisma.ActiveMatchSelect;

export type ActiveMatchRecord = Prisma.ActiveMatchGetPayload<{
  select: typeof activeMatchSummarySelect;
}>;

export type ActiveMatchCommandRecord = Prisma.ActiveMatchGetPayload<{
  select: typeof activeMatchCommandSelect;
}>;
