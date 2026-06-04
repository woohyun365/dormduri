UPDATE "VerificationCode"
SET "consumedAt" = $2
WHERE id = $1
  AND "verifiedAt" IS NOT NULL
  AND "consumedAt" IS NULL
  AND "expiresAt" > CURRENT_TIMESTAMP
RETURNING id;
