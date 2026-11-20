SELECT
  relname::text AS "tableName",
  n_live_tup::double precision AS "liveTuples",
  n_dead_tup::double precision AS "deadTuples",
  EXTRACT(EPOCH FROM last_autovacuum)::double precision AS "lastAutovacuumEpochSeconds"
FROM pg_stat_user_tables
WHERE schemaname = current_schema()
  AND relname::text = ANY($1::text[])
ORDER BY relname ASC
