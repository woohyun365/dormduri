-- Backoffice records cleanup step 1 (data-retention.md DR-R5): audit rows older than the cutoff.
WITH target AS (
  SELECT "id"
  FROM "AdminAuditEvent"
  WHERE "occurredAt" < $1
  ORDER BY "occurredAt" ASC, "id" ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "AdminAuditEvent" event
  USING target
  WHERE event."id" = target."id"
    AND event."occurredAt" < $1
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
