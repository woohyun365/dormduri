WITH picked AS (
  SELECT "id"
  FROM "RetentionReviewJob"
  WHERE "status" IN ('PENDING', 'RETRY_SCHEDULED')
    AND "dueAt" <= $1
  ORDER BY "dueAt" ASC, "createdAt" ASC, "id" ASC
  LIMIT $3
  FOR UPDATE SKIP LOCKED
)
UPDATE "RetentionReviewJob" AS job
SET "status" = 'RETRY_SCHEDULED',
    "dueAt" = $2,
    "lastAttemptAt" = $1,
    "updatedAt" = $1
FROM picked
WHERE job."id" = picked."id"
RETURNING
  job."id",
  job."target",
  job."sourceId",
  job."attemptCount",
  job."maxAttempts",
  job."payload",
  job."manualReviewRequired";
