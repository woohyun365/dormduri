-- @param {DateTime} $1:param1
-- @param {DateTime} $2:param2
WITH picked AS (
  SELECT "id"
  FROM "ArchiveJob"
  WHERE "target" IN (
      'SEASON_PROFILE_HISTORY',
      'MATCH_HISTORY',
      'THREAD_RETENTION',
      'NICKNAME_AUDIT',
      'ACADEMIC_IDENTITY_AUDIT'
    )
    AND "status" IN ('PENDING', 'RETRY_SCHEDULED')
    AND "nextRunAt" <= $1
  ORDER BY "nextRunAt" ASC, "createdAt" ASC, "id" ASC
  LIMIT $3
  FOR UPDATE SKIP LOCKED
)
UPDATE "ArchiveJob" AS job
SET "status" = 'RETRY_SCHEDULED',
    "nextRunAt" = $2,
    "lastAttemptAt" = $1,
    "updatedAt" = $1
FROM picked
WHERE job."id" = picked."id"
RETURNING
  job."id",
  job."target",
  job."status",
  job."retainedIdentityId",
  job."userId",
  job."seasonId",
  job."participantId",
  job."matchHistoryEntryId",
  job."threadId",
  job."attemptCount",
  job."maxAttempts",
  job."nextRunAt",
  job."lastErrorCode",
  job."manualReviewRequired",
  job."payload";
