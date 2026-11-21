-- Backoffice records cleanup step 3 (DR-R5): requests closed before the cutoff, and requests still
-- pending whose expiry is before the cutoff, once no audit row and no role assignment points at them.
WITH target AS (
  SELECT request."id"
  FROM "AdminApprovalRequest" request
  WHERE (
      request."closedAt" < $1
      OR (request."status" = 'PENDING' AND request."expiresAt" < $1)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "AdminAuditEvent" event
      WHERE event."approvalRequestId" = request."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "AdminAuditEvent" event
      WHERE event."targetType" = 'ADMIN_APPROVAL_REQUEST'
        AND event."targetId" = request."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "AdminRoleAssignment" assignment
      WHERE assignment."grantedByApprovalRequestId" = request."id"
    )
    AND NOT EXISTS (
      SELECT 1
      FROM "AdminRoleAssignment" assignment
      WHERE assignment."revokedByApprovalRequestId" = request."id"
    )
  ORDER BY COALESCE(request."closedAt", request."expiresAt") ASC, request."id" ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "AdminApprovalRequest" request
  USING target
  WHERE request."id" = target."id"
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
