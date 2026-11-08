SELECT
  EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::DOUBLE PRECISION AS "epochSeconds",
  COUNT(*) FILTER (WHERE rolled_back_at IS NOT NULL)::int AS "failedCount",
  COUNT(*) FILTER (
    WHERE finished_at IS NULL
      AND rolled_back_at IS NULL
  )::int AS "incompleteCount"
FROM "_prisma_migrations"
