-- Locks one backoffice session row, so concurrent requests on an expired session leave one
-- SESSION_EXPIRED audit row (operator-access.md OA-R3·OA-R7).
SELECT id
FROM "AdminSession"
WHERE id = $1
FOR UPDATE;
