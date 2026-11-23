-- Locks one backoffice account row (operator-access.md OA-R5). Login attempts and credential
-- reissues on the same account run one after another, so each sees the failure count and lock
-- the earlier ones committed. NO KEY UPDATE, because the lock changes no key: audit and session
-- rows that reference the account still pass their foreign key check, so a transaction that
-- holds a credential row and then writes its audit row never waits on this lock (no deadlock).
SELECT id, "status", "lockedUntil"
FROM "AdminAccount"
WHERE id = $1
FOR NO KEY UPDATE;
