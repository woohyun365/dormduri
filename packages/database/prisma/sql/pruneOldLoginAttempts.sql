WITH target AS (
  SELECT id
  FROM "LoginAttempt"
  WHERE ("lastFailedAt" IS NULL OR "lastFailedAt" < $1)
    AND ("lockedUntil" IS NULL OR "lockedUntil" < $1)
  ORDER BY COALESCE("lastFailedAt", "updatedAt", "createdAt") ASC, id ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "LoginAttempt" attempt
  USING target
  WHERE attempt.id = target.id
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
