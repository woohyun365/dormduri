SELECT
  recipient."eventId" AS "eventId",
  recipient."cursor" AS "cursor",
  event."eventType" AS "eventType",
  event."schemaVersion" AS "schemaVersion",
  event."threadId" AS "threadId",
  event."payload" AS "payload",
  event."occurredAt" AS "occurredAt",
  recipient."createdAt" AS "recipientCreatedAt"
FROM "ChatRealtimeEventRecipient" AS recipient
INNER JOIN "ChatRealtimeOutboxEvent" AS event ON event."id" = recipient."eventId"
WHERE recipient."userId" = $1
  AND recipient."createdAt" >= $2
  AND (
    $3::boolean = false
    OR (recipient."createdAt", recipient."eventId") > ($4, $5)
  )
ORDER BY recipient."createdAt" ASC, recipient."eventId" ASC
LIMIT $6;
