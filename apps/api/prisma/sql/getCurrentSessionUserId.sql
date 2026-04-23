SELECT "userId"
FROM "AuthSession"
WHERE id = $1
  AND "userId" = $2
  AND "revokedAt" IS NULL
  AND "expiresAt" > CURRENT_TIMESTAMP
LIMIT 1
