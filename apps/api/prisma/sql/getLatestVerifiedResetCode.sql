SELECT id
FROM "VerificationCode"
WHERE "emailNormalized" = $1
  AND purpose = 'RESET_PASSWORD'::"VerificationCodePurpose"
  AND "verifiedAt" IS NOT NULL
  AND "consumedAt" IS NULL
  AND "expiresAt" > CURRENT_TIMESTAMP
ORDER BY "issuedAt" DESC
LIMIT 1
