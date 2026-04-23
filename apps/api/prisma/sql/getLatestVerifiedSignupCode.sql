SELECT id
FROM "VerificationCode"
WHERE "emailNormalized" = $1
  AND purpose = 'SIGNUP'::"VerificationCodePurpose"
  AND "verifiedAt" IS NOT NULL
  AND "verifiedAt" > CURRENT_TIMESTAMP - ($2 * INTERVAL '1 second')
  AND "consumedAt" IS NULL
ORDER BY "issuedAt" DESC
LIMIT 1
