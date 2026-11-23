-- Backoffice records cleanup step 5 (DR-R6): invitations used, expired or revoked before the cutoff.
WITH target AS (
  SELECT "id"
  FROM "AdminInvitation"
  WHERE "usedAt" < $1
     OR "expiresAt" < $1
     OR "revokedAt" < $1
  ORDER BY "expiresAt" ASC, "id" ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "AdminInvitation" invitation
  USING target
  WHERE invitation."id" = target."id"
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
