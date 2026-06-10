import type { Prisma } from '../../../generated/prisma/client.js';
import { lifestyleColumnSelect } from '../../../season-participants/lifestyle/lifestyle-persistence.mapper.js';

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
  requesterParticipant: {
    select: {
      userId: true,
      registeredAt: true,
      dormitoryId: true,
      dormitorySelectionState: true,
      participationIntent: true,
      participantStatus: true,
      declinedAt: true,
      withdrawnAt: true,
      hiddenByAdminAt: true,
      deactivatedAt: true,
      user: {
        select: {
          deletedAt: true,
        },
      },
      profile: {
        select: {
          nicknameSnapshot: true,
          intro: true,
          ...lifestyleColumnSelect,
        },
      },
    },
  },
  receiverParticipant: {
    select: {
      userId: true,
      registeredAt: true,
      dormitoryId: true,
      dormitorySelectionState: true,
      participationIntent: true,
      participantStatus: true,
      declinedAt: true,
      withdrawnAt: true,
      hiddenByAdminAt: true,
      deactivatedAt: true,
      user: {
        select: {
          deletedAt: true,
        },
      },
      profile: {
        select: {
          nicknameSnapshot: true,
          intro: true,
          ...lifestyleColumnSelect,
        },
      },
    },
  },
} as const satisfies Prisma.MatchRequestSelect;

export type MatchRequestRecord = Prisma.MatchRequestGetPayload<{
  select: typeof matchRequestSummarySelect;
}>;
