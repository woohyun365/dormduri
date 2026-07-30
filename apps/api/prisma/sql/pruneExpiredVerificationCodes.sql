WITH target AS (
  SELECT id
  FROM "VerificationCode"
  WHERE "codeExpiresAt" < $1
     OR "consumedAt" < $1
  ORDER BY COALESCE("consumedAt", "codeExpiresAt") ASC, id ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "VerificationCode" code
  USING target
  WHERE code.id = target.id
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
