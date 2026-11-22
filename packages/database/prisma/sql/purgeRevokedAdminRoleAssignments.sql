-- Backoffice records cleanup step 2 (DR-R5): role assignments revoked before the cutoff once no
-- audit row names them. Audit rows point at an assignment by value, so the database does not stop
-- this delete; the NOT EXISTS keeps the order "audit first, then the assignment".
WITH target AS (
  SELECT assignment."id"
  FROM "AdminRoleAssignment" assignment
  WHERE assignment."revokedAt" < $1
    AND NOT EXISTS (
      SELECT 1
      FROM "AdminAuditEvent" event
      WHERE event."targetType" = 'ADMIN_ROLE_ASSIGNMENT'
        AND event."targetId" = assignment."id"
    )
  ORDER BY assignment."revokedAt" ASC, assignment."id" ASC
  LIMIT $2::int
), deleted AS (
  DELETE FROM "AdminRoleAssignment" assignment
  USING target
  WHERE assignment."id" = target."id"
    AND assignment."revokedAt" < $1
  RETURNING 1
)
SELECT COUNT(*)::int AS "deletedCount"
FROM deleted;
