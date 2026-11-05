WITH target AS (
  SELECT id
  FROM "AuthSession"
  WHERE "expiresAt" < $1
     OR "revokedAt" < $1
  ORDER BY COALESCE("revokedAt", "expiresAt") ASC, id ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "AuthSession" session
  USING target
  WHERE session.id = target.id
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
