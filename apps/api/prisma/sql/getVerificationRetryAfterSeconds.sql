SELECT CEIL(EXTRACT(EPOCH FROM ("createdAt" + ($4 * INTERVAL '1 second') - CURRENT_TIMESTAMP)))::int AS "retryAfterSeconds"
FROM "VerificationCodeRequestLog"
WHERE "emailNormalized" = $1
  AND purpose = CAST($2 AS "VerificationCodePurpose")
  AND "requestIp" = $3
  AND "createdAt" > CURRENT_TIMESTAMP - ($4 * INTERVAL '1 second')
ORDER BY "createdAt" DESC
LIMIT 1
