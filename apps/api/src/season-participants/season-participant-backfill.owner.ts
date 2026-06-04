import type { SeasonParticipantOwnerDeps } from './season-participant-owner-deps.js';
import { buildSeasonParticipantCreateData } from './participants/season-participant-container.command.js';
import type { SeasonParticipantBackfillResult } from './participants/season-participant-records.js';
import type { SeasonParticipantLifecycleEventWriter } from './lifecycle/season-participant-lifecycle-event.writer.js';

export function createSeasonParticipantBackfillOwner(
  deps: SeasonParticipantOwnerDeps,
  lifecycleEventWriter: SeasonParticipantLifecycleEventWriter,
) {
  async function backfillCurrentSeasonParticipants(
    now: Date,
  ): Promise<SeasonParticipantBackfillResult[]> {
    const operatedCampuses = await deps.prisma.campusMaster.findMany({
      where: { isOperated: true },
      select: { code: true },
      orderBy: { code: 'asc' },
    });

    const results: SeasonParticipantBackfillResult[] = [];

    for (const campus of operatedCampuses) {
      const seasonContext = await deps.seasonsService.getCurrentSeasonContext(campus.code, now);
      if (!seasonContext) {
        continue;
      }

      const eligibleUsers = await deps.prisma.user.findMany({
        where: {
          campus: campus.code,
          emailVerifiedAt: { not: null },
          deletedAt: null,
        },
        select: {
          id: true,
          emailVerifiedAt: true,
          gender: true,
          campus: true,
        },
        orderBy: { id: 'asc' },
      });

      const existingParticipants = await deps.prisma.seasonParticipant.findMany({
        where: { seasonId: seasonContext.season.id },
        select: { userId: true },
      });
      const existingUserIds = new Set(
        existingParticipants.map((participant) => participant.userId),
      );

      const createData = eligibleUsers
        .filter((candidate) => !existingUserIds.has(candidate.id))
        .map((candidate) =>
          buildSeasonParticipantCreateData(candidate, seasonContext.season.id, now),
        );

      const createdParticipants =
        createData.length > 0
          ? await deps.prisma.runSerializableTransaction(async (tx) => {
              const created = await tx.seasonParticipant.createManyAndReturn({
                data: createData,
                skipDuplicates: true,
                select: {
                  id: true,
                  seasonId: true,
                  userId: true,
                  participationIntent: true,
                  dormitoryId: true,
                  dormitorySelectionState: true,
                  participantStatus: true,
                  joinedAt: true,
                },
              });
              await lifecycleEventWriter.recordJoinedMany(tx, {
                participants: created,
                occurredAt: now,
              });

              return created;
            })
          : [];

      results.push({
        campus: campus.code,
        seasonId: seasonContext.season.id,
        eligibleUserCount: eligibleUsers.length,
        createdCount: createdParticipants.length,
        existingCount: existingParticipants.length,
      });
    }

    return results;
  }

  return { backfillCurrentSeasonParticipants };
}

export type SeasonParticipantBackfillOwner = ReturnType<
  typeof createSeasonParticipantBackfillOwner
>;
