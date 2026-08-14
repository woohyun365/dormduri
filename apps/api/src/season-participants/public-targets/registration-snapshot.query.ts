import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';

export type RegistrationSnapshotReader =
  | Pick<PrismaService, 'seasonParticipantProfileHistory'>
  | Pick<Prisma.TransactionClient, 'seasonParticipantProfileHistory'>;

export function createSeasonParticipantPublicTargetOwner(prisma: PrismaService) {
  return {
    async findRegistrationSnapshotParticipantIdSet(
      participantIds: readonly string[],
      client: RegistrationSnapshotReader = prisma,
    ): Promise<ReadonlySet<string>> {
      const uniqueParticipantIds = [...new Set(participantIds)];
      if (uniqueParticipantIds.length === 0) {
        return new Set();
      }

      const histories = await client.seasonParticipantProfileHistory.findMany({
        where: {
          participantId: { in: uniqueParticipantIds },
          source: 'SEASON_REGISTRATION',
          registeredAtSnapshot: { not: null },
          redactedAt: null,
        },
        select: { participantId: true },
      });

      return new Set(histories.map((history) => history.participantId));
    },

    async hasRegistrationSnapshotForParticipant(
      participantId: string,
      client: RegistrationSnapshotReader = prisma,
    ): Promise<boolean> {
      const history = await client.seasonParticipantProfileHistory.findFirst({
        where: {
          participantId,
          source: 'SEASON_REGISTRATION',
          registeredAtSnapshot: { not: null },
          redactedAt: null,
        },
        select: { participantId: true },
      });

      return history !== null;
    },
  };
}

export type SeasonParticipantPublicTargetOwner = ReturnType<
  typeof createSeasonParticipantPublicTargetOwner
>;
