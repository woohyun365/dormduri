SELECT "eventId", "userId", "threadId", "cursor"
FROM "ChatRealtimeEventRecipient"
WHERE "eventId" = $1
ORDER BY "userId" ASC;
