WITH _ AS (
    SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))
)
SELECT 1::int AS "lockAcquired";
