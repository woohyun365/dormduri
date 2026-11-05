WITH target AS (
  SELECT id
  FROM "VerificationCodeRequestLog"
  WHERE "createdAt" < $1
  ORDER BY "createdAt" ASC, id ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "VerificationCodeRequestLog" log
  USING target
  WHERE log.id = target.id
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
