import type { Prisma } from '../../generated/prisma/client.js';
import type { ArchiveJobStatus, ArchiveJobTarget } from '../../generated/prisma/enums.js';
import { addDays, buildArchiveJobPayload } from './archive-job.payload.js';
import {
  CHAT_MESSAGE_IDENTITY_REVIEW_AFTER_DAYS,
  DEFAULT_ARCHIVE_JOB_MAX_ATTEMPTS,
  type DeletionArchiveJobInput,
} from './archive-job.types.js';

export async function createDeletionArchiveJobsTx(
  tx: Prisma.TransactionClient,
  input: DeletionArchiveJobInput,
) {
  const participantRows = await tx.seasonParticipant.findMany({
    where: { userId: input.userId },
    select: { id: true, seasonId: true },
    orderBy: { id: 'asc' },
  });
  const participantIds = participantRows.map((participant) => participant.id);

  const seasonProfileHistories =
    participantIds.length > 0
      ? await tx.seasonParticipantProfileHistory.findMany({
          where: { participantId: { in: participantIds } },
          select: { participantId: true, seasonId: true },
          distinct: ['participantId'],
          orderBy: [{ participantId: 'asc' }, { createdAt: 'desc' }],
        })
      : [];

  const matchHistoryEntries =
    participantIds.length > 0
      ? await tx.seasonMatchHistoryEntry.findMany({
          where: {
            OR: [
              { viewerParticipantId: { in: participantIds } },
              { counterpartParticipantId: { in: participantIds } },
            ],
          },
          select: { id: true, seasonId: true },
          orderBy: { id: 'asc' },
        })
      : [];

  const threads =
    participantIds.length > 0
      ? await tx.conversationThread.findMany({
          where: {
            OR: [
              { participantAId: { in: participantIds } },
              { participantBId: { in: participantIds } },
            ],
          },
          select: {
            id: true,
            seasonId: true,
            status: true,
          },
          orderBy: { id: 'asc' },
        })
      : [];

  await tx.userDisplayIdentityNicknameChangeEvent.updateMany({
    where: { userId: input.userId, retainedIdentityId: null },
    data: { retainedIdentityId: input.retainedIdentityId },
  });
  await tx.userAcademicIdentityChangeEvent.updateMany({
    where: { userId: input.userId, retainedIdentityId: null },
    data: { retainedIdentityId: input.retainedIdentityId },
  });

  const jobs: Prisma.ArchiveJobCreateManyInput[] = [
    buildArchiveJob({
      target: 'NICKNAME_AUDIT',
      retainedIdentityId: input.retainedIdentityId,
      userId: input.userId,
      deletedAt: input.deletedAt,
    }),
    buildArchiveJob({
      target: 'ACADEMIC_IDENTITY_AUDIT',
      retainedIdentityId: input.retainedIdentityId,
      userId: input.userId,
      deletedAt: input.deletedAt,
    }),
  ];

  for (const history of seasonProfileHistories) {
    jobs.push(
      buildArchiveJob({
        target: 'SEASON_PROFILE_HISTORY',
        retainedIdentityId: input.retainedIdentityId,
        userId: input.userId,
        seasonId: history.seasonId,
        participantId: history.participantId,
        deletedAt: input.deletedAt,
      }),
    );
  }

  for (const entry of matchHistoryEntries) {
    jobs.push(
      buildArchiveJob({
        target: 'MATCH_HISTORY',
        retainedIdentityId: input.retainedIdentityId,
        userId: input.userId,
        seasonId: entry.seasonId,
        matchHistoryEntryId: entry.id,
        deletedAt: input.deletedAt,
      }),
    );
  }

  for (const thread of threads) {
    jobs.push(
      buildArchiveJob({
        target: 'THREAD_RETENTION',
        retainedIdentityId: input.retainedIdentityId,
        userId: input.userId,
        seasonId: thread.seasonId,
        threadId: thread.id,
        deletedAt: input.deletedAt,
        status: thread.status === 'ARCHIVED' ? 'PENDING' : 'WAITING_CONDITION',
        payload: {
          retentionMode: 'CHAT_THREAD_ARCHIVE',
          identityReviewAfter: addDays(
            input.deletedAt,
            CHAT_MESSAGE_IDENTITY_REVIEW_AFTER_DAYS,
          ).toISOString(),
          waitingFor: thread.status === 'ARCHIVED' ? undefined : 'THREAD_ARCHIVED',
        },
      }),
    );
  }

  const result = await tx.archiveJob.createMany({ data: jobs });
  return { createdCount: result.count };
}

function buildArchiveJob(input: {
  target: ArchiveJobTarget;
  retainedIdentityId: string;
  userId: string;
  deletedAt: Date;
  seasonId?: string;
  participantId?: string;
  matchHistoryEntryId?: string;
  threadId?: string;
  status?: ArchiveJobStatus;
  manualReviewRequired?: boolean;
  payload?: Record<string, unknown>;
}): Prisma.ArchiveJobCreateManyInput {
  const manualReviewRequired = input.manualReviewRequired ?? false;
  const status = input.status ?? (manualReviewRequired ? 'FAILED_MANUAL_REVIEW' : 'PENDING');

  return {
    target: input.target,
    status,
    retainedIdentityId: input.retainedIdentityId,
    userId: input.userId,
    seasonId: input.seasonId,
    participantId: input.participantId,
    matchHistoryEntryId: input.matchHistoryEntryId,
    threadId: input.threadId,
    attemptCount: 0,
    maxAttempts: DEFAULT_ARCHIVE_JOB_MAX_ATTEMPTS,
    nextRunAt: input.deletedAt,
    manualReviewRequired,
    lastErrorCode: manualReviewRequired ? 'MANUAL_REVIEW_REQUIRED' : undefined,
    payload: buildArchiveJobPayload(input) as Prisma.InputJsonValue,
  };
}
