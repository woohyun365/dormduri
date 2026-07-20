import type { Prisma } from '../../generated/prisma/client.js';
import { matchRequestSummarySelect } from '../requests/persistence/match-request.select.js';

export const matchOverviewRequestSelect = {
  ...matchRequestSummarySelect,
  systemCancellationActiveMatchId: true,
  systemCancellationActiveMatch: {
    select: {
      participantAId: true,
      participantBId: true,
    },
  },
} as const satisfies Prisma.MatchRequestSelect;

export const currentActivityActiveMatchSelect = {
  id: true,
  participantAId: true,
  participantBId: true,
  status: true,
  startedAt: true,
  endedAt: true,
  endReason: true,
  createdFromRequestId: true,
  createdFromRequest: {
    select: {
      requesterParticipantId: true,
    },
  },
  participantA: {
    select: {
      user: { select: { deletedAt: true } },
      profile: { select: { nicknameSnapshot: true } },
    },
  },
  participantB: {
    select: {
      user: { select: { deletedAt: true } },
      profile: { select: { nicknameSnapshot: true } },
    },
  },
} as const satisfies Prisma.ActiveMatchSelect;

export type MatchOverviewRequestRecord = Prisma.MatchRequestGetPayload<{
  select: typeof matchOverviewRequestSelect;
}>;

export type CurrentActivityActiveMatchRecord = Prisma.ActiveMatchGetPayload<{
  select: typeof currentActivityActiveMatchSelect;
}>;
