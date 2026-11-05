UPDATE "VerificationCode"
SET
  "failedAttempts" = "failedAttempts" + 1,
  "consumedAt" = CASE
    WHEN "failedAttempts" + 1 >= $2 THEN CURRENT_TIMESTAMP
    ELSE "consumedAt"
  END
WHERE id = $1
  AND "verifiedAt" IS NULL
  AND "consumedAt" IS NULL
  AND "deliveryStatus" = 'ACCEPTED'
  AND "activatedAt" IS NOT NULL
  AND "codeExpiresAt" > CURRENT_TIMESTAMP
  AND "failedAttempts" < $2
RETURNING "failedAttempts", "consumedAt";
