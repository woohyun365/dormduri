import type { Prisma } from '../../../generated/prisma/client.js';
import { lifestyleColumnSelect } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';

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
        select: lifestyleColumnSelect,
      },
    },
  },
  participantB: {
    select: {
      userId: true,
      profile: {
        select: lifestyleColumnSelect,
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
        select: lifestyleColumnSelect,
      },
    },
  },
  participantB: {
    select: {
      userId: true,
      dormitoryId: true,
      dormitorySelectionState: true,
      profile: {
        select: lifestyleColumnSelect,
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
