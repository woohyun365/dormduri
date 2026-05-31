INSERT INTO "LoginAttempt" (
  id,
  "emailNormalized",
  "failureCount",
  "lockedUntil",
  "lastFailedAt",
  "createdAt",
  "updatedAt"
)
VALUES (
  $1,
  $2,
  1,
  NULL,
  NOW(),
  NOW(),
  NOW()
)
ON CONFLICT ("emailNormalized")
DO UPDATE SET
  "failureCount" = "LoginAttempt"."failureCount" + 1,
  "lockedUntil" = CASE
    WHEN "LoginAttempt"."failureCount" + 1 >= $3
    THEN NOW() + ($4 * INTERVAL '1 second')
    ELSE NULL
  END,
  "lastFailedAt" = NOW(),
  "updatedAt" = NOW()
RETURNING "failureCount", "lockedUntil";
