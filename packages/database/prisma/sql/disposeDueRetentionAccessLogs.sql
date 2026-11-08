WITH picked AS (
  SELECT "id"
  FROM "RetentionAccessLog"
  WHERE "logRetentionDisposedAt" IS NULL
    AND "logRetentionHoldUntil" IS NOT NULL
    AND "logRetentionHoldUntil" <= $1
  ORDER BY "logRetentionHoldUntil" ASC, "id" ASC
  LIMIT $2
  FOR UPDATE SKIP LOCKED
)
UPDATE "RetentionAccessLog" AS log
SET "accessedBy" = NULL,
    "approvalReference" = NULL,
    "purpose" = NULL,
    "disclosedFields" = 'null'::jsonb,
    "logRetentionDisposedAt" = $1,
    "logRetentionDisposalReason" = 'RETENTION_ACCESS_LOG_METADATA_MINIMIZED'
FROM picked
WHERE log."id" = picked."id"
RETURNING log."id";
