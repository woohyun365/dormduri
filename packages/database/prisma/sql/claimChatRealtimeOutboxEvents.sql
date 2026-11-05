-- @param {DateTime} $1:param1
-- @param {DateTime} $2:param2
WITH picked AS (
  SELECT "id"
  FROM "ChatRealtimeOutboxEvent"
  WHERE "publishedAt" IS NULL
    AND "availableAt" <= $1
  ORDER BY "availableAt" ASC, "occurredAt" ASC, "id" ASC
  LIMIT $3
  FOR UPDATE SKIP LOCKED
)
UPDATE "ChatRealtimeOutboxEvent" AS event
SET "availableAt" = $2,
    "publishAttempts" = event."publishAttempts" + 1,
    "updatedAt" = $1
FROM picked
WHERE event."id" = picked."id"
RETURNING
  event."id",
  event."eventType",
  event."schemaVersion",
  event."threadId",
  event."aggregateType",
  event."aggregateId",
  event."aggregateVersion",
  event."payload",
  event."roomKeys",
  event."occurredAt",
  event."availableAt",
  event."publishAttempts";
