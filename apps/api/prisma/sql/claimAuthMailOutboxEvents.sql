-- @param {DateTime} $1:param1
-- @param {DateTime} $2:param2
WITH picked AS (
  SELECT "id"
  FROM "AuthMailOutboxEvent"
  WHERE (
      ("status" = 'PENDING' AND "availableAt" <= $1)
      OR ("status" = 'PROCESSING' AND "lockedAt" <= $2)
    )
    AND "expiresAt" > $1
  ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
  LIMIT $4
  FOR UPDATE SKIP LOCKED
)
UPDATE "AuthMailOutboxEvent" AS event
SET "status" = 'PROCESSING',
    "lockedAt" = $1,
    "lockedBy" = $3,
    "attemptCount" = event."attemptCount" + 1,
    "updatedAt" = $1
FROM picked
WHERE event."id" = picked."id"
RETURNING
  event."id",
  event."mailKind"::text AS "mailKind",
  event."verificationCodeId",
  event."targetUserId",
  event."purpose"::text AS "purpose",
  event."payloadCiphertext",
  event."payloadIv",
  event."payloadAuthTag",
  event."keyVersion",
  event."expiresAt",
  event."attemptCount";
