-- Backoffice records cleanup step 5 (DR-R6): WebAuthn challenges used or expired before the cutoff.
WITH target AS (
  SELECT "id"
  FROM "AdminWebAuthnChallenge"
  WHERE "usedAt" < $1
     OR "expiresAt" < $1
  ORDER BY "expiresAt" ASC, "id" ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "AdminWebAuthnChallenge" challenge
  USING target
  WHERE challenge."id" = target."id"
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
