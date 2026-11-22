-- Locks one backoffice account row (operator-access.md OA-R5). Login attempts and credential
-- reissues on the same account run one after another, so each sees the failure count and lock
-- the earlier ones committed.
SELECT id, "status", "lockedUntil"
FROM "AdminAccount"
WHERE id = $1
FOR UPDATE;
