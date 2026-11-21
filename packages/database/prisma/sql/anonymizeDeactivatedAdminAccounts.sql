-- Backoffice records cleanup step 4 (DR-R5): a deactivated account keeps its row and id; once no
-- audit row names it as actor or target, its email and name become anonymous values.
WITH target AS (
  SELECT account."id"
  FROM "AdminAccount" account
  WHERE account."status" = 'DEACTIVATED'
    AND account."anonymizedAt" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "AdminAuditEvent" event
      WHERE event."actorAccountId" = account."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "AdminAuditEvent" event
      WHERE event."targetType" = 'ADMIN_ACCOUNT'
        AND event."targetId" = account."id"
    )
  ORDER BY account."deactivatedAt" ASC, account."id" ASC
  LIMIT $2::int
)
UPDATE "AdminAccount" account
SET "email" = 'anonymized+' || account."id" || '@backoffice.invalid',
    "displayName" = 'anonymized',
    "anonymizedAt" = $1,
    "updatedAt" = $1
FROM target
WHERE account."id" = target."id"
  AND account."status" = 'DEACTIVATED'
  AND account."anonymizedAt" IS NULL
RETURNING account."id";
