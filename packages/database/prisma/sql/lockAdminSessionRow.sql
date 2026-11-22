-- Locks one backoffice session row, so concurrent requests on an expired session leave one
-- SESSION_EXPIRED audit row (operator-access.md OA-R3·OA-R7). NO KEY UPDATE, so audit rows
-- that reference the session still pass their foreign key check.
SELECT id
FROM "AdminSession"
WHERE id = $1
FOR NO KEY UPDATE;
