import type { PrismaService } from '../../../../src/platform/database/prisma.service.js';

export async function seedActiveMatchFixture(
  prisma: PrismaService,
  input: {
    seasonId?: string;
    activeMatchId: string;
    participantAId: string;
    participantBId: string;
    createdFromRequestId?: string;
    withMatchedThread?: boolean;
  },
) {
  const databaseNow = await prisma.getDatabaseNow();
  const pairKey = [input.participantAId, input.participantBId].sort().join(':');
  const createdFromRequestId = input.createdFromRequestId ?? `${input.activeMatchId}-request`;
  const seasonId = input.seasonId ?? 'season-integration';
  const requestCreatedAt = new Date(databaseNow.getTime() - 2 * 60 * 60 * 1_000);
  const requestAcceptedAt = new Date(databaseNow.getTime() - 90 * 60 * 1_000);
  const activeMatchStartedAt = new Date(databaseNow.getTime() - 60 * 60 * 1_000);

  await prisma.matchRequest.create({
    data: {
      id: createdFromRequestId,
      seasonId,
      pairKey,
      pairMinParticipantId: [input.participantAId, input.participantBId].sort()[0]!,
      pairMaxParticipantId: [input.participantAId, input.participantBId].sort()[1]!,
      requesterParticipantId: input.participantAId,
      receiverParticipantId: input.participantBId,
      status: 'ACCEPTED',
      terminalReason: 'ACCEPTED',
      createdAt: requestCreatedAt,
      expiresAt: new Date(databaseNow.getTime() + 30 * 24 * 60 * 60 * 1_000),
      terminalAt: requestAcceptedAt,
      acceptedAt: requestAcceptedAt,
    },
  });

  await prisma.activeMatch.create({
    data: {
      id: input.activeMatchId,
      seasonId,
      pairKey,
      participantAId: [input.participantAId, input.participantBId].sort()[0]!,
      participantBId: [input.participantAId, input.participantBId].sort()[1]!,
      createdFromRequestId,
      status: 'ACTIVE',
      startedAt: activeMatchStartedAt,
    },
  });

  await prisma.seasonParticipant.updateMany({
    where: {
      id: {
        in: [input.participantAId, input.participantBId],
      },
    },
    data: {
      participantStatus: 'MATCHED',
      matchedAt: activeMatchStartedAt,
    },
  });

  if (input.withMatchedThread) {
    await prisma.conversationThread.create({
      data: {
        id: `${input.activeMatchId}-thread`,
        seasonId,
        pairKey,
        participantAId: [input.participantAId, input.participantBId].sort()[0]!,
        participantBId: [input.participantAId, input.participantBId].sort()[1]!,
        openedByParticipantId: input.participantAId,
        threadKind: 'MATCHED',
        activeMatchId: input.activeMatchId,
        status: 'OPEN',
      },
    });

    await prisma.conversationThreadMember.createMany({
      data: [
        {
          threadId: `${input.activeMatchId}-thread`,
          participantId: input.participantAId,
        },
        {
          threadId: `${input.activeMatchId}-thread`,
          participantId: input.participantBId,
        },
      ],
    });
  }
}
