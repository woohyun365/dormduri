SELECT
  COUNT(*)::int AS "requestCount",
  MIN("createdAt") AS "oldestRequestAt"
FROM "VerificationCodeRequestLog"
WHERE "emailNormalized" = $1
  AND purpose = CAST($2 AS "VerificationCodePurpose")
  AND "createdAt" > CURRENT_TIMESTAMP - ($3 * INTERVAL '1 second')
