SELECT id, "codeHash", "failedAttempts"
FROM "VerificationCode"
WHERE "subjectKey" = $1
  AND purpose = CAST($2 AS "VerificationCodePurpose")
  AND "deliveryStatus" = 'ACCEPTED'
  AND "activatedAt" IS NOT NULL
  AND "verifiedAt" IS NULL
  AND "consumedAt" IS NULL
  AND "codeExpiresAt" > CURRENT_TIMESTAMP
  AND "failedAttempts" < $3
ORDER BY "issuedAt" DESC
LIMIT 1
