-- @param {String} $1:param1
-- @param {String} $2:param2
SELECT "cursor", "createdAt", "eventId"
FROM "ChatRealtimeEventRecipient"
WHERE "userId" = $1
  AND "cursor" = $2
LIMIT 1;
