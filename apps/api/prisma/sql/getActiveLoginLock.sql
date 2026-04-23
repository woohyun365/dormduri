SELECT CEIL(EXTRACT(EPOCH FROM ("lockedUntil" - CURRENT_TIMESTAMP)))::int AS "remainingSeconds"
FROM "LoginAttempt"
WHERE "emailNormalized" = $1
  AND "lockedUntil" IS NOT NULL
  AND "lockedUntil" > CURRENT_TIMESTAMP
LIMIT 1
