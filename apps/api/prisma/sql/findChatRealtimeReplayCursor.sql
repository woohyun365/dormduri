SELECT "cursor", "createdAt", "eventId"
FROM "ChatRealtimeEventRecipient"
WHERE "userId" = $1
  AND "cursor" = $2
LIMIT 1;
