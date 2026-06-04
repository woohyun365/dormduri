UPDATE "VerificationCode"
SET "verifiedAt" = CURRENT_TIMESTAMP
WHERE id = $1
  AND "verifiedAt" IS NULL
  AND "consumedAt" IS NULL
  AND "expiresAt" > CURRENT_TIMESTAMP
  AND "failedAttempts" < $2
RETURNING id;
