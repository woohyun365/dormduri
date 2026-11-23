-- Backoffice records cleanup step 5 (data-retention.md DR-R6): sessions revoked, past the absolute
-- expiry or last active before the cutoff. Their audit rows keep the session id as a value.
WITH target AS (
  SELECT "id"
  FROM "AdminSession"
  WHERE "revokedAt" < $1
     OR "absoluteExpiresAt" < $1
     OR "lastActivityAt" < $1
  ORDER BY "lastActivityAt" ASC, "id" ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "AdminSession" session
  USING target
  WHERE session."id" = target."id"
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
