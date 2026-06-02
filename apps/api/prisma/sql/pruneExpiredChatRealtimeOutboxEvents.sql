WITH deleted AS (
  DELETE FROM "ChatRealtimeOutboxEvent"
  WHERE "occurredAt" < $1
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
