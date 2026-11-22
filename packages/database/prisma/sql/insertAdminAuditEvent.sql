-- Writes one backoffice audit row. "occurredAt" is not in the column list: backoffice_runtime has
-- no INSERT privilege on it, so the row always takes the column default, the database clock.
INSERT INTO "AdminAuditEvent" (
  "id",
  "actorType",
  "actorAccountId",
  "sessionId",
  "accessPath",
  "action",
  "targetType",
  "targetId",
  "approvalRequestId",
  "result",
  "selfApproved",
  "reason",
  "requestId",
  "metadata"
) VALUES (
  $1,
  $2::"AdminAuditActorType",
  $3,
  $4,
  $5::"AdminAuditAccessPath",
  $6::"AdminAuditAction",
  $7::"AdminAuditTargetType",
  $8,
  $9,
  $10::"AdminAuditResult",
  $11,
  $12,
  $13,
  $14::jsonb
)
RETURNING "id";
