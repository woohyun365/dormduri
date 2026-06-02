WITH picked AS (
  SELECT "id"
  FROM "NotificationOutboxEvent"
  WHERE "status" IN ('PENDING', 'FAILED')
    AND "availableAt" <= $1
    AND ("lockedAt" IS NULL OR "lockedAt" <= $2)
  ORDER BY "availableAt" ASC, "createdAt" ASC, "id" ASC
  LIMIT $4
  FOR UPDATE SKIP LOCKED
)
UPDATE "NotificationOutboxEvent" AS event
SET "status" = 'PENDING',
    "lockedAt" = $1,
    "lockedBy" = $3,
    "publishAttempts" = event."publishAttempts" + 1,
    "updatedAt" = $1
FROM picked
WHERE event."id" = picked."id"
RETURNING
  event."id",
  event."notificationId",
  event."recipientUserId",
  event."eventType",
  event."schemaVersion",
  event."payload",
  event."createdAt",
  event."publishAttempts";
