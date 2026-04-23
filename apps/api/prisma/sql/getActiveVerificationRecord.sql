SELECT id, "codeHash", "failedAttempts"
FROM "VerificationCode"
WHERE "emailNormalized" = $1
  AND purpose = CAST($2 AS "VerificationCodePurpose")
  AND "consumedAt" IS NULL
  AND "expiresAt" > CURRENT_TIMESTAMP
  AND "failedAttempts" < $3
ORDER BY "issuedAt" DESC
LIMIT 1
