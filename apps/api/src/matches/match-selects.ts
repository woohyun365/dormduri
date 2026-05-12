import type { Prisma } from '../generated/prisma/client.js';

export const matchRequestSummarySelect = {
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
} as const satisfies Prisma.MatchRequestSelect;

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
      profile: {
        select: {
          lifestyle: true,
        },
      },
    },
  },
  participantB: {
    select: {
      userId: true,
      profile: {
        select: {
          lifestyle: true,
        },
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
      dormitoryId: true,
      dormitorySelectionState: true,
      profile: {
        select: {
          lifestyle: true,
        },
      },
    },
  },
  participantB: {
    select: {
      userId: true,
      dormitoryId: true,
      dormitorySelectionState: true,
      profile: {
        select: {
          lifestyle: true,
        },
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

export type MatchRequestRecord = Prisma.MatchRequestGetPayload<{
  select: typeof matchRequestSummarySelect;
}>;

export type ActiveMatchRecord = Prisma.ActiveMatchGetPayload<{
  select: typeof activeMatchSummarySelect;
}>;

export type ActiveMatchCommandRecord = Prisma.ActiveMatchGetPayload<{
  select: typeof activeMatchCommandSelect;
}>;
