WITH target AS (
  SELECT id
  FROM "AuthSecurityEvent"
  WHERE "createdAt" < $1
  ORDER BY "createdAt" ASC, id ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "AuthSecurityEvent" event
  USING target
  WHERE event.id = target.id
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
