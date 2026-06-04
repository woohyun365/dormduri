import { toDateOnlyString } from '@repo/shared/date-primitives';
import { subtractDays } from '../../seasons/season.utils.js';
import type { PrismaService } from '../../platform/database/prisma.service.js';

export const BOUNDARY_JOB_PREFIX = 'lifecycle-boundary';

export interface LifecycleBoundaryJob {
  name: string;
  runAt: Date;
}

interface BoundarySeasonRecord {
  id: string;
  preparationStartDate: string;
  matchingStartDate: string;
  seasonEndDate: string;
  dormitoryOperations: Array<{
    dormitoryId: string;
    roomSelectionDate: string;
  }>;
}

export function createLifecycleBoundaryJobBuilder(prisma: PrismaService) {
  async function buildBoundaryJobs(referenceNow: Date): Promise<LifecycleBoundaryJob[]> {
    const seasons = await prisma.season.findMany({
      where: {
        campus: {
          isOperated: true,
        },
      },
      orderBy: [{ seasonEndDate: 'asc' }, { matchingStartDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        preparationStartDate: true,
        matchingStartDate: true,
        seasonEndDate: true,
        dormitoryOperations: {
          where: {
            isOperated: true,
          },
          select: {
            dormitoryId: true,
            roomSelectionDate: true,
          },
          orderBy: [{ roomSelectionDate: 'asc' }, { dormitoryId: 'asc' }],
        },
      },
    });

    const jobs: LifecycleBoundaryJob[] = [];
    for (const season of seasons) {
      jobs.push(...toBoundaryJobsForSeason(toBoundarySeasonRecord(season), referenceNow));
    }

    return jobs;
  }

  function toBoundaryJobsForSeason(
    season: BoundarySeasonRecord,
    referenceNow: Date,
  ): LifecycleBoundaryJob[] {
    const jobs: LifecycleBoundaryJob[] = [];

    pushBoundaryJob(
      jobs,
      `${BOUNDARY_JOB_PREFIX}:${season.id}:preparation-start`,
      toKstBoundaryInstant(season.preparationStartDate),
      referenceNow,
    );
    pushBoundaryJob(
      jobs,
      `${BOUNDARY_JOB_PREFIX}:${season.id}:matching-start`,
      toKstBoundaryInstant(season.matchingStartDate),
      referenceNow,
    );
    pushBoundaryJob(
      jobs,
      `${BOUNDARY_JOB_PREFIX}:${season.id}:season-end-next-day`,
      toKstBoundaryInstant(subtractDays(season.seasonEndDate, -1)),
      referenceNow,
    );

    for (const operation of season.dormitoryOperations) {
      pushBoundaryJob(
        jobs,
        `${BOUNDARY_JOB_PREFIX}:${season.id}:room-selection-next-day:${operation.dormitoryId}`,
        toKstBoundaryInstant(subtractDays(operation.roomSelectionDate, -1)),
        referenceNow,
      );
    }

    return jobs;
  }

  return {
    buildBoundaryJobs,
    toBoundaryJobsForSeason,
  };
}

function toBoundarySeasonRecord(season: {
  id: string;
  preparationStartDate: Date;
  matchingStartDate: Date;
  seasonEndDate: Date;
  dormitoryOperations: Array<{
    dormitoryId: string;
    roomSelectionDate: Date;
  }>;
}): BoundarySeasonRecord {
  return {
    id: season.id,
    preparationStartDate: toDateOnlyString(season.preparationStartDate),
    matchingStartDate: toDateOnlyString(season.matchingStartDate),
    seasonEndDate: toDateOnlyString(season.seasonEndDate),
    dormitoryOperations: season.dormitoryOperations.map((operation) => ({
      dormitoryId: operation.dormitoryId,
      roomSelectionDate: toDateOnlyString(operation.roomSelectionDate),
    })),
  };
}

function pushBoundaryJob(
  target: LifecycleBoundaryJob[],
  name: string,
  runAt: Date,
  referenceNow: Date,
) {
  if (runAt.getTime() <= referenceNow.getTime()) {
    return;
  }

  target.push({ name, runAt });
}

function toKstBoundaryInstant(localDate: string) {
  return new Date(`${localDate}T00:00:00+09:00`);
}
